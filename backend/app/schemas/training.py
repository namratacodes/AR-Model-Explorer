from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TrainRequest(BaseModel):
    dataset_id: str
    model_type: str = Field(max_length=50)
    hyperparameters: dict[str, Any] = Field(default_factory=dict)
    test_size: float = Field(0.2, ge=0.1, le=0.5)
    random_state: int = Field(42, ge=0, le=2_147_483_647)


class TrainingRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    dataset_id: str
    model_type: str
    task_type: str
    hyperparameters: dict
    test_size: float
    random_state: int
    status: str
    metrics: dict | None
    summary: dict | None
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    duration_s: float | None