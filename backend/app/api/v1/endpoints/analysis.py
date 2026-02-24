"""
Analysis Endpoints.

This module provides endpoints for real-time market analysis including:
- Live signal generation based on strategy parameters
- Current market sentiment analysis
- Strategy signal evaluation

Combines yfinance for market data and Gemini for news analysis.
"""

import logging
from datetime import datetime, timedelta
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.strategy import Strategy
from app.models.news import News
from app.services.news_collector import NewsCollector
from app.services.ai_analyst import AIAnalyst

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["Analysis"])


class LiveSignalRequest(BaseModel):
    """Request model for live signal generation."""
    strategy_id: int = Field(..., description="ID of the strategy to analyze")
    ticker: str = Field(..., description="Stock ticker symbol (e.g., AAPL, TSLA)")


class MarketData(BaseModel):
    """Current market data for a ticker."""
    ticker: str
    current_price: float
    previous_close: float
    change_percent: float
    volume: int
    day_high: float
    day_low: float
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None


class SentimentData(BaseModel):
    """Sentiment analysis data."""
    avg_sentiment: float
    sentiment_label: str  # "Bullish", "Neutral", "Bearish"
    news_count: int
    latest_news: list[dict]


class TechnicalData(BaseModel):
    """Technical analysis data."""
    fast_ma: float
    slow_ma: float
    ma_spread_percent: float
    trend: str  # "Bullish", "Bearish", "Neutral"
    crossover_status: str  # "Golden Cross", "Death Cross", "No Crossover"


class LiveSignalResponse(BaseModel):
    """Response model for live signal."""
    signal: str  # "BUY", "SELL", "HOLD"
    signal_strength: float  # 0.0 to 1.0
    confidence: str  # "High", "Medium", "Low"
    reasoning: list[str]
    market_data: MarketData
    sentiment_data: Optional[SentimentData] = None
    technical_data: Optional[TechnicalData] = None
    strategy_name: str
    timestamp: datetime


def get_sentiment_label(score: float) -> str:
    """Convert sentiment score to label."""
    if score > 0.2:
        return "Bullish"
    elif score < -0.2:
        return "Bearish"
    return "Neutral"


def calculate_signal_strength(
    ma_spread: float,
    sentiment: float,
    ai_weight: float,
    buy_threshold: float,
    panic_threshold: float,
) -> tuple[float, str]:
    """
    Calculate overall signal strength combining technical and sentiment.
    
    Returns:
        Tuple of (strength 0-1, confidence label)
    """
    # Technical strength based on MA spread
    tech_strength = min(abs(ma_spread) / 0.05, 1.0)  # Normalize to 0-1
    
    # Sentiment strength
    sentiment_strength = min(abs(sentiment) / 1.0, 1.0)
    
    # Combined strength with AI weight
    combined = (tech_strength * (1 - ai_weight)) + (sentiment_strength * ai_weight)
    
    # Confidence level
    if combined > 0.7:
        confidence = "High"
    elif combined > 0.4:
        confidence = "Medium"
    else:
        confidence = "Low"
    
    return combined, confidence


