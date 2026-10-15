from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.projects import get_owned_project
from app.database.database import get_db
from app.database.models import Dataset, Project, TrainingRun, User
from app.ml.model_registry import ParamError, get_model_spec
from app.schemas.training import TrainingRunOut, TrainRequest
from app.services.training_service import execute_run

router = APIRouter(prefix="/api", tags=["training"])


@router.post(
    "/projects/{project_id}/train",
    response_model=TrainingRunOut,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_training(
    project_id: str,
    data: TrainRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_owned_project(project_id, db, current_user)

    dataset = db.scalar(
        select(Dataset).where(Dataset.id == data.dataset_id, Dataset.project_id == project.id)
    )
    if dataset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dataset not found in this project")
    if not dataset.target_column:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Select a target column first.")

    try:
        spec = get_model_spec(data.model_type)
    except KeyError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown model '{data.model_type}'.")
    try:
        params = spec.resolve_params(data.hyperparameters)  # fail fast, store full settings
    except ParamError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    run = TrainingRun(
        project_id=project.id,
        dataset_id=dataset.id,
        model_type=spec.key,
        task_type=spec.task,
        hyperparameters=params,
        test_size=data.test_size,
        random_state=data.random_state,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    background_tasks.add_task(execute_run, run.id)
    return run


@router.get("/projects/{project_id}/runs", response_model=list[TrainingRunOut])
def list_runs(
    project_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_owned_project(project_id, db, current_user)
    return db.scalars(
        select(TrainingRun)
        .where(TrainingRun.project_id == project.id)
        .order_by(TrainingRun.created_at.desc())
        .limit(limit)
    ).all()


@router.get("/training/{run_id}", response_model=TrainingRunOut)
def get_run(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = db.scalar(
        select(TrainingRun)
        .join(Project, TrainingRun.project_id == Project.id)
        .where(TrainingRun.id == run_id, Project.user_id == current_user.id)
    )
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Training run not found")
    return run