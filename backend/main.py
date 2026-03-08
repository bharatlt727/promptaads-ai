"""FastAPI application factory for PromptAds AI."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from db.session import engine
from engine.vector_store import VectorStoreService

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup: ensure Qdrant collection. Shutdown: dispose DB engine."""
    logger.info("starting", app=settings.app_name, debug=settings.debug)
    try:
        vs = VectorStoreService()
        vs.ensure_collection()
    except Exception:
        logger.warning("qdrant_unavailable_at_startup", exc_info=True)
    yield
    await engine.dispose()
    logger.info("shutdown_complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description="AI-native contextual advertising engine",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── Middleware ────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.backend_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ──────────────────────────────────────────
    from api.auth import router as auth_router
    from api.ads import router as ads_router
    from api.engine import router as engine_router
    from api.analytics import router as analytics_router

    app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
    app.include_router(ads_router, prefix="/ads", tags=["Ads"])
    app.include_router(engine_router, prefix="/engine", tags=["Engine"])
    app.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])

    # ── Health check ─────────────────────────────────────
    @app.get("/health", tags=["Health"])
    async def health_check():
        return {"status": "healthy", "service": "promptads-ai"}

    return app


app = create_app()
