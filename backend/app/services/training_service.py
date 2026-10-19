import logging
import time

from sqlalchemy import select

from app.database.database import SessionLocal
from app.database.models import Dataset, Project, TrainingRun, utc_now
from app.ml.model_registry import ParamError
from app.ml.profiling import DatasetValidationError, load_dataframe
from app.ml.training import TrainingError, train_model
from app.services.storage import dataset_path, save_model_artifact

logger = logging.getLogger(__name__)


def mark_interrupted_runs() -> None:
    """If the server restarted mid-training, those runs can never finish.
    (Single-process development setup; a job queue replaces this in production.)"""
    with SessionLocal() as db:
        runs = db.scalars(
            select(TrainingRun).where(TrainingRun.status.in_(["queued", "running"]))
        ).all()
        for run in runs:
            run.status = "failed"
            run.error_message = "Interrupted by a server restart. Please train again."
        db.commit()


def execute_run(run_id: str) -> None:
    db = SessionLocal()  # background jobs need their own database session
    try:
        run = db.get(TrainingRun, run_id)
        if run is None:
            return
        run.status = "running"
        run.started_at = utc_now()
        db.commit()

        started = time.perf_counter()
        try:
            dataset = db.get(Dataset, run.dataset_id)
            df = load_dataframe(dataset_path(dataset.storage_name))
            outcome = train_model(
                df, dataset.target_column, run.model_type,
                run.hyperparameters, run.test_size, run.random_state,
            )
            artifact_name = f"{run.id}.joblib"
            run.artifact_sha256 = save_model_artifact(artifact_name, outcome.pipeline)
            run.artifact_name = artifact_name
            run.metrics = outcome.metrics
            run.summary = outcome.summary
            run.status = "completed"
        except (TrainingError, ParamError, DatasetValidationError) as exc:
            run.status = "failed"
            run.error_message = str(exc)
        except Exception:
            logger.exception("Training run %s crashed", run_id)
            run.status = "failed"
            run.error_message = "Training failed unexpectedly. Check the server logs."

        run.duration_s = round(time.perf_counter() - started, 3)
        run.finished_at = utc_now()
        if run.status == "completed":
            project = db.get(Project, run.project_id)
            if project:
                project.status = "trained"
        db.commit()
    finally:
        db.close()