"""
Backtest Runner Module.

This module provides the main entry point for running backtests.
It handles data fetching, strategy instantiation, and result processing.

The run_backtest function is designed to be called by Celery workers
for async execution of long-running backtests.
"""

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple, Type

import backtrader as bt
import numpy as np
import pandas as pd
import yfinance as yf

from app.core.config import settings
from app.core.exceptions import (
    BacktestFailedError,
    DataFetchError,
    InsufficientDataError,
    InvalidStrategyConfigError,
)
from app.engine.strategies import STRATEGY_REGISTRY, BaseStrategy, requires_sentiment_data
from app.engine.data_feeds import fetch_sentiment_data_sync, SentimentDataFeed
from app.schemas.backtest import BacktestMetrics, EquityCurvePoint, TradeRecord

logger = logging.getLogger(__name__)


class PortfolioAnalyzer(bt.Analyzer):
    """
    Custom analyzer for collecting portfolio performance data.
    
    Tracks daily portfolio values for equity curve generation
    and calculates key performance metrics.
    """
    
    def __init__(self) -> None:
        self.daily_values: List[Tuple[date, float]] = []
        self.daily_returns: List[float] = []
        self.peak_value: float = 0.0
        self.max_drawdown: float = 0.0
    
    def start(self) -> None:
        """Called at backtest start."""
        self.start_value = self.strategy.broker.getvalue()
        self.peak_value = self.start_value
    
    def next(self) -> None:
        """Called for each bar - record daily value."""
        current_value = self.strategy.broker.getvalue()
        current_date = self.datas[0].datetime.date(0)
        
        self.daily_values.append((current_date, current_value))
        
        # Calculate daily return
        if len(self.daily_values) > 1:
            prev_value = self.daily_values[-2][1]
            if prev_value > 0:
                daily_return = (current_value - prev_value) / prev_value
                self.daily_returns.append(daily_return)
        
        # Track peak and drawdown
        if current_value > self.peak_value:
            self.peak_value = current_value
        
        drawdown = (self.peak_value - current_value) / self.peak_value
        if drawdown > self.max_drawdown:
            self.max_drawdown = drawdown
    
    def get_analysis(self) -> Dict[str, Any]:
        """Return collected analysis data."""
        return {
            "daily_values": self.daily_values,
            "daily_returns": self.daily_returns,
            "max_drawdown": self.max_drawdown,
            "start_value": self.start_value,
            "end_value": self.strategy.broker.getvalue(),
        }


def fetch_market_data(
    symbols: List[str],
    start_date: date,
    end_date: date,
) -> Dict[str, pd.DataFrame]:
    """
    Fetch historical market data for given symbols.
    
    Args:
        symbols: List of ticker symbols to fetch.
        start_date: Start date for historical data.
        end_date: End date for historical data.
    
    Returns:
        Dict mapping symbols to their OHLCV DataFrames.
    
    Raises:
        DataFetchError: If data cannot be fetched for a symbol.
        InsufficientDataError: If not enough data is available.
    """
    data_dict: Dict[str, pd.DataFrame] = {}
    
    for symbol in symbols:
        try:
            logger.info(f"Fetching data for {symbol}: {start_date} to {end_date}")
            
            # Add buffer for indicator calculation
            buffer_days = 250  # ~1 year of trading days
            buffer_start = pd.Timestamp(start_date) - pd.Timedelta(days=buffer_days * 1.5)
            
            ticker = yf.Ticker(symbol)
            df = ticker.history(
                start=buffer_start.strftime("%Y-%m-%d"),
                end=(pd.Timestamp(end_date) + pd.Timedelta(days=1)).strftime("%Y-%m-%d"),
                auto_adjust=True,
            )
            
            if df.empty:
                raise DataFetchError(symbol, "No data returned from yfinance")
            
            # Validate data quality
            required_columns = ["Open", "High", "Low", "Close", "Volume"]
            missing_cols = [col for col in required_columns if col not in df.columns]
            if missing_cols:
                raise DataFetchError(symbol, f"Missing columns: {missing_cols}")
            
            # Check for sufficient data
            min_required_days = 60  # At least 60 trading days
            if len(df) < min_required_days:
                raise InsufficientDataError(
                    symbol=symbol,
                    required_days=min_required_days,
                    available_days=len(df),
                )
            
            # Clean data
            df = df.dropna()
            df = df[~df.index.duplicated(keep="first")]
            
            data_dict[symbol] = df
            logger.info(f"Fetched {len(df)} rows for {symbol}")
            
        except (DataFetchError, InsufficientDataError):
            raise
        except Exception as e:
            raise DataFetchError(symbol, str(e)) from e
    
    return data_dict


