"""
Simple Moving Average Crossover Strategy.

This module implements the classic SMA/EMA crossover strategy.
Generates buy signals when the fast MA crosses above the slow MA,
and sell signals when the fast MA crosses below the slow MA.

This is one of the most fundamental trend-following strategies.
"""

import logging
from typing import Optional

import backtrader as bt

from app.engine.strategies.base import BaseStrategy

logger = logging.getLogger(__name__)


class SMAcrossStrategy(BaseStrategy):
    """
    Moving Average Crossover Strategy.
    
    Implements a classic crossover strategy using two moving averages:
    - Fast MA (short-term trend)
    - Slow MA (long-term trend)
    
    Buy Signal: Fast MA crosses above Slow MA (Golden Cross)
    Sell Signal: Fast MA crosses below Slow MA (Death Cross)
    
    Params:
        fast_period: Period for fast moving average (default: 10)
        slow_period: Period for slow moving average (default: 30)
        use_ema: Use EMA instead of SMA (default: False)
        position_size: Fraction of portfolio to use (inherited)
        stop_loss: Stop loss percentage (inherited)
        take_profit: Take profit percentage (inherited)
    
    Example:
        # Add strategy to cerebro
        cerebro.addstrategy(
            SMAcrossStrategy,
            fast_period=50,
            slow_period=200,
            use_ema=False,
            position_size=0.95,
        )
    """
    
    params = dict(
        fast_period=10,
        slow_period=30,
        use_ema=False,
        # Inherited from BaseStrategy
        position_size=1.0,
        stop_loss=None,
        take_profit=None,
        log_trades=True,
    )
    
    def __init__(self) -> None:
        """Initialize moving averages and crossover indicator."""
        super().__init__()
        
        # Validate parameters
        if self.p.fast_period >= self.p.slow_period:
            raise ValueError(
                f"fast_period ({self.p.fast_period}) must be less than "
                f"slow_period ({self.p.slow_period})"
            )
        
        # Select MA type
        ma_class = bt.indicators.EMA if self.p.use_ema else bt.indicators.SMA
        ma_name = "EMA" if self.p.use_ema else "SMA"
        
        # Create moving averages
        self.fast_ma = ma_class(
            self.datas[0].close,
            period=self.p.fast_period,
            plotname=f"Fast {ma_name}({self.p.fast_period})",
        )
        
        self.slow_ma = ma_class(
            self.datas[0].close,
            period=self.p.slow_period,
            plotname=f"Slow {ma_name}({self.p.slow_period})",
        )
        
        # Crossover indicator
        # Returns: 1 when fast crosses above slow, -1 when crosses below, 0 otherwise
        self.crossover = bt.indicators.CrossOver(
            self.fast_ma,
            self.slow_ma,
        )
        
        logger.info(
            f"SMAcrossStrategy initialized: "
            f"fast={self.p.fast_period}, slow={self.p.slow_period}, "
            f"type={ma_name}"
        )
    
    def next(self) -> None:
        """
        Process each bar and execute trading logic.
        
        Buy when fast MA crosses above slow MA.
        Sell when fast MA crosses below slow MA.
        """
        # Skip if we have a pending order
        if self.pending_order:
            return
        
        # Get current values for logging
        current_close = self.datas[0].close[0]
        current_fast = self.fast_ma[0]
        current_slow = self.slow_ma[0]
        crossover_value = self.crossover[0]
        
        # Debug log every 20 bars to track indicator values
        bar_count = len(self.datas[0])
        if bar_count % 20 == 0 or crossover_value != 0:
            logger.debug(
                f"[Bar {bar_count}] Close={current_close:.2f}, "
                f"Fast MA={current_fast:.2f}, Slow MA={current_slow:.2f}, "
                f"Crossover={crossover_value}, Position={self.position.size if self.position else 0}"
            )
        
        # Check for crossover signals
        if crossover_value > 0:  # Fast crossed above slow (bullish)
            if not self.position:
                logger.info(
                    f"🟢 GOLDEN CROSS DETECTED: Close={current_close:.2f}, "
                    f"Fast MA={current_fast:.2f}, Slow MA={current_slow:.2f}"
                )
                self.log(
                    f"GOLDEN CROSS: Close={current_close:.2f}, "
                    f"Fast MA={current_fast:.2f}, Slow MA={current_slow:.2f}"
                )
                order = self.buy_signal()
                if order:
                    logger.info(f"📈 BUY ORDER PLACED: size={order.size if hasattr(order, 'size') else 'auto'}")
                else:
                    logger.warning("⚠️ BUY ORDER NOT PLACED - check position_size and cash")
        
        elif crossover_value < 0:  # Fast crossed below slow (bearish)
            if self.position:
                logger.info(
                    f"🔴 DEATH CROSS DETECTED: Close={current_close:.2f}, "
                    f"Fast MA={current_fast:.2f}, Slow MA={current_slow:.2f}"
                )
                self.log(
                    f"DEATH CROSS: Close={current_close:.2f}, "
                    f"Fast MA={current_fast:.2f}, Slow MA={current_slow:.2f}"
                )
                order = self.sell_signal()
                if order:
                    logger.info(f"📉 SELL ORDER PLACED")
                else:
                    logger.warning("⚠️ SELL ORDER NOT PLACED")
    
    def stop(self) -> None:
        """
        Called when backtest ends.
        
        Logs final performance summary.
        """
        logger.info(
            f"SMAcrossStrategy completed: "
            f"Fast={self.p.fast_period}, Slow={self.p.slow_period}, "
            f"Final Portfolio Value: {self.broker.getvalue():.2f}"
        )


class GoldenCrossStrategy(SMAcrossStrategy):
    """
    Golden Cross Strategy (50/200 SMA).
    
    A popular long-term trend following strategy using
    50-day and 200-day Simple Moving Averages.
    """
    
    params = dict(
        fast_period=50,
        slow_period=200,
        use_ema=False,
    )


class EMACrossStrategy(SMAcrossStrategy):
    """
    EMA Crossover Strategy.
    
    Uses Exponential Moving Averages which are more responsive
    to recent price changes compared to Simple Moving Averages.
    """
    
    params = dict(
        fast_period=12,
        slow_period=26,
        use_ema=True,
    )

