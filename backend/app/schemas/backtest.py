"""
Backtest Schema Definitions.

Pydantic models for Backtest-related API operations including
running backtests, checking status, and retrieving results.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.backtest import BacktestStatus


class BacktestRequest(BaseModel):
    """
    Schema for initiating a backtest.
    
    Required fields: strategy_id, start_date, end_date
    """
    
    strategy_id: int = Field(
        ...,
        gt=0,
        description="ID of the strategy to backtest",
    )
    
    start_date: date = Field(
        ...,
        description="Backtest start date (YYYY-MM-DD)",
        examples=["2020-01-01"],
    )
    
    end_date: date = Field(
        ...,
        description="Backtest end date (YYYY-MM-DD)",
        examples=["2023-12-31"],
    )
    
    initial_capital: float = Field(
        default=100000000.0,  # 1억원 (100 million KRW)
        gt=0,
        le=10000000000,  # 100억 max
        description="Starting capital for backtest (default: 100,000,000)",
    )
    
    commission: float = Field(
        default=0.001,
        ge=0,
        le=0.1,
        description="Trading commission as decimal (0.001 = 0.1%)",
    )
    
    position_size: float = Field(
        default=1.0,
        gt=0,
        le=1.0,
        description="Position size as fraction of portfolio (0.0 to 1.0, default: 1.0 = 100%)",
    )
    
    # Optional strategy config overrides for this specific backtest
    config_overrides: Optional[Dict[str, Any]] = Field(
        None,
        description="Override strategy parameters for this backtest only",
    )
    
    @field_validator("end_date")
    @classmethod
    def end_date_must_be_after_start(cls, v: date, info) -> date:
        """Ensure end date is after start date."""
        start = info.data.get("start_date")
        if start and v <= start:
            raise ValueError("end_date must be after start_date")
        return v
    
    @field_validator("start_date", "end_date")
    @classmethod
    def dates_not_in_future(cls, v: date) -> date:
        """Ensure dates are not in the future."""
        if v > date.today():
            raise ValueError("Date cannot be in the future")
        return v


class BacktestMetrics(BaseModel):
    """
    Schema for backtest performance metrics.
    
    All financial metrics with proper precision handling.
    """
    
    model_config = ConfigDict(from_attributes=True)
    
    # Returns
    total_return: Optional[float] = Field(
        None,
        description="Total return percentage",
    )
    
    cagr: Optional[float] = Field(
        None,
        description="Compound Annual Growth Rate (%)",
    )
    
    # Risk Metrics
    mdd: Optional[float] = Field(
        None,
        description="Maximum Drawdown (%)",
    )
    
    sharpe_ratio: Optional[float] = Field(
        None,
        description="Sharpe Ratio (risk-adjusted return)",
    )
    
    sortino_ratio: Optional[float] = Field(
        None,
        description="Sortino Ratio (downside risk-adjusted)",
    )
    
    calmar_ratio: Optional[float] = Field(
        None,
        description="Calmar Ratio (CAGR / MDD)",
    )
    
    # Trade Statistics
    total_trades: Optional[int] = Field(
        None,
        ge=0,
        description="Total number of trades executed",
    )
    
    winning_trades: Optional[int] = Field(
        None,
        ge=0,
    )
    
    losing_trades: Optional[int] = Field(
        None,
        ge=0,
    )
    
    win_rate: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Win rate as decimal (0.0 to 1.0)",
    )
    
    avg_win: Optional[float] = Field(
        None,
        description="Average winning trade return (%)",
    )
    
    avg_loss: Optional[float] = Field(
        None,
        description="Average losing trade return (%)",
    )
    
    profit_factor: Optional[float] = Field(
        None,
        ge=0.0,
        description="Gross profit / Gross loss ratio",
    )


class EquityCurvePoint(BaseModel):
    """Single point in the equity curve."""
    
    date: date
    value: float
    drawdown: Optional[float] = None


class TradeRecord(BaseModel):
    """Record of a single trade."""
    
    entry_date: date
    exit_date: Optional[date] = None
    symbol: str
    side: str  # "long" or "short"
    entry_price: float
    exit_price: Optional[float] = None
    quantity: float
    pnl: Optional[float] = None
    pnl_percent: Optional[float] = None
    is_open: bool = False


class BacktestStatusResponse(BaseModel):
    """
    Schema for backtest status check response.
    
    Used for polling the status of an async backtest.
    """
    
    backtest_id: int
    task_id: Optional[str] = None
    status: BacktestStatus
    progress: Optional[int] = Field(
        None,
        ge=0,
        le=100,
        description="Completion percentage (0-100)",
    )
    message: Optional[str] = None
    started_at: Optional[datetime] = None
    estimated_completion: Optional[datetime] = None


class BacktestResultResponse(BaseModel):
    """
    Schema for complete backtest result response.
    
    Includes all metrics, equity curve, and trade history.
    """
    
    model_config = ConfigDict(from_attributes=True)
    
    # Identity
    id: int
    strategy_id: int
    task_id: Optional[str] = None
    status: BacktestStatus
    
    # Period
    start_date: date
    end_date: date
    
    # Capital
    initial_capital: float
    final_value: Optional[float] = None
    
    # Performance Metrics
    metrics: Optional[BacktestMetrics] = None
    
    # Time Series Data
    equity_curve: Optional[List[EquityCurvePoint]] = None
    
    # Trade History
    trades: Optional[List[TradeRecord]] = None
    
    # Execution Info
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    execution_time_seconds: Optional[float] = None
    
    # Error handling
    error_message: Optional[str] = None
    
    # Timestamps
    created_at: datetime
    updated_at: datetime


class BacktestListItem(BaseModel):
    """
    Simplified backtest info for list views.
    """
    
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    strategy_id: int
    strategy_name: Optional[str] = None
    status: BacktestStatus
    start_date: date
    end_date: date
    total_return: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    mdd: Optional[float] = None
    created_at: datetime


class BacktestListResponse(BaseModel):
    """
    Schema for paginated backtest list response.
    """
    
    items: List[BacktestListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class BacktestCompareRequest(BaseModel):
    """
    Schema for comparing multiple backtests.
    """
    
    backtest_ids: List[int] = Field(
        ...,
        min_length=2,
        max_length=10,
        description="List of backtest IDs to compare (2-10)",
    )


class BacktestCompareResponse(BaseModel):
    """
    Schema for backtest comparison response.
    """
    
    backtests: List[BacktestResultResponse]
    
    # Summary statistics across all backtests
    best_return: Optional[Dict[str, Any]] = None
    best_sharpe: Optional[Dict[str, Any]] = None
    lowest_mdd: Optional[Dict[str, Any]] = None