def create_cerebro(
    initial_capital: float,
    commission: float,
) -> bt.Cerebro:
    """
    Create and configure a Backtrader Cerebro engine.
    
    Args:
        initial_capital: Starting capital for the backtest.
        commission: Trading commission as a decimal.
    
    Returns:
        Configured Cerebro instance.
    """
    cerebro = bt.Cerebro()
    
    # Set broker parameters
    cerebro.broker.setcash(initial_capital)
    cerebro.broker.setcommission(commission=commission)
    
    # Add analyzers
    cerebro.addanalyzer(PortfolioAnalyzer, _name="portfolio")
    cerebro.addanalyzer(bt.analyzers.SharpeRatio, _name="sharpe", riskfreerate=0.02)
    cerebro.addanalyzer(bt.analyzers.Returns, _name="returns")
    cerebro.addanalyzer(bt.analyzers.TradeAnalyzer, _name="trades")
    cerebro.addanalyzer(bt.analyzers.DrawDown, _name="drawdown")
    
    # Add sizer with 95% safety margin to prevent order rejection due to commission
    # This ensures we don't try to use 100% of cash, leaving room for fees
    cerebro.addsizer(bt.sizers.PercentSizer, percents=95)
    
    return cerebro


def calculate_metrics(
    cerebro_results: List[bt.Strategy],
    initial_capital: float,
    start_date: date,
    end_date: date,
) -> Tuple[BacktestMetrics, List[EquityCurvePoint], List[TradeRecord]]:
    """
    Calculate performance metrics from backtest results.
    
    Args:
        cerebro_results: List of strategy instances after backtest.
        initial_capital: Starting capital.
        start_date: Backtest start date.
        end_date: Backtest end date.
    
    Returns:
        Tuple of (metrics, equity_curve, trade_records).
    """
    strategy = cerebro_results[0]
    
    # Extract analyzer results
    portfolio_analysis = strategy.analyzers.portfolio.get_analysis()
    sharpe_analysis = strategy.analyzers.sharpe.get_analysis()
    returns_analysis = strategy.analyzers.returns.get_analysis()
    trade_analysis = strategy.analyzers.trades.get_analysis()
    drawdown_analysis = strategy.analyzers.drawdown.get_analysis()
    
    # Calculate basic metrics
    final_value = portfolio_analysis["end_value"]
    total_return = ((final_value - initial_capital) / initial_capital) * 100
    
    # Calculate CAGR
    days = (end_date - start_date).days
    years = days / 365.25
    if years > 0 and final_value > 0:
        cagr = ((final_value / initial_capital) ** (1 / years) - 1) * 100
    else:
        cagr = 0.0
    
    # Get MDD
    mdd = portfolio_analysis["max_drawdown"] * 100
    
    # Get Sharpe ratio
    sharpe = sharpe_analysis.get("sharperatio", 0.0)
    if sharpe is None:
        sharpe = 0.0
    
    # Calculate Sortino ratio from daily returns
    daily_returns = np.array(portfolio_analysis["daily_returns"])
    if len(daily_returns) > 0:
        negative_returns = daily_returns[daily_returns < 0]
        downside_std = np.std(negative_returns) if len(negative_returns) > 0 else 0
        mean_return = np.mean(daily_returns)
        sortino = (mean_return * 252 / (downside_std * np.sqrt(252))) if downside_std > 0 else 0.0
    else:
        sortino = 0.0
    
    # Calculate Calmar ratio
    calmar = cagr / mdd if mdd > 0 else 0.0
    
    # Trade statistics
    total_trades = trade_analysis.get("total", {}).get("total", 0)
    won_trades = trade_analysis.get("won", {}).get("total", 0)
    lost_trades = trade_analysis.get("lost", {}).get("total", 0)
    
    win_rate = won_trades / total_trades if total_trades > 0 else 0.0
    
    avg_win = trade_analysis.get("won", {}).get("pnl", {}).get("average", 0.0)
    avg_loss = trade_analysis.get("lost", {}).get("pnl", {}).get("average", 0.0)
    
    # Calculate profit factor
    gross_won = trade_analysis.get("won", {}).get("pnl", {}).get("total", 0.0)
    gross_lost = abs(trade_analysis.get("lost", {}).get("pnl", {}).get("total", 0.0))
    profit_factor = gross_won / gross_lost if gross_lost > 0 else 0.0
    
    metrics = BacktestMetrics(
        total_return=round(total_return, 4),
        cagr=round(cagr, 4),
        mdd=round(mdd, 4),
        sharpe_ratio=round(float(sharpe), 4),
        sortino_ratio=round(sortino, 4),
        calmar_ratio=round(calmar, 4),
        total_trades=total_trades,
        winning_trades=won_trades,
        losing_trades=lost_trades,
        win_rate=round(win_rate, 4),
        avg_win=round(avg_win, 4) if avg_win else None,
        avg_loss=round(avg_loss, 4) if avg_loss else None,
        profit_factor=round(profit_factor, 4),
    )
    
    # Build equity curve
    equity_curve = []
    peak = initial_capital
    for dt, value in portfolio_analysis["daily_values"]:
        if value > peak:
            peak = value
        dd = ((peak - value) / peak) * 100 if peak > 0 else 0
        equity_curve.append(EquityCurvePoint(
            date=dt,
            value=round(value, 2),
            drawdown=round(dd, 4),
        ))
    
    # Build trade records
    trade_records = []
    if hasattr(strategy, "trade_history"):
        for trade in strategy.trade_history:
            trade_records.append(TradeRecord(
                entry_date=trade["entry_date"],
                exit_date=trade.get("exit_date"),
                symbol=trade.get("symbol", "UNKNOWN"),
                side="long",  # Currently only long positions supported
                entry_price=trade["entry_price"],
                exit_price=trade.get("exit_price"),
                quantity=trade.get("size", 0),
                pnl=trade.get("pnl"),
                pnl_percent=trade.get("pnl_percent"),
                is_open=trade.get("exit_date") is None,
            ))
    
    return metrics, equity_curve, trade_records


