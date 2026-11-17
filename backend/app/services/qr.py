import base64
import hashlib
import hmac
import io
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlencode, urlparse

import qrcode
import qrcode.constants
import qrcode.image.svg
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.models import Project, QRAccessToken, utc_now

INVALID_MESSAGE = "This QR code is not valid."


class QRError(Exception):
    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _aware(value: datetime) -> datetime:
    """SQLite hands back datetimes without a timezone; treat them as UTC."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _signature(token_id: str, project_id: str) -> str:
    """Only the server (which knows SECRET_KEY) can produce this."""
    digest = hmac.new(
        settings.secret_key.encode(), f"qr:{token_id}:{project_id}".encode(), hashlib.sha256
    ).digest()
    return base64.urlsafe_b64encode(digest)[:22].decode()


def build_token(row: QRAccessToken) -> str:
    return f"{row.id}.{_signature(row.id, row.project_id)}"


def build_qr_text(row: QRAccessToken) -> str:
    query = urlencode({"p": row.project_id, "t": build_token(row)})
    return f"{settings.qr_link_base}?{query}"


def render_qr_svg(text: str) -> str:
    image = qrcode.make(
        text,
        image_factory=qrcode.image.svg.SvgPathImage,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    buffer = io.BytesIO()
    image.save(buffer)
    svg = buffer.getvalue().decode("utf-8")
    return svg[svg.index("<svg"):]  # drop the XML header so it can be embedded in HTML


# ------------------------------------------------------------ owner side
def _new_token_row(project: Project, now: datetime) -> QRAccessToken:
    expires = now + timedelta(days=settings.qr_token_days) if settings.qr_token_days > 0 else None
    return QRAccessToken(id=secrets.token_urlsafe(16), project_id=project.id, expires_at=expires)


def get_or_create_active_token(db: Session, project: Project) -> QRAccessToken:
    now = utc_now()
    rows = db.scalars(
        select(QRAccessToken)
        .where(QRAccessToken.project_id == project.id, QRAccessToken.revoked_at.is_(None))
        .order_by(QRAccessToken.created_at.desc())
    ).all()
    for row in rows:
        if row.expires_at is None or _aware(row.expires_at) > now:
            return row

    row = _new_token_row(project, now)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def regenerate_token(db: Session, project: Project) -> QRAccessToken:
    """Cancels every active QR for this project and issues a new one."""
    now = utc_now()
    for row in db.scalars(
        select(QRAccessToken).where(
            QRAccessToken.project_id == project.id, QRAccessToken.revoked_at.is_(None)
        )
    ).all():
        row.revoked_at = now

    new_row = _new_token_row(project, now)
    db.add(new_row)
    db.commit()
    db.refresh(new_row)
    return new_row


# ------------------------------------------------------------ scanner side
def parse_qr_text(text: str) -> tuple[str, str]:
    try:
        query = parse_qs(urlparse(text.strip()).query)
        return query["p"][0], query["t"][0]
    except (KeyError, IndexError, ValueError):
        raise QRError(INVALID_MESSAGE, 404)


def resolve_token(db: Session, project_id: str, token: str) -> tuple[Project, QRAccessToken]:
    token_id, dot, signature = token.partition(".")
    if not dot or not token_id or not signature:
        raise QRError(INVALID_MESSAGE, 404)

    row = db.get(QRAccessToken, token_id)
    # Unknown token, wrong project or bad signature all give the SAME answer,
    # so an attacker can't learn which tokens exist.
    if (
        row is None
        or row.project_id != project_id
        or not hmac.compare_digest(signature.encode(), _signature(row.id, row.project_id).encode())
    ):
        raise QRError(INVALID_MESSAGE, 404)

    now = utc_now()
    if row.revoked_at is not None:
        raise QRError("This QR code has been revoked by its owner.", 410)
    if row.expires_at is not None and _aware(row.expires_at) <= now:
        raise QRError("This QR code has expired.", 410)

    project = db.get(Project, project_id)
    if project is None:
        raise QRError(INVALID_MESSAGE, 404)

    row.last_used_at = now
    row.use_count = (row.use_count or 0) + 1
    db.commit()
    return project, row