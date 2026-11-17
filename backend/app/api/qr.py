from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.projects import get_owned_project
from app.database.database import get_db
from app.database.models import Project, QRAccessToken, User
from app.services.qr import (
    build_qr_text,
    get_or_create_active_token,
    regenerate_token,
    render_qr_svg,
)
from app.services.runs import RunNotAvailable, select_run

router = APIRouter(prefix="/api/projects", tags=["qr"])


def _ready_project(project_id: str, db: Session, user: User) -> Project:
    """A QR only makes sense once the project has a trained model to show."""
    project = get_owned_project(project_id, db, user)
    try:
        select_run(db, project)
    except RunNotAvailable:
        raise HTTPException(
            404, "Train a model first: the QR code is available once the project has results."
        )
    return project


def _qr_response(row: QRAccessToken) -> dict:
    text = build_qr_text(row)
    return {
        "project_id": row.project_id,
        "qr_text": text,
        "svg": render_qr_svg(text),
        "created_at": row.created_at,
        "expires_at": row.expires_at,
    }


@router.get("/{project_id}/qr")
def get_project_qr(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _ready_project(project_id, db, current_user)
    return _qr_response(get_or_create_active_token(db, project))


@router.get("/{project_id}/qr.svg")
def get_project_qr_image(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _ready_project(project_id, db, current_user)
    row = get_or_create_active_token(db, project)
    return Response(render_qr_svg(build_qr_text(row)), media_type="image/svg+xml")


@router.post("/{project_id}/qr/regenerate")
def regenerate_project_qr(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Old QR codes (including printed ones) stop working immediately."""
    project = _ready_project(project_id, db, current_user)
    return _qr_response(regenerate_token(db, project))