from pathlib import Path

from app.core.config import settings


def _dataset_dir() -> Path:
    folder = Path(settings.storage_dir) / "datasets"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def dataset_path(storage_name: str) -> Path:
    return _dataset_dir() / storage_name


def save_dataset_file(storage_name: str, raw: bytes) -> None:
    dataset_path(storage_name).write_bytes(raw)


def delete_dataset_file(storage_name: str) -> None:
    dataset_path(storage_name).unlink(missing_ok=True)