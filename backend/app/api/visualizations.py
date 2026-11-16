from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.projects import get_owned_project
from app.database.database import get_db
from app.database.models import Explanation, TrainingRun, User
from app.services.ar_payload import (
    HEADLINE, LOWER_IS_BETTER, METRIC_CARDS, NO_BEST, model_label,
)
from app.services.runs import RunNotAvailable, select_run

router = APIRouter(prefix="/api/projects", tags=["visualizations"])


@router.get("/{project_id}/visualizations")
def get_visualizations(
    project_id: str,
    run_id: str | None = Query(None, description="Defaults to the latest completed run"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full data for the web charts (the AR payload is a trimmed version of the same numbers)."""
    project = get_owned_project(project_id, db, current_user)
    try:
        run = select_run(db, project, run_id)
    except RunNotAvailable as exc:
        raise HTTPException(exc.status_code, exc.message)

    explanation = db.scalar(select(Explanation).where(Explanation.run_id == run.id))
    return {
        "project": {"id": project.id, "name": project.name},
        "run": {
            "id": run.id,
            "model_type": run.model_type,
            "model_label": model_label(run.model_type),
            "task": run.task_type,
            "hyperparameters": run.hyperparameters,
            "created_at": run.created_at,
            "duration_s": run.duration_s,
        },
        "headline_metric": HEADLINE.get(run.task_type),
        "summary": run.summary,
        "metrics": run.metrics,
        "explanations": explanation.payload if explanation else None,
    }


@router.get("/{project_id}/compare")
def compare_runs(
    project_id: str,
    run_ids: list[str] = Query(..., description="Repeat the parameter: run_ids=a&run_ids=b"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_owned_project(project_id, db, current_user)

    ordered_ids = list(dict.fromkeys(run_ids))  # remove duplicates, keep the order
    if not 2 <= len(ordered_ids) <= 6:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Choose between 2 and 6 different runs.")

    runs = db.scalars(
        select(TrainingRun).where(
            TrainingRun.id.in_(ordered_ids), TrainingRun.project_id == project.id
        )
    ).all()
    by_id = {r.id: r for r in runs}
    if len(by_id) != len(ordered_ids):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "One or more runs were not found in this project.")
    if any(r.status != "completed" for r in runs):
        raise HTTPException(status.HTTP_409_CONFLICT, "All runs must be completed to compare them.")

    tasks = {r.task_type for r in runs}
    if len(tasks) > 1:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Only runs of the same kind can be compared (got: {', '.join(sorted(tasks))}).",
        )
    task = tasks.pop()

    def scores_of(run):
        return (run.metrics or {}).get("scores", {})

    columns = [
        (key, label, fmt)
        for key, label, fmt, _ in METRIC_CARDS.get(task, [])
        if any(scores_of(r).get(key) is not None for r in runs)
    ]

    rows = []
    for rid in ordered_ids:
        run = by_id[rid]
        rows.append(
            {
                "run_id": run.id,
                "model_type": run.model_type,
                "model_label": model_label(run.model_type),
                "hyperparameters": run.hyperparameters,
                "dataset_id": run.dataset_id,
                "created_at": run.created_at,
                "duration_s": run.duration_s,
                "scores": {key: scores_of(run).get(key) for key, _, _ in columns},
            }
        )

    best = {}
    for key, _, _ in columns:
        if key in NO_BEST:
            continue
        candidates = [(scores_of(r)[key], r.id) for r in runs if scores_of(r).get(key) is not None]
        pick = min if key in LOWER_IS_BETTER else max
        best[key] = pick(candidates)[1]

    return {
        "task": task,
        "same_dataset": len({r.dataset_id for r in runs}) == 1,
        "metrics": [
            {"key": key, "label": label, "format": fmt, "lower_is_better": key in LOWER_IS_BETTER}
            for key, label, fmt in columns
        ],
        "runs": rows,
        "best": best,
    }