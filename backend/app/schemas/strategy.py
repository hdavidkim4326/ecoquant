"""
Strategy Schema Definitions.

Pydantic models for Strategy-related API operations including
creation, updates, and detailed responses.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.strategy import StrategyStatus, StrategyType


class LogicConfigBase(BaseModel):
    """
    Base schema for strategy logic configuration.
    
    This is a flexible structure that varies by strategy type.
    Common fields are defined here with strategy-specific fields
    passed through the extra fields.
    """
    
    model_config = ConfigDict(extra="allow")
    
    # Common optional fields for most strategies
    position_size: Optional[float] = Field(
        None,
        ge=0.01,
        le=1.0,
        description="Position size as fraction of portfolio (0.01 to 1.0)",
    )
    
    stop_loss: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Stop loss percentage (0.0 to 1.0)",
    )
    
    take_profit: Optional[float] = Field(
        None,
        ge=0.0,
        description="Take profit percentage",
    )


class SMAConfigSchema(LogicConfigBase):
    """Configuration schema for SMA Crossover strategy."""
    
    fast_period: int = Field(
        ...,
        ge=1,
        le=500,
        description="Fast moving average period",
        examples=[50],
    )
    
    slow_period: int = Field(
        ...,
        ge=1,
        le=500,
        description="Slow moving average period",
        examples=[200],
    )
    
    @field_validator("slow_period")
    @classmethod
    def slow_must_be_greater_than_fast(cls, v: int, info) -> int:
        """Ensure slow period is greater than fast period."""
        fast = info.data.get("fast_period")
        if fast and v <= fast:
            raise ValueError("slow_period must be greater than fast_period")
        return v


class RSIConfigSchema(LogicConfigBase):
    """Configuration schema for RSI strategy."""
    
    period: int = Field(
        default=14,
        ge=2,
        le=100,
        description="RSI calculation period",
    )
    
    oversold: float = Field(
        default=30.0,
        ge=0.0,
        le=50.0,
        description="Oversold threshold (buy signal)",
    )
    
    overbought: float = Field(
        default=70.0,
        ge=50.0,
        le=100.0,
        description="Overbought threshold (sell signal)",
    )


class SentimentSMAConfigSchema(LogicConfigBase):
    """
    Configuration schema for Sentiment-Enhanced SMA Crossover strategy.
    
    This hybrid strategy combines SMA crossover signals with AI-generated
    news sentiment scores for smarter entry/exit decisions.
    """
    
    # Moving Average Parameters
    fast_period: int = Field(
        default=10,
        ge=1,
        le=200,
        description="Fast moving average period",
        examples=[10, 20, 50],
    )
    
    slow_period: int = Field(
        default=30,
        ge=2,
        le=500,
        description="Slow moving average period",
        examples=[30, 50, 200],
    )
    
    use_ema: bool = Field(
        default=False,
        description="Use EMA instead of SMA (more responsive to recent prices)",
    )
    
    # Sentiment Parameters
    sentiment_lookback: int = Field(
        default=3,
        ge=1,
        le=30,
        description="Number of days to average for sentiment calculation",
        examples=[3, 5, 7],
    )
    
    buy_threshold: float = Field(
        default=0.2,
        ge=-1.0,
        le=1.0,
        description="Minimum average sentiment score to allow buying (-1.0 to 1.0)",
        examples=[0.1, 0.2, 0.3],
    )
    
    panic_threshold: float = Field(
        default=-0.5,
        ge=-1.0,
        le=0.0,
        description="Sentiment threshold for emergency sell (-1.0 to 0.0)",
        examples=[-0.3, -0.5, -0.7],
    )
    
    @field_validator("slow_period")
    @classmethod
    def slow_must_be_greater_than_fast(cls, v: int, info) -> int:
        """Ensure slow period is greater than fast period."""
        fast = info.data.get("fast_period")
        if fast and v <= fast:
            raise ValueError("slow_period must be greater than fast_period")
        return v
    
    @field_validator("buy_threshold")
    @classmethod
    def buy_threshold_must_be_above_panic(cls, v: float, info) -> float:
        """Ensure buy threshold is above panic threshold."""
        panic = info.data.get("panic_threshold")
        if panic is not None and v <= panic:
            raise ValueError("buy_threshold must be greater than panic_threshold")
        return v


class DCAConfigSchema(LogicConfigBase):
    """Configuration schema for Dollar Cost Averaging strategy."""
    
    investment_amount: float = Field(
        ...,
        gt=0,
        description="Amount to invest per period",
    )
    
    frequency: str = Field(
        default="monthly",
        pattern="^(daily|weekly|biweekly|monthly)$",
        description="Investment frequency",
    )


class StrategyBase(BaseModel):
    """
    Base schema with common strategy fields.
    """
    
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Strategy display name",
        examples=["Golden Cross Strategy"],
    )
    
    description: Optional[str] = Field(
        None,
        max_length=2000,
        description="Detailed strategy description",
    )
    
    strategy_type: StrategyType = Field(
        ...,
        description="Type of trading strategy",
        examples=[StrategyType.SMA_CROSSOVER],
    )
    
    symbols: Optional[str] = Field(
        None,
        description="Comma-separated list of target symbols",
        examples=["AAPL,MSFT,GOOGL"],
    )
    
    logic_config: Dict[str, Any] = Field(
        default_factory=dict,
        description="Strategy-specific configuration parameters",
        examples=[{"fast_period": 50, "slow_period": 200}],
    )


class StrategyCreate(StrategyBase):
    """
    Schema for creating a new strategy.
    
    User ID is automatically set from the authenticated user.
    """
    
    status: StrategyStatus = Field(
        default=StrategyStatus.DRAFT,
        description="Initial strategy status",
    )
    
    @field_validator("symbols")
    @classmethod
    def validate_symbols(cls, v: Optional[str]) -> Optional[str]:
        """Validate and normalize symbol list."""
        if not v:
            return None
        
        # Normalize: uppercase, remove extra spaces
        symbols = [s.strip().upper() for s in v.split(",") if s.strip()]
        
        if not symbols:
            return None
        
        # Basic validation: symbols should be alphanumeric
        for symbol in symbols:
            if not symbol.replace(".", "").replace("-", "").isalnum():
                raise ValueError(f"Invalid symbol format: {symbol}")
        
        return ",".join(symbols)


class StrategyUpdate(BaseModel):
    """
    Schema for updating an existing strategy.
    
    All fields are optional for partial updates.
    """
    
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
    )
    
    description: Optional[str] = Field(
        None,
        max_length=2000,
    )
    
    strategy_type: Optional[StrategyType] = None
    
    status: Optional[StrategyStatus] = None
    
    symbols: Optional[str] = None
    
    logic_config: Optional[Dict[str, Any]] = None


class StrategyResponse(BaseModel):
    """
    Schema for strategy API responses.
    
    Includes all fields plus computed properties.
    """
    
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    name: str
    description: Optional[str] = None
    strategy_type: StrategyType
    status: StrategyStatus
    symbols: Optional[str] = None
    logic_config: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    
    # Computed fields
    backtest_count: Optional[int] = Field(
        None,
        description="Number of backtests run for this strategy",
    )


class StrategyListResponse(BaseModel):
    """
    Schema for paginated strategy list response.
    """
    
    items: List[StrategyResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class StrategyWithLatestBacktest(StrategyResponse):
    """
    Strategy response with the latest backtest result summary.
    """
    
    latest_backtest: Optional[Dict[str, Any]] = Field(
        None,
        description="Summary of the most recent backtest result",
    )

