"""
Quant Engine Package.

This package contains the core quantitative analysis and backtesting
functionality built on top of Backtrader.

Modules:
- runner: Main backtest execution logic
- strategies/: Individual strategy implementations

Usage:
    from app.engine import run_backtest
    from app.engine.strategies import SMAcrossStrategy
"""

from app.engine.runner import run_backtest

__all__ = ["run_backtest"]

