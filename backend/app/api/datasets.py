from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.projects import get_owned_project
from app.core.config import settings
from app.database.database import get_db
from app.database.models import Dataset, Project, User, new_id
from app.ml.profiling import (
    DatasetValidationError,
    analyze_target,
    load_dataframe,
    preview_records,
    profile_dataframe,
    read_csv_bytes,
)
from app.schemas.datasets import DatasetOut, DatasetPreview, TargetUpdate
from app.services.storage import dataset_path, delete_dataset_file, save_dataset_file

router = APIRouter(prefix="/api", tags=["datasets"])


def get_owned_dataset(dataset_id: str, db: Session, user: User) -> Dataset:
    """Same ownership rule as projects: reach the dataset THROUGH its project."""
    dataset = db.scalar(
        select(Dataset)
        .join(Project, Dataset.project_id == Project.id)
        .where(Dataset.id == dataset_id, Project.user_id == user.id)
    )
    if dataset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dataset not found")
    return dataset


def _read_limited(file: UploadFile) -> bytes:
    max_bytes = settings.max_upload_mb * 1024 * 1024
    chunks, size = [], 0
    while chunk := file.file.read(1024 * 1024):
        size += len(chunk)
        if size > max_bytes:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"File is too large. Maximum size is {settings.max_upload_mb} MB.",
            )
        chunks.append(chunk)
    return b"".join(chunks)


@router.post(
    "/projects/{project_id}/dataset",
    response_model=DatasetOut,
    status_code=status.HTTP_201_CREATED,
)
def upload_dataset(
    project_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_owned_project(project_id, db, current_user)

    filename = Path(file.filename or "").name  # strips any folder parts
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only .csv files are supported.")

    raw = _read_limited(file)
    try:
        df = read_csv_bytes(raw)
    except DatasetValidationError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    dataset_id = new_id()
    storage_name = f"{dataset_id}.csv"
    save_dataset_file(storage_name, raw)
    try:
        dataset = Dataset(
            id=dataset_id,
            project_id=project.id,
            original_filename=filename[:255],
            storage_name=storage_name,
            file_size_bytes=len(raw),
            n_rows=int(df.shape[0]),
            n_cols=int(df.shape[1]),
            profile=profile_dataframe(df),
        )
        project.status = "dataset_uploaded"
        db.add(dataset)
        db.commit()
    except Exception:
        db.rollback()
        delete_dataset_file(storage_name)  # don't leave an orphan file behind
        raise
    db.refresh(dataset)
    return dataset


@router.get("/projects/{project_id}/datasets", response_model=list[DatasetOut])
def list_datasets(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_owned_project(project_id, db, current_user)
    return db.scalars(
        select(Dataset).where(Dataset.project_id == project.id).order_by(Dataset.created_at.desc())
    ).all()


@router.get("/datasets/{dataset_id}", response_model=DatasetOut)
def get_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_owned_dataset(dataset_id, db, current_user)


@router.get("/datasets/{dataset_id}/preview", response_model=DatasetPreview)
def preview_dataset(
    dataset_id: str,
    rows: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dataset = get_owned_dataset(dataset_id, db, current_user)
    df = load_dataframe(dataset_path(dataset.storage_name), nrows=rows)
    return DatasetPreview(
        columns=list(df.columns), rows=preview_records(df), total_rows=dataset.n_rows
    )


@router.put("/datasets/{dataset_id}/target", response_model=DatasetOut)
def set_target(
    dataset_id: str,
    data: TargetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dataset = get_owned_dataset(dataset_id, db, current_user)

    if data.target_column is None:
        dataset.target_column = None
        dataset.target_info = None
    else:
        df = load_dataframe(dataset_path(dataset.storage_name))
        try:
            info = analyze_target(df, data.target_column)
        except DatasetValidationError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
        dataset.target_column = data.target_column
        dataset.target_info = info

    db.commit()
    db.refresh(dataset)
    return dataset