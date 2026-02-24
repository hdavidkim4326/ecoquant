"""
Sentiment-Enhanced SMA Crossover Strategy.

This module implements a hybrid strategy that combines technical analysis
(SMA Crossover) with AI-generated news sentiment scores.

The strategy uses sentiment as a filter/modifier for trading signals:
- Only buys on golden cross if sentiment is bullish
- Emergency sells if sentiment drops sharply (damage control)
- Supports configurable risk management (stop loss, take profit)
- Position sizing for portfolio management
- AI sensitivity controls

This represents Phase 4 of the Quant Platform: AI + Quant integration.
"""

import logging
from collections import deque
from typing import Optional

import backtrader as bt

from app.engine.strategies.base import BaseStrategy

logger = logging.getLogger(__name__)


class SentimentSMAStrategy(BaseStrategy):
    """
    Sentiment-Enhanced Moving Average Crossover Strategy.
    
    Combines SMA crossover signals with news sentiment analysis.
    Uses a secondary data feed containing daily sentiment scores.
    
    Buy Logic:
        (Fast MA crosses above Slow MA - Golden Cross)
        AND (Average sentiment over last N days > buy_threshold)
        OR (ignore_ai_on_strong_signal AND crossover is strong)
    
    Sell Logic:
        (Fast MA crosses below Slow MA - Death Cross)
        OR (Sentiment drops below panic_threshold - Emergency Stop)
        OR (Price hits stop_loss or take_profit)
    
    Params:
        fast_period: Period for fast moving average (default: 10)
        slow_period: Period for slow moving average (default: 30)
        use_ema: Use EMA instead of SMA (default: False)
        sentiment_lookback: Days to average for sentiment (default: 3)
        buy_threshold: Min avg sentiment to allow buy (default: 0.2)
        panic_threshold: Sentiment level that triggers emergency sell (default: -0.5)
        position_size: Fraction of portfolio to use (0.0 to 1.0)
        stop_loss: Stop loss percentage (0.0 to 1.0, None to disable)
        take_profit: Take profit percentage (None to disable)
        ai_weight: How much to weight AI sentiment (0.0 to 1.0, default: 0.5)
        ignore_ai_on_strong_signal: Ignore AI when technical signal is very strong
    
    Data Feeds Required:
        - data0: Main price data (OHLCV)
        - data1: Sentiment data (with 'sentiment' line)
    
    Example:
        cerebro.adddata(price_feed, name='AAPL')
        cerebro.adddata(sentiment_feed, name='sentiment')
        cerebro.addstrategy(
            SentimentSMAStrategy,
            fast_period=10,
            slow_period=30,
            buy_threshold=0.3,
            panic_threshold=-0.4,
            stop_loss=0.05,  # 5% stop loss
            take_profit=0.10,  # 10% take profit
            ai_weight=0.5,
        )
    """
    
    params = dict(
        # Moving Average params
        fast_period=10,
        slow_period=30,
        use_ema=False,
        
        # Sentiment params
        sentiment_lookback=3,   # Days to average for sentiment check
        buy_threshold=0.2,      # Min sentiment to allow buying
        panic_threshold=-0.5,   # Emergency sell threshold
        
        # AI Sensitivity params
        ai_weight=0.5,          # Weight for AI sentiment (0.0 to 1.0)
        ignore_ai_on_strong_signal=False,  # Ignore AI when MA spread is large
        strong_signal_threshold=0.02,  # 2% spread for strong signal
        
        # Risk Management (inherited from BaseStrategy but with new defaults)
        position_size=1.0,
        stop_loss=None,
        take_profit=None,
        log_trades=True,
    )
    
    def __init__(self) -> None:
        """Initialize moving averages, crossover, and sentiment tracking."""
        super().__init__()
        
        # Validate parameters
        if self.p.fast_period >= self.p.slow_period:
            raise ValueError(
                f"fast_period ({self.p.fast_period}) must be less than "
                f"slow_period ({self.p.slow_period})"
            )
        
        if self.p.buy_threshold <= self.p.panic_threshold:
            raise ValueError(
                f"buy_threshold ({self.p.buy_threshold}) must be greater than "
                f"panic_threshold ({self.p.panic_threshold})"
            )
        
        # Select MA type
        ma_class = bt.indicators.EMA if self.p.use_ema else bt.indicators.SMA
        ma_name = "EMA" if self.p.use_ema else "SMA"
        
        # Create moving averages on price data (data0)
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
        self.crossover = bt.indicators.CrossOver(
            self.fast_ma,
            self.slow_ma,
        )
        
        # Sentiment history buffer for averaging
        self.sentiment_buffer: deque = deque(maxlen=self.p.sentiment_lookback)
        
        # Track if we have sentiment data
        self.has_sentiment_data = len(self.datas) > 1
        
        if not self.has_sentiment_data:
            logger.warning(
                "No sentiment data feed provided. "
                "Strategy will use neutral sentiment (0.0)."
            )
        
        logger.info(
            f"SentimentSMAStrategy initialized: "
            f"fast={self.p.fast_period}, slow={self.p.slow_period}, "
            f"type={ma_name}, "
            f"sentiment_lookback={self.p.sentiment_lookback}, "
            f"buy_threshold={self.p.buy_threshold}, "
            f"panic_threshold={self.p.panic_threshold}, "
            f"stop_loss={self.p.stop_loss}, take_profit={self.p.take_profit}, "
            f"position_size={self.p.position_size}, ai_weight={self.p.ai_weight}"
        )
    
    def _get_current_sentiment(self) -> float:
        """
        Get the current day's sentiment score.
        
        Returns:
            Sentiment score from data feed, or 0.0 if not available.
        """
        if not self.has_sentiment_data:
            return 0.0
        
        try:
            # Access sentiment line from second data feed
            sentiment_data = self.datas[1]
            if hasattr(sentiment_data.lines, "sentiment"):
                return sentiment_data.lines.sentiment[0]
            else:
                # Fallback: try to access as close price if it's a simple feed
                return sentiment_data.close[0] if len(sentiment_data) > 0 else 0.0
        except (IndexError, AttributeError):
            return 0.0
    
    def _get_avg_sentiment(self) -> float:
        """
        Calculate average sentiment over the lookback period.
        
        Returns:
            Average sentiment score over last N days.
        """
        if not self.sentiment_buffer:
            return 0.0
        return sum(self.sentiment_buffer) / len(self.sentiment_buffer)
    
    def _is_sentiment_bullish(self) -> bool:
        """
        Check if sentiment is bullish enough for buying.
        
        Returns:
            True if average sentiment exceeds buy_threshold.
        """
        avg_sentiment = self._get_avg_sentiment()
        # Apply AI weight: higher ai_weight means more strict sentiment requirement
        adjusted_threshold = self.p.buy_threshold * self.p.ai_weight
        return avg_sentiment > adjusted_threshold
    
    def _is_sentiment_panic(self) -> bool:
        """
        Check if sentiment indicates a panic sell condition.
        
        Returns:
            True if current sentiment is below panic_threshold.
        """
        current_sentiment = self._get_current_sentiment()
        return current_sentiment < self.p.panic_threshold
    
    def _is_strong_technical_signal(self) -> bool:
        """
        Check if the technical signal (MA spread) is very strong.
        
        Returns:
            True if the spread between fast and slow MA is significant.
        """
        if not self.p.ignore_ai_on_strong_signal:
            return False
        
        current_close = self.datas[0].close[0]
        if current_close <= 0:
            return False
        
        spread = abs(self.fast_ma[0] - self.slow_ma[0]) / current_close
        return spread > self.p.strong_signal_threshold
    
    def _check_stop_loss_take_profit(self) -> bool:
        """
        Check if stop loss or take profit conditions are met.
        
        Returns:
            True if position should be closed due to risk management.
        """
        if not self.position or not self.entry_price:
            return False
        
        current_price = self.datas[0].close[0]
        pnl_percent = (current_price - self.entry_price) / self.entry_price
        
        # Check stop loss (note: stop_loss is stored as percentage, e.g., 5 for 5%)
        if self.p.stop_loss and self.p.stop_loss > 0:
            stop_loss_threshold = self.p.stop_loss / 100.0
            if pnl_percent <= -stop_loss_threshold:
                self.log(
                    f"STOP LOSS TRIGGERED: PnL={pnl_percent*100:.2f}% <= "
                    f"-{self.p.stop_loss}%"
                )
                return True
        
        # Check take profit (note: take_profit is stored as percentage, e.g., 10 for 10%)
        if self.p.take_profit and self.p.take_profit > 0:
            take_profit_threshold = self.p.take_profit / 100.0
            if pnl_percent >= take_profit_threshold:
                self.log(
                    f"TAKE PROFIT TRIGGERED: PnL={pnl_percent*100:.2f}% >= "
                    f"+{self.p.take_profit}%"
                )
                return True
        
        return False
    
    def next(self) -> None:
        """
        Process each bar and execute trading logic.
        
        Combines SMA crossover signals with sentiment analysis,
        with support for stop loss, take profit, and AI sensitivity settings.
        """
        # Skip if we have a pending order
        if self.pending_order:
            return
        
        # Update sentiment buffer
        current_sentiment = self._get_current_sentiment()
        self.sentiment_buffer.append(current_sentiment)
        
        # Get current values for logging
        current_close = self.datas[0].close[0]
        current_fast = self.fast_ma[0]
        current_slow = self.slow_ma[0]
        avg_sentiment = self._get_avg_sentiment()
        
        # If we have a position, check risk management first
        if self.position:
            # Check stop loss / take profit
            if self._check_stop_loss_take_profit():
                self.sell_signal()
                return
            
            # Check for panic sell (highest priority)
            if self._is_sentiment_panic():
                self.log(
                    f"PANIC SELL: Sentiment={current_sentiment:.2f} < "
                    f"threshold={self.p.panic_threshold}"
                )
                self.sell_signal()
                return
        
        # Check for crossover signals
        if self.crossover > 0:  # Golden Cross
            if not self.position:
                # Determine if we should enter based on sentiment and AI settings
                sentiment_ok = self._is_sentiment_bullish()
                strong_signal = self._is_strong_technical_signal()
                
                if sentiment_ok or strong_signal:
                    reason = "BULLISH SENTIMENT" if sentiment_ok else "STRONG TECHNICAL SIGNAL"
                    self.log(
                        f"GOLDEN CROSS + {reason}: "
                        f"Close={current_close:.2f}, "
                        f"Fast MA={current_fast:.2f}, Slow MA={current_slow:.2f}, "
                        f"Avg Sentiment={avg_sentiment:.2f}, "
                        f"AI Weight={self.p.ai_weight:.1f}"
                    )
                    self.buy_signal()
                else:
                    self.log(
                        f"GOLDEN CROSS IGNORED (Low Sentiment): "
                        f"Avg Sentiment={avg_sentiment:.2f} < "
                        f"threshold={self.p.buy_threshold * self.p.ai_weight:.2f}"
                    )
        
        elif self.crossover < 0:  # Death Cross
            if self.position:
                self.log(
                    f"DEATH CROSS: Close={current_close:.2f}, "
                    f"Fast MA={current_fast:.2f}, Slow MA={current_slow:.2f}"
                )
                self.sell_signal()
    
    def stop(self) -> None:
        """
        Called when backtest ends.
        
        Logs final performance summary.
        """
        logger.info(
            f"SentimentSMAStrategy completed: "
            f"Fast={self.p.fast_period}, Slow={self.p.slow_period}, "
            f"Buy Threshold={self.p.buy_threshold}, "
            f"Panic Threshold={self.p.panic_threshold}, "
            f"Final Portfolio Value: {self.broker.getvalue():.2f}"
        )


