from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DatasetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    original_filename: str
    file_size_bytes: int
    n_rows: int
    n_cols: int
    target_column: str | None
    profile: dict
    target_info: dict | None
    created_at: datetime


class TargetUpdate(BaseModel):
    # null clears the target (useful later for clustering/PCA).
    target_column: str | None = Field(default=None, max_length=255)


class DatasetPreview(BaseModel):
    columns: list[str]
    rows: list[dict]
    total_rows: int