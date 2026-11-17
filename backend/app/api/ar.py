from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, load_only

from app.api.deps import get_current_user
from app.api.projects import get_owned_project
from app.database.database import get_db
from app.database.models import Dataset, Explanation, Project, TrainingRun, User
from app.services.ar_payload import build_ar_payload, model_label
from app.services.qr import QRError, parse_qr_text, resolve_token
from app.services.runs import RunNotAvailable, select_run

router = APIRouter(prefix="/api/ar", tags=["ar"])


class ResolveQRRequest(BaseModel):
    qr_text: str = Field(min_length=1, max_length=500)


def _payload_for(db: Session, project: Project, run: TrainingRun) -> dict:
    dataset = db.get(Dataset, run.dataset_id)
    explanation = db.scalar(select(Explanation).where(Explanation.run_id == run.id))
    return build_ar_payload(project, dataset, run, explanation.payload if explanation else None)


@router.get("/my-projects")
def my_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The AR app's 'My Projects' list: only projects with a finished, trained model."""
    projects = db.scalars(
        select(Project).where(Project.user_id == current_user.id).order_by(Project.updated_at.desc())
    ).all()

    latest: dict[str, TrainingRun] = {}
    if projects:
        runs = db.scalars(
            select(TrainingRun)
            .options(  # skip the big JSON columns: we only need a few fields here
                load_only(
                    TrainingRun.id, TrainingRun.project_id, TrainingRun.model_type,
                    TrainingRun.task_type, TrainingRun.finished_at,
                )
            )
            .where(
                TrainingRun.project_id.in_([p.id for p in projects]),
                TrainingRun.status == "completed",
            )
            .order_by(TrainingRun.created_at.desc())
        ).all()
        for run in runs:
            latest.setdefault(run.project_id, run)  # first seen = newest

    items = []
    for project in projects:
        run = latest.get(project.id)
        if run is None:
            continue
        items.append(
            {
                "project_id": project.id,
                "name": project.name,
                "description": project.description,
                "run_id": run.id,
                "model_type": run.model_type,
                "model_label": model_label(run.model_type),
                "task": run.task_type,
                "trained_at": run.finished_at,
            }
        )
    return {"projects": items}


@router.get("/projects/{project_id}")
def get_ar_project(
    project_id: str,
    run_id: str | None = Query(None, description="Defaults to the latest completed run"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_owned_project(project_id, db, current_user)
    try:
        run = select_run(db, project, run_id)
    except RunNotAvailable as exc:
        raise HTTPException(exc.status_code, exc.message)
    return _payload_for(db, project, run)


@router.post("/resolve-qr")
def resolve_qr(data: ResolveQRRequest, db: Session = Depends(get_db)):
    """Public on purpose: the QR itself is the permission (read-only, one project).
    It works for your own projects, other people's, or one shown on a screen."""
    try:
        project_id, token = parse_qr_text(data.qr_text)
        project, row = resolve_token(db, project_id, token)
    except QRError as exc:
        raise HTTPException(exc.status_code, exc.message)

    try:
        run = select_run(db, project)
    except RunNotAvailable as exc:
        raise HTTPException(exc.status_code, exc.message)

    payload = _payload_for(db, project, run)
    payload["access"] = {
        "method": "qr",
        "expires_at": row.expires_at.isoformat() if row.expires_at else None,
    }
    return payload