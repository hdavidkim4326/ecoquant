"""
News Model Definition.

This module defines the News model for storing financial news articles
and their AI-generated sentiment analysis results.

Table: news
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class News(Base, TimestampMixin):
    """
    Financial news article with AI sentiment analysis.
    
    Stores news articles fetched from external sources (e.g., yfinance)
    along with AI-generated sentiment scores and summaries.
    
    Attributes:
        id: Primary key, auto-incrementing integer.
        ticker: Stock ticker symbol (e.g., 'AAPL', 'TSLA').
        title: News article title.
        url: Original article URL (unique constraint for deduplication).
        published_at: When the article was published.
        sentiment_score: AI sentiment score (-1.0 to 1.0).
        summary: AI-generated summary in Korean (3 lines).
        ai_model: Name of AI model used for analysis.
    
    Example:
        news = News(
            ticker="AAPL",
            title="Apple Reports Record Quarter",
            url="https://example.com/news/apple",
            published_at=datetime.now(timezone.utc),
            sentiment_score=0.75,
            summary="애플 분기 매출 신기록...",
            ai_model="gemini-1.5-flash",
        )
    """
    
    __tablename__ = "news"
    
    # Create compound indexes for efficient queries
    __table_args__ = (
        Index("ix_news_ticker_published", "ticker", "published_at"),
        Index("ix_news_sentiment", "ticker", "sentiment_score"),
    )
    
    # Primary Key
    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
        index=True,
    )
    
    # Stock Ticker (indexed for fast lookups)
    ticker: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )
    
    # News Content
    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    
    url: Mapped[str] = mapped_column(
        String(2048),
        unique=True,  # Prevent duplicate news
        nullable=False,
        index=True,
    )
    
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    # AI Analysis Results
    sentiment_score: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Sentiment score from -1.0 (bearish) to 1.0 (bullish)",
    )
    
    summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="AI-generated 3-line summary in Korean",
    )
    
    ai_model: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Name of AI model used for analysis",
    )
    
    def __repr__(self) -> str:
        """String representation for debugging."""
        return (
            f"<News(id={self.id}, ticker='{self.ticker}', "
            f"sentiment={self.sentiment_score})>"
        )
    
    def __str__(self) -> str:
        """Human-readable string representation."""
        return f"[{self.ticker}] {self.title[:50]}..."




