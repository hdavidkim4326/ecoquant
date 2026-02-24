"""
News Collector Service.

This module provides functionality to fetch financial news articles
from external sources using yfinance.

Usage:
    from app.services.news_collector import NewsCollector
    
    collector = NewsCollector()
    news_items = await collector.fetch_news("AAPL")
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional, Set

import yfinance as yf
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.news import News

logger = logging.getLogger(__name__)


@dataclass
class NewsItem:
    """
    Data class representing a news article.
    
    Attributes:
        ticker: Stock ticker symbol.
        title: News article title.
        url: Original article URL.
        published_at: Publication timestamp.
        publisher: News publisher name.
    """
    ticker: str
    title: str
    url: str
    published_at: Optional[datetime] = None
    publisher: Optional[str] = None


class NewsCollector:
    """
    Collects financial news from yfinance.
    
    Uses yfinance.Ticker.news to fetch recent news articles
    for specified stock tickers. Includes deduplication logic
    to prevent storing duplicate articles.
    
    Example:
        collector = NewsCollector()
        
        # Fetch news (returns only new articles)
        news = await collector.fetch_news("TSLA", session=db)
        
        # Save to database
        await collector.save_news(news, session=db)
    """
    
    def __init__(self) -> None:
        """Initialize the news collector."""
        pass
    
    def _fetch_from_yfinance(self, ticker: str) -> List[NewsItem]:
        """
        Fetch news from yfinance (synchronous).
        
        Args:
            ticker: Stock ticker symbol.
        
        Returns:
            List of NewsItem objects.
        """
        try:
            stock = yf.Ticker(ticker)
            raw_news = stock.news or []
            
            news_items = []
            for article in raw_news:
                # Parse publication timestamp
                published_at = None
                if "providerPublishTime" in article:
                    try:
                        published_at = datetime.fromtimestamp(
                            article["providerPublishTime"],
                            tz=timezone.utc,
                        )
                    except (ValueError, TypeError, OSError):
                        pass
                
                # Extract required fields
                title = article.get("title", "")
                url = article.get("link", "")
                publisher = article.get("publisher", "")
                
                if title and url:
                    news_items.append(
                        NewsItem(
                            ticker=ticker.upper(),
                            title=title,
                            url=url,
                            published_at=published_at,
                            publisher=publisher,
                        )
                    )
            
            logger.info(
                f"Fetched {len(news_items)} news articles for {ticker}"
            )
            return news_items
            
        except Exception as e:
            logger.error(f"Failed to fetch news for {ticker}: {e}")
            return []
    
    async def get_existing_urls(
        self,
        ticker: str,
        session: AsyncSession,
    ) -> Set[str]:
        """
        Get URLs of existing news articles for a ticker.
        
        Args:
            ticker: Stock ticker symbol.
            session: Database session.
        
        Returns:
            Set of existing article URLs.
        """
        result = await session.execute(
            select(News.url).where(News.ticker == ticker.upper())
        )
        return {row[0] for row in result.fetchall()}
    
    async def fetch_news(
        self,
        ticker: str,
        session: AsyncSession,
    ) -> List[NewsItem]:
        """
        Fetch new news articles (excluding duplicates).
        
        Fetches news from yfinance and filters out articles
        that already exist in the database.
        
        Args:
            ticker: Stock ticker symbol.
            session: Database session.
        
        Returns:
            List of new NewsItem objects not in database.
        """
        # Fetch all news from yfinance
        all_news = self._fetch_from_yfinance(ticker)
        
        if not all_news:
            return []
        
        # Get existing URLs to filter duplicates
        existing_urls = await self.get_existing_urls(ticker, session)
        
        # Filter out duplicates
        new_news = [
            item for item in all_news
            if item.url not in existing_urls
        ]
        
        logger.info(
            f"Found {len(new_news)} new articles out of "
            f"{len(all_news)} total for {ticker}"
        )
        
        return new_news
    
    async def save_news(
        self,
        news_items: List[NewsItem],
        session: AsyncSession,
    ) -> List[News]:
        """
        Save news articles to the database.
        
        Creates News records without AI analysis (to be filled later).
        
        Args:
            news_items: List of NewsItem objects to save.
            session: Database session.
        
        Returns:
            List of created News model instances.
        """
        created_news = []
        
        for item in news_items:
            news = News(
                ticker=item.ticker,
                title=item.title,
                url=item.url,
                published_at=item.published_at,
                sentiment_score=None,  # To be filled by AI
                summary=None,          # To be filled by AI
                ai_model=None,
            )
            session.add(news)
            created_news.append(news)
        
        if created_news:
            await session.flush()  # Get IDs without committing
            logger.info(f"Saved {len(created_news)} news articles to database")
        
        return created_news
    
    async def fetch_and_save(
        self,
        ticker: str,
        session: AsyncSession,
    ) -> List[News]:
        """
        Fetch and save new news articles in one operation.
        
        Convenience method that combines fetching and saving.
        
        Args:
            ticker: Stock ticker symbol.
            session: Database session.
        
        Returns:
            List of newly created News records.
        """
        news_items = await self.fetch_news(ticker, session)
        return await self.save_news(news_items, session)




