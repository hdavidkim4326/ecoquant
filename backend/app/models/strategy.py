"""
Strategy Model Definition.

This module defines the Strategy model for storing user-created
trading strategies and their configuration parameters.

Table: strategies
"""

from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.backtest import BacktestResult
    from app.models.user import User

import enum


class StrategyType(str, enum.Enum):
    """Enumeration of supported strategy types."""
    
    # Trend Following Strategies
    SMA_CROSSOVER = "sma_crossover"
    EMA_CROSSOVER = "ema_crossover"
    MACD = "macd"
    
    # Mean Reversion Strategies
    BOLLINGER_BANDS = "bollinger_bands"
    RSI = "rsi"
    
    # Momentum Strategies
    MOMENTUM = "momentum"
    DUAL_MOMENTUM = "dual_momentum"
    
    # AI Hybrid Strategies (Sentiment + Technical)
    SENTIMENT_SMA = "sentiment_sma"
    SENTIMENT_SMA_AGGRESSIVE = "sentiment_sma_aggressive"
    SENTIMENT_SMA_CONSERVATIVE = "sentiment_sma_conservative"
    
    # Index/Passive Strategies
    DCA = "dca"  # Dollar Cost Averaging
    REBALANCING = "rebalancing"
    
    # Custom Strategy
    CUSTOM = "custom"


class StrategyStatus(str, enum.Enum):
    """Strategy lifecycle status."""
    
    DRAFT = "draft"  # Strategy is being configured
    ACTIVE = "active"  # Strategy is ready for backtesting/trading
    PAUSED = "paused"  # Strategy is temporarily disabled
    ARCHIVED = "archived"  # Strategy is no longer in use


class Strategy(Base, TimestampMixin):
    """
    Trading strategy configuration model.
    
    Stores user-defined trading strategies with their parameters
    in a flexible JSON format for easy customization.
    
    Attributes:
        id: Primary key, auto-incrementing integer.
        user_id: Foreign key to the owning user.
        name: Display name for the strategy.
        description: Detailed description of the strategy.
        strategy_type: Type of strategy (SMA, RSI, etc.).
        status: Current lifecycle status.
        symbols: Target symbols/tickers for this strategy.
        logic_config: JSON configuration for strategy parameters.
        user: Related User object.
        backtest_results: Related BacktestResult objects.
    
    Example:
        strategy = Strategy(
            user_id=1,
            name="Golden Cross SMA",
            strategy_type=StrategyType.SMA_CROSSOVER,
            logic_config={
                "fast_period": 50,
                "slow_period": 200,
                "symbols": ["AAPL", "MSFT"],
            }
        )
    """
    
    __tablename__ = "strategies"
    
    # Table indexes for common queries
    __table_args__ = (
        Index("ix_strategies_user_status", "user_id", "status"),
        Index("ix_strategies_type", "strategy_type"),
    )
    
    # Primary Key
    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
        index=True,
    )
    
    # Foreign Key to User
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # Strategy Metadata
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    
    strategy_type: Mapped[StrategyType] = mapped_column(
        SQLEnum(StrategyType),
        default=StrategyType.CUSTOM,
        nullable=False,
    )
    
    status: Mapped[StrategyStatus] = mapped_column(
        SQLEnum(StrategyStatus),
        default=StrategyStatus.DRAFT,
        nullable=False,
    )
    
    # Target Symbols (comma-separated or JSON array)
    symbols: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    
    # Strategy Configuration (Flexible JSON Structure)
    # This field stores all strategy-specific parameters
    # Example for SMA Crossover:
    # {
    #     "fast_period": 50,
    #     "slow_period": 200,
    #     "position_size": 0.1,
    #     "stop_loss": 0.05,
    #     "take_profit": 0.15
    # }
    logic_config: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )
    
    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="strategies",
    )
    
    backtest_results: Mapped[List["BacktestResult"]] = relationship(
        "BacktestResult",
        back_populates="strategy",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="BacktestResult.created_at.desc()",
    )
    
    def __repr__(self) -> str:
        """String representation for debugging."""
        return (
            f"<Strategy(id={self.id}, name='{self.name}', "
            f"type={self.strategy_type.value}, status={self.status.value})>"
        )
    
    def __str__(self) -> str:
        """Human-readable string representation."""
        return f"{self.name} ({self.strategy_type.value})"
    
    @property
    def symbols_list(self) -> List[str]:
        """Parse symbols string into a list."""
        if not self.symbols:
            return []
        return [s.strip() for s in self.symbols.split(",") if s.strip()]
    
    @symbols_list.setter
    def symbols_list(self, value: List[str]) -> None:
        """Set symbols from a list."""
        self.symbols = ",".join(value) if value else None
    
    def get_config_value(self, key: str, default: Any = None) -> Any:
        """
        Get a value from logic_config with a default fallback.
        
        Args:
            key: Configuration key to retrieve.
            default: Default value if key is not found.
        
        Returns:
            The configuration value or default.
        """
        return self.logic_config.get(key, default)
    
    def update_config(self, **kwargs: Any) -> None:
        """
        Update logic_config with new values.
        
        Args:
            **kwargs: Key-value pairs to update in the config.
        """
        self.logic_config = {**self.logic_config, **kwargs}

