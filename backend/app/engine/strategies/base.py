"""
Base Strategy Implementation.

This module provides the base class for all trading strategies.
Inherits from Backtrader's Strategy class and adds common functionality
for logging, metrics calculation, and trade tracking.

All custom strategies should inherit from BaseStrategy.
"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

import backtrader as bt
import numpy as np

logger = logging.getLogger(__name__)


class BaseStrategy(bt.Strategy):
    """
    Base strategy class with common functionality.
    
    Provides:
    - Trade logging and tracking
    - Performance metrics calculation
    - Position sizing utilities
    - Stop loss / take profit management
    
    All custom strategies should inherit from this class
    and implement the `next()` method for trading logic.
    
    Params:
        position_size: Fraction of portfolio to use per trade (0.0 to 1.0)
        stop_loss: Stop loss percentage (0.0 to 1.0, None to disable)
        take_profit: Take profit percentage (None to disable)
        log_trades: Whether to log trade details
    
    Example:
        class MyStrategy(BaseStrategy):
            params = dict(
                my_param=10,
                **BaseStrategy.params,
            )
            
            def __init__(self):
                super().__init__()
                # Initialize indicators
            
            def next(self):
                # Trading logic
                if self.should_buy():
                    self.buy_signal()
    """
    
    params = dict(
        position_size=1.0,  # Use 100% of available cash by default
        stop_loss=None,  # No stop loss by default
        take_profit=None,  # No take profit by default
        log_trades=True,
    )
    
    def __init__(self) -> None:
        """Initialize strategy with trade tracking."""
        super().__init__()
        
        # Trade tracking
        self.trade_history: List[Dict[str, Any]] = []
        self.current_trade: Optional[Dict[str, Any]] = None
        
        # Performance tracking
        self.entry_price: Optional[float] = None
        self.entry_date: Optional[datetime] = None
        
        # Order tracking
        self.pending_order: Optional[bt.Order] = None
        
        # Stop loss / take profit orders
        self.stop_order: Optional[bt.Order] = None
        self.profit_order: Optional[bt.Order] = None
        
        logger.info(
            f"Strategy initialized: {self.__class__.__name__} "
            f"with params: position_size={self.p.position_size}, "
            f"stop_loss={self.p.stop_loss}, take_profit={self.p.take_profit}"
        )
    
    def log(self, message: str, dt: Optional[datetime] = None) -> None:
        """
        Log a message with timestamp.
        
        Args:
            message: Message to log.
            dt: Optional datetime, defaults to current bar's datetime.
        """
        dt = dt or self.datas[0].datetime.date(0)
        if self.p.log_trades:
            logger.debug(f"[{dt}] {message}")
    
    def notify_order(self, order: bt.Order) -> None:
        """
        Handle order status notifications.
        
        Called by Backtrader when order status changes.
        Tracks order completion and logs details.
        """
        if order.status in [order.Submitted, order.Accepted]:
            # Order submitted/accepted - nothing to do
            return
        
        if order.status in [order.Completed]:
            if order.isbuy():
                self.log(
                    f"BUY EXECUTED: Price={order.executed.price:.2f}, "
                    f"Size={order.executed.size:.2f}, "
                    f"Cost={order.executed.value:.2f}, "
                    f"Comm={order.executed.comm:.2f}"
                )
                self.entry_price = order.executed.price
                self.entry_date = self.datas[0].datetime.date(0)
                
                # Set up stop loss / take profit if configured
                if self.p.stop_loss:
                    stop_price = self.entry_price * (1 - self.p.stop_loss)
                    self.stop_order = self.sell(
                        exectype=bt.Order.Stop,
                        price=stop_price,
                    )
                
                if self.p.take_profit:
                    profit_price = self.entry_price * (1 + self.p.take_profit)
                    self.profit_order = self.sell(
                        exectype=bt.Order.Limit,
                        price=profit_price,
                    )
            
            elif order.issell():
                self.log(
                    f"SELL EXECUTED: Price={order.executed.price:.2f}, "
                    f"Size={order.executed.size:.2f}, "
                    f"Cost={order.executed.value:.2f}, "
                    f"Comm={order.executed.comm:.2f}"
                )
                
                # Record completed trade
                if self.entry_price:
                    pnl = order.executed.price - self.entry_price
                    pnl_percent = (pnl / self.entry_price) * 100
                    
                    self.trade_history.append({
                        "entry_date": self.entry_date,
                        "exit_date": self.datas[0].datetime.date(0),
                        "symbol": self.datas[0]._name,
                        "entry_price": self.entry_price,
                        "exit_price": order.executed.price,
                        "size": order.executed.size,
                        "pnl": pnl * order.executed.size,
                        "pnl_percent": pnl_percent,
                    })
                    
                    self.entry_price = None
                    self.entry_date = None
                
                # Cancel any remaining stop/profit orders
                if self.stop_order:
                    self.cancel(self.stop_order)
                    self.stop_order = None
                if self.profit_order:
                    self.cancel(self.profit_order)
                    self.profit_order = None
        
        elif order.status in [order.Canceled, order.Margin, order.Rejected]:
            self.log(f"Order Canceled/Margin/Rejected: {order.status}")
        
        self.pending_order = None
    
    def notify_trade(self, trade: bt.Trade) -> None:
        """
        Handle trade notifications.
        
        Called when a trade is opened or closed.
        """
        if not trade.isclosed:
            return
        
        self.log(
            f"TRADE CLOSED: Gross={trade.pnl:.2f}, Net={trade.pnlcomm:.2f}"
        )
    
    def calculate_position_size(self) -> int:
        """
        Calculate position size based on available cash and position_size param.
        
        Returns:
            int: Number of shares to buy.
        """
        available_cash = self.broker.getcash() * self.p.position_size
        current_price = self.datas[0].close[0]
        
        logger.debug(
            f"Position sizing: cash={self.broker.getcash():.2f}, "
            f"position_size_param={self.p.position_size}, "
            f"available_cash={available_cash:.2f}, price={current_price:.2f}"
        )
        
        if current_price <= 0:
            logger.warning(f"Invalid price: {current_price}")
            return 0
        
        size = int(available_cash / current_price)
        
        if size <= 0:
            logger.warning(
                f"⚠️ Insufficient funds: available={available_cash:.2f}, "
                f"price={current_price:.2f}, calculated_size={size}"
            )
        else:
            logger.debug(f"Calculated position size: {size} shares")
        
        return max(0, size)
    
    def buy_signal(self, size: Optional[int] = None) -> Optional[bt.Order]:
        """
        Execute a buy order with proper position sizing.
        
        Args:
            size: Optional fixed size, otherwise calculated automatically.
        
        Returns:
            Order object if placed, None if skipped.
        """
        # Don't buy if we already have a position or pending order
        if self.position:
            logger.debug("Buy skipped: already have position")
            return None
        
        if self.pending_order:
            logger.debug("Buy skipped: pending order exists")
            return None
        
        if size is None:
            size = self.calculate_position_size()
        
        if size <= 0:
            logger.warning(f"Buy skipped: invalid size ({size})")
            return None
        
        self.log(f"BUY SIGNAL: Size={size}")
        logger.info(f"📈 Executing BUY order: size={size}, price={self.datas[0].close[0]:.2f}")
        self.pending_order = self.buy(size=size)
        return self.pending_order
    
    def sell_signal(self) -> Optional[bt.Order]:
        """
        Execute a sell order to close position.
        
        Returns:
            Order object if placed, None if no position.
        """
        if not self.position:
            return None
        
        self.log("SELL SIGNAL: Closing position")
        self.pending_order = self.sell(size=self.position.size)
        return self.pending_order
    
    def get_trade_statistics(self) -> Dict[str, Any]:
        """
        Calculate trade statistics from trade history.
        
        Returns:
            Dict with trade statistics.
        """
        if not self.trade_history:
            return {
                "total_trades": 0,
                "winning_trades": 0,
                "losing_trades": 0,
                "win_rate": 0.0,
                "avg_win": 0.0,
                "avg_loss": 0.0,
                "profit_factor": 0.0,
            }
        
        pnls = [t["pnl"] for t in self.trade_history]
        pnl_percents = [t["pnl_percent"] for t in self.trade_history]
        
        winning_trades = [p for p in pnls if p > 0]
        losing_trades = [p for p in pnls if p < 0]
        
        total_trades = len(pnls)
        num_winners = len(winning_trades)
        num_losers = len(losing_trades)
        
        win_rate = num_winners / total_trades if total_trades > 0 else 0.0
        
        avg_win = np.mean([p for p in pnl_percents if p > 0]) if num_winners > 0 else 0.0
        avg_loss = np.mean([p for p in pnl_percents if p < 0]) if num_losers > 0 else 0.0
        
        gross_profit = sum(winning_trades) if winning_trades else 0
        gross_loss = abs(sum(losing_trades)) if losing_trades else 0
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")
        
        return {
            "total_trades": total_trades,
            "winning_trades": num_winners,
            "losing_trades": num_losers,
            "win_rate": win_rate,
            "avg_win": float(avg_win),
            "avg_loss": float(avg_loss),
            "profit_factor": profit_factor if profit_factor != float("inf") else 999.99,
        }
    
    def next(self) -> None:
        """
        Main strategy logic - called for each bar.
        
        Override this method in subclasses to implement
        specific trading logic.
        """
        raise NotImplementedError("Subclasses must implement next()")

