"""
Backtest Endpoints.

This module provides endpoints for running and managing backtests:
- Start a new backtest (async via Celery)
- Check backtest status
- Get backtest results
- List backtest history
- Compare multiple backtests

Backtests are processed asynchronously using Celery workers.
"""

from datetime import datetime, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import (
    BacktestNotFoundError,
    InsufficientPermissionsError,
    StrategyNotFoundError,
    to_http_exception,
)
from app.core.security import get_current_user_id
from app.models.backtest import BacktestResult, BacktestStatus
from app.models.strategy import Strategy
from app.schemas.backtest import (
    BacktestCompareRequest,
    BacktestCompareResponse,
    BacktestListItem,
    BacktestListResponse,
    BacktestMetrics,
    BacktestRequest,
    BacktestResultResponse,
    BacktestStatusResponse,
    EquityCurvePoint,
    TradeRecord,
)

# Import Celery task
from app.worker import run_backtest_task

router = APIRouter(prefix="/backtest", tags=["Backtest"])


async def get_backtest_or_404(
    backtest_id: int,
    user_id: int,
    db: AsyncSession,
) -> BacktestResult:
    """
    Get a backtest result by ID with ownership verification.
    
    Checks that the backtest's strategy belongs to the current user.
    """
    result = await db.execute(
        select(BacktestResult)
        .where(BacktestResult.id == backtest_id)
        .options()  # Can add joinedload for strategy if needed
    )
    backtest = result.scalar_one_or_none()
    
    if not backtest:
        raise to_http_exception(BacktestNotFoundError(backtest_id=backtest_id))
    
    # Get strategy to verify ownership
    strategy = await db.get(Strategy, backtest.strategy_id)
    if not strategy or strategy.user_id != user_id:
        raise to_http_exception(InsufficientPermissionsError("access this backtest"))
    
    return backtest


