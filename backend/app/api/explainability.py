from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.database import get_db
from app.database.models import Explanation, Project, TrainingRun, User

router = APIRouter(prefix="/api/explainability", tags=["explainability"])


@router.get("/runs/{run_id}")
def get_run_explanations(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Same ownership rule as everywhere: reach the run THROUGH its project.
    run = db.scalar(
        select(TrainingRun)
        .join(Project, TrainingRun.project_id == Project.id)
        .where(TrainingRun.id == run_id, Project.user_id == current_user.id)
    )
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Training run not found")
    if run.status != "completed":
        raise HTTPException(status.HTTP_409_CONFLICT, "This training run has not completed.")

    explanation = db.scalar(select(Explanation).where(Explanation.run_id == run.id))
    if explanation is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No explanations exist for this run (clustering and PCA runs have none, "
            "and runs trained before explanations were added don't either).",
        )
    return {"run_id": run.id, "model_type": run.model_type, **explanation.payload}