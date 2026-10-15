from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.database.models import User
from app.ml.model_registry import list_models

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
def list_available_models(task: str | None = None, _: User = Depends(get_current_user)):
    return [spec.describe() for spec in list_models(task)]