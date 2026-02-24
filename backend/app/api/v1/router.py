"""
API V1 Router Configuration.

This module aggregates all v1 endpoint routers into a single router
that can be mounted on the main FastAPI application.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import analysis, auth, backtest, strategies

# Create the main v1 API router
api_router = APIRouter(prefix="/api/v1")

# Include all endpoint routers
api_router.include_router(auth.router)
api_router.include_router(strategies.router)
api_router.include_router(backtest.router)
api_router.include_router(analysis.router)