@router.post(
    "/live_signal",
    response_model=LiveSignalResponse,
    summary="Generate live trading signal",
    responses={
        200: {"description": "Live signal generated successfully"},
        404: {"description": "Strategy not found"},
        503: {"description": "Unable to fetch market data"},
    },
)
async def get_live_signal(
    request: LiveSignalRequest,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LiveSignalResponse:
    """
    Generate a live trading signal for a strategy and ticker.
    
    Combines:
    1. Current market data from yfinance
    2. Recent news sentiment from Gemini AI
    3. Technical analysis (MA calculations)
    4. Strategy logic to generate BUY/SELL/HOLD signal
    
    This endpoint provides real-time insight into what the strategy
    would do if evaluated at this moment.
    """
    # 1. Get strategy details
    result = await db.execute(
        select(Strategy).where(
            Strategy.id == request.strategy_id,
            Strategy.user_id == user_id,
        )
    )
    strategy = result.scalar_one_or_none()
    
    if not strategy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Strategy not found",
        )
    
    # 2. Extract strategy parameters
    logic_config = strategy.logic_config or {}
    fast_period = logic_config.get("fast_period", 10)
    slow_period = logic_config.get("slow_period", 30)
    buy_threshold = logic_config.get("buy_threshold", 0.2)
    panic_threshold = logic_config.get("panic_threshold", -0.5)
    sentiment_lookback = logic_config.get("sentiment_lookback", 3)
    ai_weight = logic_config.get("ai_weight", 0.5)
    stop_loss = logic_config.get("stop_loss", 0)
    take_profit = logic_config.get("take_profit", 0)
    
    # 3. Fetch current market data using yfinance
    try:
        import yfinance as yf
        import pandas as pd
        
        ticker_obj = yf.Ticker(request.ticker)
        
        # Get historical data for MA calculation
        hist = ticker_obj.history(period="3mo")
        if hist.empty:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Unable to fetch market data for {request.ticker}",
            )
        
        # Current price info
        info = ticker_obj.info
        current_price = hist["Close"].iloc[-1]
        previous_close = hist["Close"].iloc[-2] if len(hist) > 1 else current_price
        
        market_data = MarketData(
            ticker=request.ticker.upper(),
            current_price=round(current_price, 2),
            previous_close=round(previous_close, 2),
            change_percent=round(((current_price - previous_close) / previous_close) * 100, 2),
            volume=int(hist["Volume"].iloc[-1]),
            day_high=round(hist["High"].iloc[-1], 2),
            day_low=round(hist["Low"].iloc[-1], 2),
            fifty_two_week_high=info.get("fiftyTwoWeekHigh"),
            fifty_two_week_low=info.get("fiftyTwoWeekLow"),
        )
        
        # Calculate moving averages
        if len(hist) >= slow_period:
            fast_ma = hist["Close"].rolling(window=fast_period).mean().iloc[-1]
            slow_ma = hist["Close"].rolling(window=slow_period).mean().iloc[-1]
            prev_fast_ma = hist["Close"].rolling(window=fast_period).mean().iloc[-2]
            prev_slow_ma = hist["Close"].rolling(window=slow_period).mean().iloc[-2]
        else:
            fast_ma = current_price
            slow_ma = current_price
            prev_fast_ma = current_price
            prev_slow_ma = current_price
        
        ma_spread = (fast_ma - slow_ma) / slow_ma if slow_ma > 0 else 0
        
        # Determine trend and crossover
        if fast_ma > slow_ma:
            trend = "Bullish"
        elif fast_ma < slow_ma:
            trend = "Bearish"
        else:
            trend = "Neutral"
        
        # Check for crossover
        if prev_fast_ma <= prev_slow_ma and fast_ma > slow_ma:
            crossover_status = "Golden Cross"
        elif prev_fast_ma >= prev_slow_ma and fast_ma < slow_ma:
            crossover_status = "Death Cross"
        else:
            crossover_status = "No Crossover"
        
        technical_data = TechnicalData(
            fast_ma=round(fast_ma, 2),
            slow_ma=round(slow_ma, 2),
            ma_spread_percent=round(ma_spread * 100, 2),
            trend=trend,
            crossover_status=crossover_status,
        )
        
    except Exception as e:
        logger.error(f"Error fetching market data: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to fetch market data: {str(e)}",
        )
    
    # 4. Get sentiment data from recent news
    sentiment_data = None
    avg_sentiment = 0.0
    
    # Check if this is an AI strategy
    is_ai_strategy = "sentiment" in strategy.strategy_type.lower()
    
    if is_ai_strategy:
        # Fetch recent news sentiment from DB
        lookback_date = datetime.utcnow() - timedelta(days=sentiment_lookback)
        news_result = await db.execute(
            select(News)
            .where(
                News.ticker == request.ticker.upper(),
                News.published_at >= lookback_date,
            )
            .order_by(News.published_at.desc())
            .limit(10)
        )
        recent_news = news_result.scalars().all()
        
        if recent_news:
            sentiments = [n.sentiment_score for n in recent_news if n.sentiment_score is not None]
            avg_sentiment = sum(sentiments) / len(sentiments) if sentiments else 0.0
            
            sentiment_data = SentimentData(
                avg_sentiment=round(avg_sentiment, 2),
                sentiment_label=get_sentiment_label(avg_sentiment),
                news_count=len(recent_news),
                latest_news=[
                    {
                        "title": n.title,
                        "sentiment": n.sentiment_score,
                        "published_at": n.published_at.isoformat() if n.published_at else None,
                    }
                    for n in recent_news[:5]
                ],
            )
        else:
            # No recent news, try to fetch
            sentiment_data = SentimentData(
                avg_sentiment=0.0,
                sentiment_label="Neutral",
                news_count=0,
                latest_news=[],
            )
    
    # 5. Generate signal based on strategy logic
    reasoning = []
    signal = "HOLD"
    
    # Technical analysis reasoning
    if crossover_status == "Golden Cross":
        reasoning.append("🟢 골든크로스 발생: 단기 이평선이 장기 이평선을 상향 돌파")
        signal = "BUY"
    elif crossover_status == "Death Cross":
        reasoning.append("🔴 데드크로스 발생: 단기 이평선이 장기 이평선을 하향 돌파")
        signal = "SELL"
    else:
        if trend == "Bullish":
            reasoning.append(f"📈 상승 추세: 단기 MA({fast_ma:.2f}) > 장기 MA({slow_ma:.2f})")
        elif trend == "Bearish":
            reasoning.append(f"📉 하락 추세: 단기 MA({fast_ma:.2f}) < 장기 MA({slow_ma:.2f})")
        else:
            reasoning.append("➡️ 횡보 추세: 이평선 수렴 중")
    
    # AI sentiment reasoning (only for AI strategies)
    if is_ai_strategy and sentiment_data:
        if avg_sentiment >= buy_threshold:
            reasoning.append(f"🤖 AI 감성 긍정적: {avg_sentiment:.2f} >= {buy_threshold}")
            if signal == "BUY":
                reasoning.append("✅ 골든크로스 + AI 긍정 → 강한 매수 신호")
        elif avg_sentiment <= panic_threshold:
            reasoning.append(f"⚠️ AI 감성 급락: {avg_sentiment:.2f} <= {panic_threshold}")
            signal = "SELL"
            reasoning.append("🚨 패닉셀 조건 충족 → 즉시 매도 신호")
        else:
            reasoning.append(f"🔄 AI 감성 중립: {avg_sentiment:.2f} (매수 임계: {buy_threshold})")
            if signal == "BUY":
                signal = "HOLD"
                reasoning.append("⏸️ 골든크로스 있으나 AI 감성 부족 → 관망")
    
    # Risk management info
    if stop_loss > 0:
        reasoning.append(f"🛡️ 손절가 설정: -{stop_loss}%")
    if take_profit > 0:
        reasoning.append(f"🎯 익절가 설정: +{take_profit}%")
    
    # Calculate signal strength
    signal_strength, confidence = calculate_signal_strength(
        ma_spread, avg_sentiment, ai_weight, buy_threshold, panic_threshold
    )
    
    return LiveSignalResponse(
        signal=signal,
        signal_strength=round(signal_strength, 2),
        confidence=confidence,
        reasoning=reasoning,
        market_data=market_data,
        sentiment_data=sentiment_data,
        technical_data=technical_data,
        strategy_name=strategy.name,
        timestamp=datetime.utcnow(),
    )


