from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, load_only

from app.api.deps import get_current_user
from app.api.projects import get_owned_project
from app.database.database import get_db
from app.database.models import Dataset, Explanation, Project, TrainingRun, User
from app.services.ar_payload import build_ar_payload, model_label
from app.services.runs import RunNotAvailable, select_run

router = APIRouter(prefix="/api/ar", tags=["ar"])


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

    dataset = db.get(Dataset, run.dataset_id)
    explanation = db.scalar(select(Explanation).where(Explanation.run_id == run.id))
    return build_ar_payload(project, dataset, run, explanation.payload if explanation else None)