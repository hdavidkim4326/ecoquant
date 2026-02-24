"""
Services Package.

This package contains business logic and external service integrations.

Services:
- news_collector: Fetches financial news from external sources
- ai_analyst: AI-powered sentiment analysis using Google Gemini
"""

from app.services.news_collector import NewsCollector
from app.services.ai_analyst import AIAnalyst

__all__ = [
    "NewsCollector",
    "AIAnalyst",
]




