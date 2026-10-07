from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, health, projects
from app.core.config import settings
from app.database import models  # noqa: F401  (importing registers the tables)
from app.database.database import Base, engine

# Creates any missing tables. Fine for development; later we can switch to
# proper migrations when we move to PostgreSQL.
Base.metadata.create_all(bind=engine)

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