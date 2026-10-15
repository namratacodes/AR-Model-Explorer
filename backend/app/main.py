from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, datasets, health, models, projects, training
from app.core.config import settings
from app.database import models as db_models  # noqa: F401  (registers the tables)
from app.database.database import Base, engine
from app.services.training_service import mark_interrupted_runs

Base.metadata.create_all(bind=engine)
mark_interrupted_runs()

app = FastAPI(title=settings.app_name, debug=settings.debug)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(datasets.router)
app.include_router(models.router)
app.include_router(training.router)