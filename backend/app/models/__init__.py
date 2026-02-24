"""
SQLAlchemy ORM Models Package.

This package contains all database models for the EcoQuant platform.
All models inherit from the Base class and include timestamped mixins.

Models:
- User: User account and authentication data
- Strategy: Trading strategy configurations
- BacktestResult: Historical backtest results and metrics
- News: Financial news with AI sentiment analysis

Usage:
    from app.models import User, Strategy, BacktestResult, News
"""

from app.models.user import User
from app.models.strategy import Strategy
from app.models.backtest import BacktestResult
from app.models.news import News

__all__ = [
    "User",
    "Strategy",
    "BacktestResult",
    "News",
]

