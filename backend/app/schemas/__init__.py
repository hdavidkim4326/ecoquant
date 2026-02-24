"""
Pydantic Schema Definitions Package.

This package contains all Pydantic models (DTOs) for API
request validation and response serialization.

Schemas follow a consistent naming convention:
- Base: Shared fields for create/update
- Create: Fields required for creating a resource
- Update: Fields that can be updated (all optional)
- Response: Full resource representation for API responses

Usage:
    from app.schemas import StrategyCreate, StrategyResponse
"""

from app.schemas.user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserResponse,
    UserLogin,
)
from app.schemas.strategy import (
    StrategyBase,
    StrategyCreate,
    StrategyUpdate,
    StrategyResponse,
    StrategyListResponse,
)
from app.schemas.backtest import (
    BacktestRequest,
    BacktestStatusResponse,
    BacktestResultResponse,
    BacktestListResponse,
    BacktestMetrics,
)

__all__ = [
    # User schemas
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserLogin",
    # Strategy schemas
    "StrategyBase",
    "StrategyCreate",
    "StrategyUpdate",
    "StrategyResponse",
    "StrategyListResponse",
    # Backtest schemas
    "BacktestRequest",
    "BacktestStatusResponse",
    "BacktestResultResponse",
    "BacktestListResponse",
    "BacktestMetrics",
]

