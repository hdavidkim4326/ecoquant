"""
EcoQuant Backend - FastAPI Application Entry Point.

This is the main entry point for the FastAPI application.
It configures middleware, exception handlers, and mounts all routers.

Run with:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import api_router
from app.core.config import settings
from app.core.database import check_database_health, create_all_tables, dispose_engine
from app.core.exceptions import EcoQuantException, to_http_exception

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager.
    
    Handles startup and shutdown events for the application.
    - Startup: Initialize database, run migrations, etc.
    - Shutdown: Close database connections, cleanup resources.
    """
    # =========================================================================
    # STARTUP
    # =========================================================================
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.APP_ENV}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    
    # Create database tables (development only)
    if settings.is_development:
        try:
            await create_all_tables()
            logger.info("Database tables created/verified")
        except Exception as e:
            logger.warning(f"Could not create tables: {e}")
    
    # Check database connectivity
    try:
        health = await check_database_health()
        logger.info(f"Database health: {health}")
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        if settings.is_production:
            raise  # Fail startup in production if DB is unavailable
    
    logger.info("Application startup complete")
    
    yield
    
    # =========================================================================
    # SHUTDOWN
    # =========================================================================
    logger.info("Shutting down application...")
    
    # Close database connections
    await dispose_engine()
    logger.info("Database connections closed")
    
    logger.info("Application shutdown complete")


# =============================================================================
# Create FastAPI Application
# =============================================================================

app = FastAPI(
    title=settings.APP_NAME,
    description="""
## EcoQuant - 퀀트 투자 플랫폼 API

상용 수준의 퀀트 투자 백테스팅 및 전략 관리 플랫폼입니다.

### 주요 기능

* **인증 (Auth)** - JWT 기반 사용자 인증
* **전략 관리 (Strategies)** - 트레이딩 전략 CRUD
* **백테스팅 (Backtest)** - 비동기 백테스트 실행 및 결과 조회

### 기술 스택

* FastAPI + SQLAlchemy 2.0 (Async)
* PostgreSQL + Redis
* Backtrader (퀀트 엔진)
* Celery (비동기 작업)
    """,
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)


# =============================================================================
# Middleware Configuration
# =============================================================================

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)


# =============================================================================
# Exception Handlers
# =============================================================================

@app.exception_handler(EcoQuantException)
async def ecoquant_exception_handler(
    request: Request,
    exc: EcoQuantException,
) -> JSONResponse:
    """
    Handle all custom EcoQuant exceptions.
    
    Converts exceptions to appropriate HTTP responses.
    """
    http_exc = to_http_exception(exc)
    return JSONResponse(
        status_code=http_exc.status_code,
        content={"detail": http_exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """
    Handle Pydantic validation errors with detailed messages.
    """
    errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        errors.append({
            "field": field,
            "message": error["msg"],
            "type": error["type"],
        })
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": {
                "error": "ValidationError",
                "message": "Request validation failed",
                "errors": errors,
            }
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """
    Catch-all exception handler for unhandled errors.
    
    Logs the full exception in development, returns generic error in production.
    """
    logger.exception(f"Unhandled exception: {exc}")
    
    if settings.DEBUG:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": {
                    "error": type(exc).__name__,
                    "message": str(exc),
                }
            },
        )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": {
                "error": "InternalServerError",
                "message": "An unexpected error occurred",
            }
        },
    )


# =============================================================================
# Include Routers
# =============================================================================

app.include_router(api_router)


# =============================================================================
# Health Check Endpoints
# =============================================================================

@app.get(
    "/health",
    tags=["Health"],
    summary="Basic health check",
)
async def health_check() -> dict:
    """
    Basic health check endpoint.
    
    Returns application status and version info.
    """
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
    }


@app.get(
    "/health/ready",
    tags=["Health"],
    summary="Readiness check with dependencies",
)
async def readiness_check() -> dict:
    """
    Readiness check that verifies all dependencies.
    
    Checks database and Redis connectivity.
    Returns detailed status for each dependency.
    """
    checks = {
        "app": "healthy",
        "database": "unknown",
        "redis": "unknown",
    }
    
    # Check database
    try:
        await check_database_health()
        checks["database"] = "healthy"
    except Exception as e:
        checks["database"] = f"unhealthy: {str(e)}"
    
    # Check Redis (placeholder - implement actual check)
    # try:
    #     from app.core.redis import check_redis_health
    #     await check_redis_health()
    #     checks["redis"] = "healthy"
    # except Exception as e:
    #     checks["redis"] = f"unhealthy: {str(e)}"
    checks["redis"] = "not configured"
    
    # Overall status
    all_healthy = all(
        v == "healthy" or v == "not configured"
        for v in checks.values()
    )
    
    return {
        "status": "ready" if all_healthy else "not ready",
        "checks": checks,
    }


# =============================================================================
# Root Endpoint
# =============================================================================

@app.get(
    "/",
    tags=["Root"],
    include_in_schema=False,
)
async def root() -> dict:
    """Root endpoint with API information."""
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "version": settings.APP_VERSION,
        "docs": "/docs" if settings.DEBUG else "Disabled in production",
        "health": "/health",
    }

