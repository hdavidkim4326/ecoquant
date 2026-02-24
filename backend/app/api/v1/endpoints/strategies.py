"""
Strategy Endpoints.

This module provides CRUD endpoints for trading strategies:
- Create new strategies
- List user's strategies
- Get strategy details
- Update strategy configuration
- Delete strategies

All endpoints require authentication.
"""

from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.exceptions import (
    InsufficientPermissionsError,
    StrategyNotFoundError,
    to_http_exception,
)
from app.core.security import get_current_user_id
from app.models.strategy import Strategy, StrategyStatus, StrategyType
from app.schemas.strategy import (
    StrategyCreate,
    StrategyListResponse,
    StrategyResponse,
    StrategyUpdate,
    StrategyWithLatestBacktest,
)

router = APIRouter(prefix="/strategies", tags=["Strategies"])


async def get_strategy_or_404(
    strategy_id: int,
    user_id: int,
    db: AsyncSession,
    check_ownership: bool = True,
) -> Strategy:
    """
    Helper to get a strategy by ID with ownership check.
    
    Args:
        strategy_id: The strategy ID to fetch.
        user_id: Current user's ID.
        db: Database session.
        check_ownership: Whether to verify the user owns this strategy.
    
    Returns:
        Strategy object if found and accessible.
    
    Raises:
        StrategyNotFoundError: If strategy doesn't exist.
        InsufficientPermissionsError: If user doesn't own the strategy.
    """
    strategy = await db.get(Strategy, strategy_id)
    
    if not strategy:
        raise to_http_exception(StrategyNotFoundError(strategy_id=strategy_id))
    
    if check_ownership and strategy.user_id != user_id:
        raise to_http_exception(InsufficientPermissionsError("own this strategy"))
    
    return strategy