class AggressiveSentimentStrategy(SentimentSMAStrategy):
    """
    Aggressive Sentiment Strategy with lower thresholds.
    
    More responsive to sentiment changes, enters trades more easily.
    Higher risk, potentially higher reward.
    
    Key differences from base strategy:
    - Faster MA periods (5/20)
    - Uses EMA for quicker response
    - Lower buy threshold (0.1)
    - Higher panic threshold (-0.3, exits sooner on bad news)
    - Lower AI weight (0.3, trusts technicals more)
    - Will ignore AI if technical signal is very strong
    - Tighter stop loss (3%), wider take profit (15%)
    """
    
    params = dict(
        fast_period=5,
        slow_period=20,
        use_ema=True,
        sentiment_lookback=2,
        buy_threshold=0.1,
        panic_threshold=-0.3,
        # Aggressive: trust technicals more, ignore AI on strong signals
        ai_weight=0.3,
        ignore_ai_on_strong_signal=True,
        strong_signal_threshold=0.015,  # 1.5% spread triggers
        # Aggressive risk: tight stop, wide profit target
        stop_loss=3,  # 3% stop loss
        take_profit=15,  # 15% take profit
        position_size=1.0,  # Full position
    )


class ConservativeSentimentStrategy(SentimentSMAStrategy):
    """
    Conservative Sentiment Strategy with higher thresholds.
    
    Requires stronger sentiment signals, enters fewer trades.
    Lower risk, more selective trading.
    
    Key differences from base strategy:
    - Slower MA periods (20/50)
    - Uses SMA for smoother signals
    - Higher buy threshold (0.4)
    - Lower panic threshold (-0.6, stays longer in positions)
    - Higher AI weight (0.7, trusts AI more)
    - Never ignores AI even on strong technical signals
    - Moderate stop loss (7%), lower take profit (8%)
    - Reduced position size (50%)
    """
    
    params = dict(
        fast_period=20,
        slow_period=50,
        use_ema=False,
        sentiment_lookback=5,
        buy_threshold=0.4,
        panic_threshold=-0.6,
        # Conservative: trust AI more, never ignore
        ai_weight=0.7,
        ignore_ai_on_strong_signal=False,
        strong_signal_threshold=0.03,
        # Conservative risk: moderate stop, modest profit target
        stop_loss=7,  # 7% stop loss
        take_profit=8,  # 8% take profit  
        position_size=0.5,  # Half position only
    )