@router.post(
    "/run",
    response_model=BacktestStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start a new backtest",
)
async def start_backtest(
    request: BacktestRequest,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BacktestStatusResponse:
    """
    Start a new backtest for a strategy.
    
    The backtest runs asynchronously. Use the returned backtest_id
    to poll for status and retrieve results when complete.
    
    - **strategy_id**: ID of the strategy to backtest
    - **start_date**: Backtest period start (YYYY-MM-DD)
    - **end_date**: Backtest period end (YYYY-MM-DD)
    - **initial_capital**: Starting capital (default: 100,000)
    - **commission**: Trading commission rate (default: 0.1%)
    """
    # Verify strategy exists and user owns it
    strategy = await db.get(Strategy, request.strategy_id)
    
    if not strategy:
        raise to_http_exception(StrategyNotFoundError(strategy_id=request.strategy_id))
    
    if strategy.user_id != user_id:
        raise to_http_exception(InsufficientPermissionsError("access this strategy"))
    
    # Create backtest record
    backtest = BacktestResult(
        strategy_id=request.strategy_id,
        start_date=request.start_date,
        end_date=request.end_date,
        initial_capital=request.initial_capital,
        status=BacktestStatus.PENDING,
    )
    
    db.add(backtest)
    await db.commit()
    await db.refresh(backtest)
    
    # Prepare parameters for Celery task
    # Merge strategy config with request overrides, including position_size
    strategy_params = {
        **strategy.logic_config,
        "position_size": request.position_size,  # Apply position size from request
        **(request.config_overrides or {}),
    }
    
    task_params = {
        "backtest_id": backtest.id,
        "strategy_type": strategy.strategy_type.value,
        "symbols": strategy.symbols_list,
        "start_date": request.start_date.isoformat(),
        "end_date": request.end_date.isoformat(),
        "initial_capital": float(request.initial_capital),
        "commission": request.commission,
        "strategy_params": strategy_params,
    }
    
    # Queue the backtest task to Celery
    print("🚀 [DEBUG] Celery로 작업 전송 시도 중...")
    print(f"   📋 Task Params: backtest_id={backtest.id}, strategy={strategy.strategy_type.value}")
    
    # Send task to default 'celery' queue explicitly
    task = run_backtest_task.apply_async(
        kwargs=task_params,
        queue='celery',  # Explicitly use default queue
    )
    
    print(f"✅ [DEBUG] 작업 전송 완료! Task ID: {task.id}")
    
    backtest.task_id = task.id
    backtest.status = BacktestStatus.PENDING
    
    await db.commit()
    
    return BacktestStatusResponse(
        backtest_id=backtest.id,
        task_id=task.id,
        status=backtest.status,
        progress=0,
        message="Backtest queued for processing",
        started_at=None,
        estimated_completion=None,
    )


@router.get(
    "/{backtest_id}/status",
    response_model=BacktestStatusResponse,
    summary="Check backtest status",
)
async def get_backtest_status(
    backtest_id: int,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BacktestStatusResponse:
    """
    Get the current status of a backtest.
    
    Poll this endpoint to track progress of running backtests.
    """
    backtest = await get_backtest_or_404(backtest_id, user_id, db)
    
    # In production, we would check Celery task status here
    # from celery.result import AsyncResult
    # if backtest.task_id:
    #     task_result = AsyncResult(backtest.task_id)
    #     # Update status based on task state
    
    progress = None
    if backtest.status == BacktestStatus.RUNNING:
        progress = 50  # Would get from Redis/task meta
    elif backtest.status == BacktestStatus.COMPLETED:
        progress = 100
    
    return BacktestStatusResponse(
        backtest_id=backtest.id,
        task_id=backtest.task_id,
        status=backtest.status,
        progress=progress,
        message=_get_status_message(backtest.status),
        started_at=backtest.started_at,
        estimated_completion=None,
    )


def _get_status_message(status: BacktestStatus) -> str:
    """Get human-readable status message."""
    messages = {
        BacktestStatus.PENDING: "Backtest is queued for processing",
        BacktestStatus.RUNNING: "Backtest is currently running",
        BacktestStatus.COMPLETED: "Backtest completed successfully",
        BacktestStatus.FAILED: "Backtest failed",
        BacktestStatus.CANCELLED: "Backtest was cancelled",
    }
    return messages.get(status, "Unknown status")


@router.get(
    "/{backtest_id}",
    response_model=BacktestResultResponse,
    summary="Get backtest results",
)
async def get_backtest_result(
    backtest_id: int,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    include_equity_curve: bool = Query(True, description="Include daily equity values"),
    include_trades: bool = Query(True, description="Include trade history"),
) -> BacktestResultResponse:
    """
    Get detailed results of a completed backtest.
    
    Returns performance metrics, equity curve, and trade history.
    Only available for completed backtests.
    """
    backtest = await get_backtest_or_404(backtest_id, user_id, db)
    
    # Build metrics object from stored values
    metrics = None
    if backtest.status == BacktestStatus.COMPLETED:
        metrics = BacktestMetrics(
            total_return=float(backtest.total_return) if backtest.total_return else None,
            cagr=float(backtest.cagr) if backtest.cagr else None,
            mdd=float(backtest.mdd) if backtest.mdd else None,
            sharpe_ratio=float(backtest.sharpe_ratio) if backtest.sharpe_ratio else None,
            sortino_ratio=float(backtest.sortino_ratio) if backtest.sortino_ratio else None,
            calmar_ratio=float(backtest.calmar_ratio) if backtest.calmar_ratio else None,
            total_trades=backtest.total_trades,
            winning_trades=backtest.winning_trades,
            losing_trades=backtest.losing_trades,
            win_rate=float(backtest.win_rate) if backtest.win_rate else None,
            avg_win=float(backtest.avg_win) if backtest.avg_win else None,
            avg_loss=float(backtest.avg_loss) if backtest.avg_loss else None,
            profit_factor=float(backtest.profit_factor) if backtest.profit_factor else None,
        )
    
    # Parse equity curve from JSON if requested
    equity_curve = None
    if include_equity_curve and backtest.equity_curve:
        equity_curve = [
            EquityCurvePoint(**point)
            for point in backtest.equity_curve.get("data", [])
        ]
    
    # Parse trades from metrics JSON if requested
    trades = None
    if include_trades and backtest.metrics:
        trades_data = backtest.metrics.get("trades", [])
        trades = [TradeRecord(**trade) for trade in trades_data]
    
    return BacktestResultResponse(
        id=backtest.id,
        strategy_id=backtest.strategy_id,
        task_id=backtest.task_id,
        status=backtest.status,
        start_date=backtest.start_date,
        end_date=backtest.end_date,
        initial_capital=float(backtest.initial_capital),
        final_value=float(backtest.final_value) if backtest.final_value else None,
        metrics=metrics,
        equity_curve=equity_curve,
        trades=trades,
        started_at=backtest.started_at,
        completed_at=backtest.completed_at,
        execution_time_seconds=float(backtest.execution_time_seconds) if backtest.execution_time_seconds else None,
        error_message=backtest.error_message,
        created_at=backtest.created_at,
        updated_at=backtest.updated_at,
    )


@router.get(
    "",
    response_model=BacktestListResponse,
    summary="List backtests",
)
async def list_backtests(
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    strategy_id: Annotated[Optional[int], Query()] = None,
    status_filter: Annotated[Optional[BacktestStatus], Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> BacktestListResponse:
    """
    Get a paginated list of backtest results.
    
    Can filter by strategy_id and status.
    """
    # Build query joining with Strategy to filter by user
    query = (
        select(BacktestResult, Strategy.name.label("strategy_name"))
        .join(Strategy)
        .where(Strategy.user_id == user_id)
    )
    
    # Apply filters
    if strategy_id:
        query = query.where(BacktestResult.strategy_id == strategy_id)
    
    if status_filter:
        query = query.where(BacktestResult.status == status_filter)
    
    # Get total count
    count_query = select(func.count()).select_from(
        select(BacktestResult)
        .join(Strategy)
        .where(Strategy.user_id == user_id)
        .subquery()
    )
    
    if strategy_id:
        count_query = select(func.count()).select_from(
            select(BacktestResult)
            .join(Strategy)
            .where(Strategy.user_id == user_id)
            .where(BacktestResult.strategy_id == strategy_id)
            .subquery()
        )
    
    total = await db.scalar(count_query) or 0
    
    # Apply pagination and ordering
    offset = (page - 1) * page_size
    query = query.order_by(BacktestResult.created_at.desc()).offset(offset).limit(page_size)
    
    # Execute
    result = await db.execute(query)
    rows = result.all()
    
    # Build response items
    items = []
    for backtest, strategy_name in rows:
        items.append(BacktestListItem(
            id=backtest.id,
            strategy_id=backtest.strategy_id,
            strategy_name=strategy_name,
            status=backtest.status,
            start_date=backtest.start_date,
            end_date=backtest.end_date,
            total_return=float(backtest.total_return) if backtest.total_return else None,
            sharpe_ratio=float(backtest.sharpe_ratio) if backtest.sharpe_ratio else None,
            mdd=float(backtest.mdd) if backtest.mdd else None,
            created_at=backtest.created_at,
        ))
    
    total_pages = (total + page_size - 1) // page_size
    
    return BacktestListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.delete(
    "/{backtest_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete backtest",
)
async def delete_backtest(
    backtest_id: int,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """
    Delete a backtest result.
    
    Cannot delete running backtests.
    """
    backtest = await get_backtest_or_404(backtest_id, user_id, db)
    
    if backtest.status == BacktestStatus.RUNNING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a running backtest. Cancel it first.",
        )
    
    await db.delete(backtest)
    await db.commit()


@router.post(
    "/{backtest_id}/cancel",
    response_model=BacktestStatusResponse,
    summary="Cancel running backtest",
)
async def cancel_backtest(
    backtest_id: int,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BacktestStatusResponse:
    """
    Cancel a pending or running backtest.
    """
    backtest = await get_backtest_or_404(backtest_id, user_id, db)
    
    if backtest.status not in [BacktestStatus.PENDING, BacktestStatus.RUNNING]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel backtest with status: {backtest.status.value}",
        )
    
    # In production, revoke the Celery task
    # if backtest.task_id:
    #     from app.worker import celery_app
    #     celery_app.control.revoke(backtest.task_id, terminate=True)
    
    backtest.status = BacktestStatus.CANCELLED
    await db.commit()
    
    return BacktestStatusResponse(
        backtest_id=backtest.id,
        task_id=backtest.task_id,
        status=backtest.status,
        progress=None,
        message="Backtest cancelled",
    )


@router.post(
    "/compare",
    response_model=BacktestCompareResponse,
    summary="Compare multiple backtests",
)
async def compare_backtests(
    request: BacktestCompareRequest,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BacktestCompareResponse:
    """
    Compare performance metrics across multiple backtests.
    
    Provide 2-10 backtest IDs to compare side by side.
    """
    # Fetch all backtests
    backtests = []
    for bid in request.backtest_ids:
        bt = await get_backtest_or_404(bid, user_id, db)
        backtests.append(bt)
    
    # Build response objects
    results = []
    for bt in backtests:
        metrics = None
        if bt.status == BacktestStatus.COMPLETED:
            metrics = BacktestMetrics(
                total_return=float(bt.total_return) if bt.total_return else None,
                sharpe_ratio=float(bt.sharpe_ratio) if bt.sharpe_ratio else None,
                mdd=float(bt.mdd) if bt.mdd else None,
                # ... other metrics
            )
        
        results.append(BacktestResultResponse(
            id=bt.id,
            strategy_id=bt.strategy_id,
            task_id=bt.task_id,
            status=bt.status,
            start_date=bt.start_date,
            end_date=bt.end_date,
            initial_capital=float(bt.initial_capital),
            final_value=float(bt.final_value) if bt.final_value else None,
            metrics=metrics,
            created_at=bt.created_at,
            updated_at=bt.updated_at,
        ))
    
    # Find best performers
    completed = [r for r in results if r.status == BacktestStatus.COMPLETED and r.metrics]
    
    best_return = None
    best_sharpe = None
    lowest_mdd = None
    
    if completed:
        # Best return
        best_ret = max(completed, key=lambda x: x.metrics.total_return or float("-inf"))
        if best_ret.metrics.total_return:
            best_return = {"backtest_id": best_ret.id, "value": best_ret.metrics.total_return}
        
        # Best Sharpe
        best_sh = max(completed, key=lambda x: x.metrics.sharpe_ratio or float("-inf"))
        if best_sh.metrics.sharpe_ratio:
            best_sharpe = {"backtest_id": best_sh.id, "value": best_sh.metrics.sharpe_ratio}
        
        # Lowest MDD (closest to 0)
        best_mdd = min(completed, key=lambda x: abs(x.metrics.mdd or float("inf")))
        if best_mdd.metrics.mdd:
            lowest_mdd = {"backtest_id": best_mdd.id, "value": best_mdd.metrics.mdd}
    
    return BacktestCompareResponse(
        backtests=results,
        best_return=best_return,
        best_sharpe=best_sharpe,
        lowest_mdd=lowest_mdd,
    )

