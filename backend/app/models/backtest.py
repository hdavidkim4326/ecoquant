"""
BacktestResult Model Definition.

This module defines the BacktestResult model for storing
historical backtest execution results and performance metrics.

Table: backtest_results
"""

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Dict, Optional

from sqlalchemy import Date, DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.strategy import Strategy

import enum


class BacktestStatus(str, enum.Enum):
    """Backtest execution status."""
    
    PENDING = "pending"  # Waiting to be processed
    RUNNING = "running"  # Currently executing
    COMPLETED = "completed"  # Successfully finished
    FAILED = "failed"  # Execution failed
    CANCELLED = "cancelled"  # Cancelled by user


class BacktestResult(Base, TimestampMixin):
    """
    Backtest execution result model.
    
    Stores the results and performance metrics from running
    a strategy backtest on historical data.
    
    Attributes:
        id: Primary key, auto-incrementing integer.
        strategy_id: Foreign key to the strategy used.
        task_id: Celery task ID for tracking async execution.
        status: Current execution status.
        start_date: Backtest period start date.
        end_date: Backtest period end date.
        initial_capital: Starting capital for the backtest.
        final_value: Ending portfolio value.
        total_return: Total return percentage.
        cagr: Compound Annual Growth Rate.
        mdd: Maximum Drawdown percentage.
        sharpe_ratio: Risk-adjusted return metric.
        sortino_ratio: Downside risk-adjusted return.
        win_rate: Percentage of winning trades.
        total_trades: Number of trades executed.
        metrics: Additional metrics in JSON format.
        error_message: Error details if backtest failed.
        strategy: Related Strategy object.
    
    Example:
        result = BacktestResult(
            strategy_id=1,
            start_date=date(2020, 1, 1),
            end_date=date(2023, 12, 31),
            initial_capital=100000.0,
            status=BacktestStatus.COMPLETED,
            total_return=45.67,
            sharpe_ratio=1.85,
        )
    """
    
    __tablename__ = "backtest_results"
    
    # Table indexes for common queries
    __table_args__ = (
        Index("ix_backtest_strategy_status", "strategy_id", "status"),
        Index("ix_backtest_task_id", "task_id"),
        Index("ix_backtest_created", "created_at"),
    )
    
    # Primary Key
    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
        index=True,
    )
    
    # Foreign Key to Strategy
    strategy_id: Mapped[int] = mapped_column(
        ForeignKey("strategies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # Celery Task Tracking
    task_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
    )
    
    # Execution Status
    status: Mapped[BacktestStatus] = mapped_column(
        SQLEnum(BacktestStatus),
        default=BacktestStatus.PENDING,
        nullable=False,
    )
    
    # Backtest Period
    start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    
    end_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    
    # Capital
    initial_capital: Mapped[Decimal] = mapped_column(
        Numeric(precision=18, scale=2),
        nullable=False,
        default=100000.00,
    )
    
    final_value: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=18, scale=2),
        nullable=True,
    )
    
    # Performance Metrics
    total_return: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=10, scale=4),
        nullable=True,
        comment="Total return in percentage",
    )
    
    cagr: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=10, scale=4),
        nullable=True,
        comment="Compound Annual Growth Rate in percentage",
    )
    
    mdd: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=10, scale=4),
        nullable=True,
        comment="Maximum Drawdown in percentage",
    )
    
    sharpe_ratio: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=10, scale=4),
        nullable=True,
        comment="Sharpe Ratio (risk-adjusted return)",
    )
    
    sortino_ratio: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=10, scale=4),
        nullable=True,
        comment="Sortino Ratio (downside risk-adjusted return)",
    )
    
    calmar_ratio: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=10, scale=4),
        nullable=True,
        comment="Calmar Ratio (CAGR / MDD)",
    )
    
    # Trade Statistics
    win_rate: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=6, scale=4),
        nullable=True,
        comment="Win rate as decimal (0.0 to 1.0)",
    )
    
    total_trades: Mapped[Optional[int]] = mapped_column(
        nullable=True,
    )
    
    winning_trades: Mapped[Optional[int]] = mapped_column(
        nullable=True,
    )
    
    losing_trades: Mapped[Optional[int]] = mapped_column(
        nullable=True,
    )
    
    avg_win: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=10, scale=4),
        nullable=True,
        comment="Average winning trade return in percentage",
    )
    
    avg_loss: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=10, scale=4),
        nullable=True,
        comment="Average losing trade return in percentage",
    )
    
    profit_factor: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=10, scale=4),
        nullable=True,
        comment="Ratio of gross profit to gross loss",
    )
    
    # Execution Timing
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    execution_time_seconds: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=10, scale=3),
        nullable=True,
    )
    
    # Additional Data
    metrics: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
        default=dict,
        comment="Additional metrics and trade log",
    )
    
    # Equity Curve Data (for charting)
    equity_curve: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Daily equity values for plotting",
    )
    
    # Error Handling
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    
    # Relationships
    strategy: Mapped["Strategy"] = relationship(
        "Strategy",
        back_populates="backtest_results",
    )
    
    def __repr__(self) -> str:
        """String representation for debugging."""
        return (
            f"<BacktestResult(id={self.id}, strategy_id={self.strategy_id}, "
            f"status={self.status.value}, return={self.total_return}%)>"
        )
    
    def __str__(self) -> str:
        """Human-readable string representation."""
        return f"Backtest #{self.id} ({self.status.value})"
    
    @property
    def is_completed(self) -> bool:
        """Check if backtest has completed successfully."""
        return self.status == BacktestStatus.COMPLETED
    
    @property
    def is_running(self) -> bool:
        """Check if backtest is currently running."""
        return self.status == BacktestStatus.RUNNING
    
    @property
    def duration_str(self) -> str:
        """Get human-readable backtest period duration."""
        if not self.start_date or not self.end_date:
            return "N/A"
        
        days = (self.end_date - self.start_date).days
        years = days // 365
        months = (days % 365) // 30
        
        parts = []
        if years > 0:
            parts.append(f"{years}년")
        if months > 0:
            parts.append(f"{months}개월")
        if not parts:
            parts.append(f"{days}일")
        
        return " ".join(parts)
    
    def to_summary_dict(self) -> Dict[str, Any]:
        """
        Convert key metrics to a summary dictionary.
        
        Returns:
            Dict with essential backtest metrics for display.
        """
        return {
            "id": self.id,
            "strategy_id": self.strategy_id,
            "status": self.status.value,
            "period": f"{self.start_date} ~ {self.end_date}",
            "initial_capital": float(self.initial_capital) if self.initial_capital else None,
            "final_value": float(self.final_value) if self.final_value else None,
            "total_return": float(self.total_return) if self.total_return else None,
            "sharpe_ratio": float(self.sharpe_ratio) if self.sharpe_ratio else None,
            "mdd": float(self.mdd) if self.mdd else None,
            "total_trades": self.total_trades,
            "win_rate": float(self.win_rate) if self.win_rate else None,
        }

