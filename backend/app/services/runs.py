from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import Project, TrainingRun


class RunNotAvailable(Exception):
    def __init__(self, message: str, status_code: int = 404):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def select_run(db: Session, project: Project, run_id: str | None = None) -> TrainingRun:
    if run_id:
        run = db.scalar(
            select(TrainingRun).where(TrainingRun.id == run_id, TrainingRun.project_id == project.id)
        )
        if run is None:
            raise RunNotAvailable("Training run not found in this project", 404)
        if run.status != "completed":
            raise RunNotAvailable("This training run has not completed.", 409)
        return run

    run = db.scalar(
        select(TrainingRun)
        .where(TrainingRun.project_id == project.id, TrainingRun.status == "completed")
        .order_by(TrainingRun.created_at.desc())
        .limit(1)
    )
    if run is None:
        raise RunNotAvailable("This project has no trained model yet.", 404)
    return run