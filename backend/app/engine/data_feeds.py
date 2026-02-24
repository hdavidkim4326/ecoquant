"""
Custom Data Feeds for Backtrader.

This module provides custom data feeds that extend Backtrader's
capabilities to incorporate external data like sentiment scores.

Features:
- SentimentDataFeed: Adds daily sentiment scores as an additional data line
- Database integration for fetching aggregated sentiment data

Usage:
    from app.engine.data_feeds import fetch_sentiment_data, SentimentDataFeed
    
    # Fetch sentiment from DB
    sentiment_df = await fetch_sentiment_data("AAPL", start_date, end_date, session)
    
    # Create Backtrader-compatible data feed
    sentiment_feed = SentimentDataFeed(dataname=sentiment_df)
    cerebro.adddata(sentiment_feed, name="sentiment")
"""

import logging
from datetime import date, datetime, timezone
from typing import Optional

import backtrader as bt
import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.news import News

logger = logging.getLogger(__name__)


class SentimentDataFeed(bt.feeds.PandasData):
    """
    Custom Backtrader Data Feed for sentiment scores.
    
    Extends PandasData to include a 'sentiment' line that strategies
    can access alongside OHLCV data.
    
    Expected DataFrame columns:
        - Date (index): datetime index
        - sentiment: float (-1.0 to 1.0)
    
    Example:
        df = pd.DataFrame({
            'sentiment': [0.5, 0.3, -0.2, 0.8],
        }, index=pd.date_range('2024-01-01', periods=4))
        
        feed = SentimentDataFeed(dataname=df)
        cerebro.adddata(feed, name='sentiment_AAPL')
    """
    
    # Add sentiment as a new line
    lines = ("sentiment",)
    
    # Map DataFrame columns to lines
    params = (
        ("datetime", None),  # Use index as datetime
        ("open", None),       # Not used for sentiment-only feed
        ("high", None),
        ("low", None),
        ("close", None),
        ("volume", None),
        ("openinterest", None),
        ("sentiment", "sentiment"),  # Map 'sentiment' column to sentiment line
    )


async def fetch_sentiment_data(
    ticker: str,
    start_date: date,
    end_date: date,
    session: AsyncSession,
) -> pd.DataFrame:
    """
    Fetch aggregated daily sentiment scores from the database.
    
    Aggregates all news articles for a ticker on each date and calculates
    the average sentiment score.
    
    Args:
        ticker: Stock ticker symbol (e.g., 'AAPL').
        start_date: Start date for data.
        end_date: End date for data.
        session: Async database session.
    
    Returns:
        DataFrame with DatetimeIndex and 'sentiment' column.
        Missing dates are forward-filled with the last available value.
    
    Example:
        async with get_db_session() as session:
            df = await fetch_sentiment_data(
                "AAPL",
                date(2024, 1, 1),
                date(2024, 12, 31),
                session,
            )
            print(df.head())
            #             sentiment
            # Date
            # 2024-01-02      0.35
            # 2024-01-03      0.12
            # ...
    """
    ticker = ticker.upper()
    
    # Convert dates to datetime for query
    start_dt = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_dt = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)
    
    logger.info(f"Fetching sentiment data for {ticker}: {start_date} to {end_date}")
    
    # Query: Group by date and calculate average sentiment
    # We extract the date from published_at and group by it
    query = (
        select(
            func.date(News.published_at).label("date"),
            func.avg(News.sentiment_score).label("avg_sentiment"),
            func.count(News.id).label("news_count"),
        )
        .where(
            News.ticker == ticker,
            News.published_at >= start_dt,
            News.published_at <= end_dt,
            News.sentiment_score.is_not(None),  # Only include analyzed news
        )
        .group_by(func.date(News.published_at))
        .order_by(func.date(News.published_at))
    )
    
    result = await session.execute(query)
    rows = result.fetchall()
    
    if not rows:
        logger.warning(f"No sentiment data found for {ticker} in the date range")
        # Return empty DataFrame with proper structure
        return _create_empty_sentiment_df(start_date, end_date)
    
    # Build DataFrame from query results
    data = []
    for row in rows:
        data.append({
            "date": row.date,
            "sentiment": float(row.avg_sentiment) if row.avg_sentiment else 0.0,
            "news_count": row.news_count,
        })
    
    df = pd.DataFrame(data)
    df["date"] = pd.to_datetime(df["date"])
    df.set_index("date", inplace=True)
    
    logger.info(f"Fetched {len(df)} days of sentiment data for {ticker}")
    
    # Reindex to include all trading days in the range
    # Fill missing dates with forward-fill (carry last sentiment forward)
    all_dates = pd.date_range(start=start_date, end=end_date, freq="D")
    df = df.reindex(all_dates)
    
    # Forward fill, then backward fill for any leading NaNs, then fill with 0
    df["sentiment"] = df["sentiment"].ffill().bfill().fillna(0.0)
    
    # Keep only sentiment column for the data feed
    return df[["sentiment"]]


def _create_empty_sentiment_df(start_date: date, end_date: date) -> pd.DataFrame:
    """
    Create an empty sentiment DataFrame with neutral (0.0) scores.
    
    Used when no sentiment data is available for the requested period.
    
    Args:
        start_date: Start date.
        end_date: End date.
    
    Returns:
        DataFrame with DatetimeIndex and 'sentiment' column filled with 0.0.
    """
    all_dates = pd.date_range(start=start_date, end=end_date, freq="D")
    df = pd.DataFrame({"sentiment": 0.0}, index=all_dates)
    return df


def create_sentiment_feed(
    sentiment_df: pd.DataFrame,
    start_date: date,
    end_date: date,
    name: str = "sentiment",
) -> SentimentDataFeed:
    """
    Create a Backtrader-compatible sentiment data feed.
    
    Args:
        sentiment_df: DataFrame with DatetimeIndex and 'sentiment' column.
        start_date: Backtest start date.
        end_date: Backtest end date.
        name: Name for the data feed.
    
    Returns:
        SentimentDataFeed instance ready to be added to Cerebro.
    """
    return SentimentDataFeed(
        dataname=sentiment_df,
        name=name,
        fromdate=pd.Timestamp(start_date).to_pydatetime(),
        todate=pd.Timestamp(end_date).to_pydatetime(),
    )


def fetch_sentiment_data_sync(
    ticker: str,
    start_date: date,
    end_date: date,
) -> pd.DataFrame:
    """
    Synchronous wrapper for fetching sentiment data.
    
    Used in Celery workers where async context may not be available.
    Creates a new event loop to run the async query.
    
    Args:
        ticker: Stock ticker symbol.
        start_date: Start date.
        end_date: End date.
    
    Returns:
        DataFrame with sentiment data.
    """
    import asyncio
    from app.core.database import async_session_factory
    
    async def _fetch():
        async with async_session_factory() as session:
            return await fetch_sentiment_data(ticker, start_date, end_date, session)
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_fetch())
    finally:
        loop.close()