@router.get(
    "/market/{ticker}",
    response_model=MarketData,
    summary="Get current market data for a ticker",
)
async def get_market_data(
    ticker: str,
    user_id: Annotated[int, Depends(get_current_user_id)],
) -> MarketData:
    """
    Fetch current market data for a ticker using yfinance.
    """
    try:
        import yfinance as yf
        
        ticker_obj = yf.Ticker(ticker)
        hist = ticker_obj.history(period="5d")
        
        if hist.empty:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No market data found for {ticker}",
            )
        
        info = ticker_obj.info
        current_price = hist["Close"].iloc[-1]
        previous_close = hist["Close"].iloc[-2] if len(hist) > 1 else current_price
        
        return MarketData(
            ticker=ticker.upper(),
            current_price=round(current_price, 2),
            previous_close=round(previous_close, 2),
            change_percent=round(((current_price - previous_close) / previous_close) * 100, 2),
            volume=int(hist["Volume"].iloc[-1]),
            day_high=round(hist["High"].iloc[-1], 2),
            day_low=round(hist["Low"].iloc[-1], 2),
            fifty_two_week_high=info.get("fiftyTwoWeekHigh"),
            fifty_two_week_low=info.get("fiftyTwoWeekLow"),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching market data for {ticker}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to fetch market data: {str(e)}",
        )



