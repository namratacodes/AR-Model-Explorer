from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.database import get_db
from app.database.models import Project, TrainingRun, User
from app.services.ar_payload import model_label

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    uid = current_user.id

    total_projects = db.scalar(select(func.count(Project.id)).where(Project.user_id == uid)) or 0

    total_runs = db.scalar(
        select(func.count(TrainingRun.id))
        .select_from(TrainingRun)
        .join(Project, TrainingRun.project_id == Project.id)
        .where(Project.user_id == uid)
    ) or 0

    completed_runs = db.scalar(
        select(func.count(TrainingRun.id))
        .select_from(TrainingRun)
        .join(Project, TrainingRun.project_id == Project.id)
        .where(Project.user_id == uid, TrainingRun.status == "completed")
    ) or 0

    usage_rows = db.execute(
        select(TrainingRun.model_type, func.count(TrainingRun.id).label("n"))
        .select_from(TrainingRun)
        .join(Project, TrainingRun.project_id == Project.id)
        .where(Project.user_id == uid)
        .group_by(TrainingRun.model_type)
        .order_by(func.count(TrainingRun.id).desc())
    ).all()

    # Only a few columns: we don't need the big metrics JSON here.
    recent_rows = db.execute(
        select(
            TrainingRun.id.label("run_id"),
            TrainingRun.project_id,
            Project.name.label("project_name"),
            TrainingRun.model_type,
            TrainingRun.task_type,
            TrainingRun.status,
            TrainingRun.created_at,
        )
        .select_from(TrainingRun)
        .join(Project, TrainingRun.project_id == Project.id)
        .where(Project.user_id == uid)
        .order_by(TrainingRun.created_at.desc())
        .limit(5)
    ).all()

    return {
        "total_projects": total_projects,
        "total_runs": total_runs,
        "completed_runs": completed_runs,
        "models_used": [
            {"model_type": r.model_type, "label": model_label(r.model_type), "count": r.n}
            for r in usage_rows
        ],
        "recent_runs": [
            {
                "run_id": r.run_id,
                "project_id": r.project_id,
                "project_name": r.project_name,
                "model_type": r.model_type,
                "model_label": model_label(r.model_type),
                "task": r.task_type,
                "status": r.status,
                "created_at": r.created_at,
            }
            for r in recent_rows
        ],
    }