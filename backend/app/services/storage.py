import hashlib
import io
from pathlib import Path

import joblib

from app.core.config import settings


def _folder(name: str) -> Path:
    folder = Path(settings.storage_dir) / name
    folder.mkdir(parents=True, exist_ok=True)
    return folder


# ---------- datasets ----------
def dataset_path(storage_name: str) -> Path:
    return _folder("datasets") / storage_name


def save_dataset_file(storage_name: str, raw: bytes) -> None:
    dataset_path(storage_name).write_bytes(raw)


def delete_dataset_file(storage_name: str) -> None:
    dataset_path(storage_name).unlink(missing_ok=True)


# ---------- trained models ----------
def _model_path(storage_name: str) -> Path:
    return _folder("models") / storage_name


def save_model_artifact(storage_name: str, obj) -> str:
    """Saves a fitted model and returns its SHA-256 checksum."""
    path = _model_path(storage_name)
    joblib.dump(obj, path)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_model_artifact(storage_name: str, expected_sha256: str):
    """Loads a model ONLY if its checksum matches what we recorded when we saved it."""
    data = _model_path(storage_name).read_bytes()
    if hashlib.sha256(data).hexdigest() != expected_sha256:
        raise ValueError("Model file failed its integrity check.")
    return joblib.load(io.BytesIO(data))


def delete_model_artifact(storage_name: str) -> None:
    _model_path(storage_name).unlink(missing_ok=True)