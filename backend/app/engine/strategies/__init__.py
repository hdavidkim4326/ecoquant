"""
Strategy Implementations Package.

This package contains all Backtrader strategy implementations.
Each strategy inherits from BaseStrategy for consistent behavior.

Available Strategies:
- SMAcrossStrategy: Simple/Exponential Moving Average Crossover
- SentimentSMAStrategy: AI Sentiment + SMA Crossover Hybrid

Usage:
    from app.engine.strategies import SMAcrossStrategy, STRATEGY_REGISTRY
    
    # Get strategy class by name
    strategy_class = STRATEGY_REGISTRY.get("sma_crossover")
"""

from app.engine.strategies.base import BaseStrategy
from app.engine.strategies.sma_cross import SMAcrossStrategy
from app.engine.strategies.sentiment_sma import (
    SentimentSMAStrategy,
    AggressiveSentimentStrategy,
    ConservativeSentimentStrategy,
)

# Strategy registry maps strategy type names to their implementations
STRATEGY_REGISTRY: dict[str, type[BaseStrategy]] = {
    "sma_crossover": SMAcrossStrategy,
    "ema_crossover": SMAcrossStrategy,  # Same class, different params
    "sentiment_sma": SentimentSMAStrategy,
    "sentiment_sma_aggressive": AggressiveSentimentStrategy,
    "sentiment_sma_conservative": ConservativeSentimentStrategy,
}

# Strategies that require sentiment data feed
SENTIMENT_STRATEGIES = {
    "sentiment_sma",
    "sentiment_sma_aggressive",
    "sentiment_sma_conservative",
}


def get_strategy_class(strategy_type: str) -> type[BaseStrategy] | None:
    """
    Get strategy class by type name.
    
    Args:
        strategy_type: The strategy type identifier (e.g., "sma_crossover").
    
    Returns:
        Strategy class if found, None otherwise.
    """
    return STRATEGY_REGISTRY.get(strategy_type.lower())


def requires_sentiment_data(strategy_type: str) -> bool:
    """
    Check if a strategy requires sentiment data feed.
    
    Args:
        strategy_type: The strategy type identifier.
    
    Returns:
        True if strategy requires sentiment data.
    """
    return strategy_type.lower() in SENTIMENT_STRATEGIES


__all__ = [
    "BaseStrategy",
    "SMAcrossStrategy",
    "SentimentSMAStrategy",
    "AggressiveSentimentStrategy",
    "ConservativeSentimentStrategy",
    "STRATEGY_REGISTRY",
    "SENTIMENT_STRATEGIES",
    "get_strategy_class",
    "requires_sentiment_data",
]

