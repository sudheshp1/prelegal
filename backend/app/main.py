"""FastAPI entry point: the JSON API under /api plus the statically exported frontend."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from . import auth
from .db import init_db

DEFAULT_STATIC_DIR = Path(__file__).resolve().parents[2] / "frontend" / "out"


def static_dir() -> Path:
    return Path(os.environ.get("PRELEGAL_STATIC_DIR", DEFAULT_STATIC_DIR))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Prelegal", lifespan=lifespan)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router)

    # Mounted last so the API routes above take precedence. Skipped when the
    # frontend has not been built, e.g. when running the API on its own.
    frontend = static_dir()
    if frontend.is_dir():
        app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")

    return app


app = create_app()