@router.post(
    "",
    response_model=StrategyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new strategy",
)
async def create_strategy(
    strategy_data: StrategyCreate,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Strategy:
    """
    Create a new trading strategy.
    
    - **name**: Display name for the strategy
    - **strategy_type**: Type of strategy (sma_crossover, rsi, etc.)
    - **symbols**: Comma-separated list of tickers (e.g., "AAPL,MSFT")
    - **logic_config**: Strategy-specific parameters as JSON
    
    Example logic_config for SMA Crossover:
    ```json
    {
        "fast_period": 50,
        "slow_period": 200,
        "position_size": 0.95
    }
    ```
    """
    # Set default symbols if not provided
    DEFAULT_SYMBOL = "AAPL"
    symbols = strategy_data.symbols
    if not symbols or not symbols.strip():
        symbols = DEFAULT_SYMBOL
    
    strategy = Strategy(
        user_id=user_id,
        name=strategy_data.name,
        description=strategy_data.description,
        strategy_type=strategy_data.strategy_type,
        status=strategy_data.status,
        symbols=symbols,
        logic_config=strategy_data.logic_config,
    )
    
    db.add(strategy)
    await db.commit()
    await db.refresh(strategy)
    
    return strategy


@router.get(
    "",
    response_model=StrategyListResponse,
    summary="List user's strategies",
)
async def list_strategies(
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    status_filter: Annotated[Optional[StrategyStatus], Query(alias="status")] = None,
    type_filter: Annotated[Optional[StrategyType], Query(alias="type")] = None,
    search: Annotated[Optional[str], Query(max_length=100)] = None,
) -> StrategyListResponse:
    """
    Get a paginated list of the current user's strategies.
    
    Supports filtering by status, type, and name search.
    """
    # Build base query
    query = select(Strategy).where(Strategy.user_id == user_id)
    
    # Apply filters
    if status_filter:
        query = query.where(Strategy.status == status_filter)
    
    if type_filter:
        query = query.where(Strategy.strategy_type == type_filter)
    
    if search:
        query = query.where(Strategy.name.ilike(f"%{search}%"))
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.order_by(Strategy.updated_at.desc()).offset(offset).limit(page_size)
    
    # Execute query
    result = await db.execute(query)
    strategies = list(result.scalars().all())
    
    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size
    
    # Build response with backtest counts
    items = []
    for strategy in strategies:
        response = StrategyResponse.model_validate(strategy)
        response.backtest_count = len(strategy.backtest_results) if strategy.backtest_results else 0
        items.append(response)
    
    return StrategyListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/{strategy_id}",
    response_model=StrategyWithLatestBacktest,
    summary="Get strategy details",
)
async def get_strategy(
    strategy_id: int,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StrategyWithLatestBacktest:
    """
    Get detailed information about a specific strategy.
    
    Includes the latest backtest result summary if available.
    """
    strategy = await get_strategy_or_404(strategy_id, user_id, db)
    
    response = StrategyWithLatestBacktest.model_validate(strategy)
    response.backtest_count = len(strategy.backtest_results) if strategy.backtest_results else 0
    
    # Add latest backtest summary
    if strategy.backtest_results:
        latest = strategy.backtest_results[0]  # Already ordered by created_at desc
        response.latest_backtest = latest.to_summary_dict()
    
    return response


@router.patch(
    "/{strategy_id}",
    response_model=StrategyResponse,
    summary="Update strategy",
)
async def update_strategy(
    strategy_id: int,
    strategy_update: StrategyUpdate,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Strategy:
    """
    Update an existing strategy.
    
    Only provided fields will be updated (partial update).
    """
    strategy = await get_strategy_or_404(strategy_id, user_id, db)
    
    # Update only provided fields
    update_data = strategy_update.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if value is not None:
            setattr(strategy, field, value)
    
    await db.commit()
    await db.refresh(strategy)
    
    return strategy


@router.delete(
    "/{strategy_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete strategy",
)
async def delete_strategy(
    strategy_id: int,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """
    Delete a strategy and all its associated backtest results.
    
    This action cannot be undone.
    """
    strategy = await get_strategy_or_404(strategy_id, user_id, db)
    
    await db.delete(strategy)
    await db.commit()


@router.post(
    "/{strategy_id}/duplicate",
    response_model=StrategyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Duplicate strategy",
)
async def duplicate_strategy(
    strategy_id: int,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Strategy:
    """
    Create a copy of an existing strategy.
    
    The new strategy will be in DRAFT status with "(Copy)" appended to the name.
    """
    original = await get_strategy_or_404(strategy_id, user_id, db)
    
    new_strategy = Strategy(
        user_id=user_id,
        name=f"{original.name} (Copy)",
        description=original.description,
        strategy_type=original.strategy_type,
        status=StrategyStatus.DRAFT,
        symbols=original.symbols,
        logic_config=original.logic_config.copy(),
    )
    
    db.add(new_strategy)
    await db.commit()
    await db.refresh(new_strategy)
    
    return new_strategy


@router.get(
    "/types/available",
    response_model=List[dict],
    summary="Get available strategy types",
)
async def get_strategy_types() -> List[dict]:
    """
    Get a list of all available strategy types with descriptions.
    
    Useful for populating strategy type selection dropdowns.
    """
    return [
        {
            "type": StrategyType.SMA_CROSSOVER,
            "name": "SMA Crossover",
            "description": "Buy when fast SMA crosses above slow SMA, sell on the opposite",
            "params": ["fast_period", "slow_period"],
        },
        {
            "type": StrategyType.EMA_CROSSOVER,
            "name": "EMA Crossover",
            "description": "Similar to SMA but uses Exponential Moving Averages",
            "params": ["fast_period", "slow_period"],
        },
        {
            "type": StrategyType.RSI,
            "name": "RSI",
            "description": "Buy when RSI is oversold, sell when overbought",
            "params": ["period", "oversold", "overbought"],
        },
        {
            "type": StrategyType.MACD,
            "name": "MACD",
            "description": "Trade based on MACD histogram crossovers",
            "params": ["fast_period", "slow_period", "signal_period"],
        },
        {
            "type": StrategyType.BOLLINGER_BANDS,
            "name": "Bollinger Bands",
            "description": "Mean reversion strategy using Bollinger Bands",
            "params": ["period", "std_dev"],
        },
        {
            "type": StrategyType.DCA,
            "name": "Dollar Cost Averaging",
            "description": "Invest fixed amounts at regular intervals",
            "params": ["investment_amount", "frequency"],
        },
        {
            "type": StrategyType.MOMENTUM,
            "name": "Momentum",
            "description": "Buy assets showing strong upward momentum",
            "params": ["lookback_period", "threshold"],
        },
        {
            "type": StrategyType.CUSTOM,
            "name": "Custom",
            "description": "User-defined custom strategy",
            "params": [],
        },
    ]