def run_backtest(
    strategy_type: str,
    symbols: List[str],
    start_date: date,
    end_date: date,
    initial_capital: float = 100000.0,
    commission: float = 0.001,
    strategy_params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Run a backtest with the specified parameters.
    
    This is the main entry point for backtest execution.
    Designed to be called by Celery workers for async processing.
    
    Args:
        strategy_type: Type of strategy to use (e.g., "sma_crossover").
        symbols: List of ticker symbols to trade.
        start_date: Backtest start date.
        end_date: Backtest end date.
        initial_capital: Starting capital.
        commission: Trading commission as decimal.
        strategy_params: Strategy-specific parameters.
    
    Returns:
        Dict containing:
        - status: "completed" or "failed"
        - final_value: Ending portfolio value
        - metrics: Performance metrics (BacktestMetrics)
        - equity_curve: Daily equity values (List[EquityCurvePoint])
        - trades: Trade records (List[TradeRecord])
        - execution_time: Time taken in seconds
        - error: Error message if failed
    
    Raises:
        InvalidStrategyConfigError: If strategy configuration is invalid.
        DataFetchError: If market data cannot be fetched.
        BacktestFailedError: If backtest execution fails.
    """
    start_time = datetime.now(timezone.utc)
    
    try:
        # Validate strategy type
        strategy_class = STRATEGY_REGISTRY.get(strategy_type.lower())
        if strategy_class is None:
            raise InvalidStrategyConfigError(
                message=f"Unknown strategy type: {strategy_type}",
                config_errors={"strategy_type": f"'{strategy_type}' is not supported"},
            )
        
        # Validate symbols
        if not symbols:
            raise InvalidStrategyConfigError(
                message="No symbols provided",
                config_errors={"symbols": "At least one symbol is required"},
            )
        
        # Validate dates
        if start_date >= end_date:
            raise InvalidStrategyConfigError(
                message="Invalid date range",
                config_errors={"dates": "start_date must be before end_date"},
            )
        
        logger.info(
            f"Starting backtest: strategy={strategy_type}, "
            f"symbols={symbols}, period={start_date} to {end_date}"
        )
        
        # Fetch market data
        data_dict = fetch_market_data(symbols, start_date, end_date)
        
        # Create and configure Cerebro
        cerebro = create_cerebro(initial_capital, commission)
        
        # Add data feeds
        for symbol, df in data_dict.items():
            data_feed = bt.feeds.PandasData(
                dataname=df,
                name=symbol,
                fromdate=pd.Timestamp(start_date).to_pydatetime(),
                todate=pd.Timestamp(end_date).to_pydatetime(),
            )
            cerebro.adddata(data_feed)
        
        # Add sentiment data feed if strategy requires it
        if requires_sentiment_data(strategy_type):
            logger.info("Strategy requires sentiment data, fetching from DB...")
            for symbol in symbols:
                sentiment_df = fetch_sentiment_data_sync(symbol, start_date, end_date)
                
                if sentiment_df.empty:
                    logger.warning(
                        f"No sentiment data for {symbol}, using neutral values"
                    )
                else:
                    logger.info(
                        f"Loaded {len(sentiment_df)} days of sentiment data for {symbol}"
                    )
                
                sentiment_feed = SentimentDataFeed(
                    dataname=sentiment_df,
                    name=f"sentiment_{symbol}",
                    fromdate=pd.Timestamp(start_date).to_pydatetime(),
                    todate=pd.Timestamp(end_date).to_pydatetime(),
                )
                cerebro.adddata(sentiment_feed)
        
        # Prepare strategy parameters - filter to only valid params for this strategy
        params = strategy_params or {}
        params["log_trades"] = True  # Enable logging for debugging
        
        logger.info(f"📋 Strategy params before filtering: {params}")
        logger.info(f"💰 Initial capital set: {initial_capital:,.0f}, Commission: {commission}")
        
        # Get valid parameter names from strategy class
        valid_params = set(strategy_class.params._getkeys()) if hasattr(strategy_class.params, '_getkeys') else set()
        
        # Fallback: try to get params as dict keys
        if not valid_params and hasattr(strategy_class.params, 'params'):
            try:
                if isinstance(strategy_class.params, dict):
                    valid_params = set(strategy_class.params.keys())
                elif hasattr(strategy_class.params, '__dict__'):
                    valid_params = set(k for k in dir(strategy_class.params) if not k.startswith('_'))
            except Exception:
                pass
        
        logger.info(f"✅ Valid params for {strategy_type}: {valid_params}")
        
        # Filter out invalid parameters to prevent TypeError
        if valid_params:
            filtered_params = {k: v for k, v in params.items() if k in valid_params}
            invalid_params = set(params.keys()) - set(filtered_params.keys())
            if invalid_params:
                logger.warning(
                    f"Ignoring invalid parameters for {strategy_type}: {invalid_params}"
                )
            params = filtered_params
            
        # [CRITICAL FIX] Ensure position_size leaves room for commissions
        # If position_size is close to 1.0 (100%), reduce it to 0.95 (95%)
        # to prevent "Order Rejected" due to insufficient cash for commissions.
        if "position_size" in params and isinstance(params["position_size"], (int, float)):
             if 0.9 <= params["position_size"] <= 1.0:
                 logger.info(f"Adjusting position_size from {params['position_size']} to 0.95 to reserve cash for commissions")
                 params["position_size"] = 0.95
        
        logger.info(f"📊 Final params passed to strategy: {params}")
        
        # Add strategy
        cerebro.addstrategy(strategy_class, **params)
        
        # Run backtest
        logger.info("Executing backtest...")
        results = cerebro.run()
        
        # Calculate metrics
        metrics, equity_curve, trades = calculate_metrics(
            results,
            initial_capital,
            start_date,
            end_date,
        )
        
        final_value = cerebro.broker.getvalue()
        execution_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        
        logger.info(
            f"Backtest completed: final_value={final_value:.2f}, "
            f"return={metrics.total_return:.2f}%, "
            f"sharpe={metrics.sharpe_ratio:.2f}, "
            f"execution_time={execution_time:.2f}s"
        )
        
        return {
            "status": "completed",
            "final_value": round(final_value, 2),
            "metrics": metrics.model_dump(),
            "equity_curve": [ec.model_dump() for ec in equity_curve],
            "trades": [t.model_dump() for t in trades],
            "execution_time": round(execution_time, 3),
        }
        
    except (InvalidStrategyConfigError, DataFetchError, InsufficientDataError) as e:
        logger.error(f"Backtest configuration error: {e}")
        raise
    except Exception as e:
        logger.exception(f"Backtest failed with unexpected error: {e}")
        raise BacktestFailedError(reason=str(e)) from e