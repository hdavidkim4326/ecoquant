"""
AI Analyst Service.

This module provides AI-powered sentiment analysis for financial news
using Google Gemini 1.5 Flash (optimized for cost efficiency).

Usage:
    from app.services.ai_analyst import AIAnalyst
    
    analyst = AIAnalyst()
    result = await analyst.analyze_news("Apple reports record earnings")
"""

import json
import logging
from dataclasses import dataclass
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class AnalysisResult:
    """
    Data class representing AI analysis results.
    
    Attributes:
        sentiment_score: Score from -1.0 (bearish) to 1.0 (bullish).
        summary: 3-line summary in Korean.
        ai_model: Name of AI model used.
        success: Whether analysis was successful.
        error: Error message if analysis failed.
    """
    sentiment_score: float
    summary: str
    ai_model: str
    success: bool = True
    error: Optional[str] = None


class AIAnalyst:
    """
    AI-powered financial news analyst using Google Gemini.
    
    Analyzes news headlines and generates:
    - Sentiment score (-1.0 to 1.0)
    - 3-line summary in Korean
    
    Uses Gemini 1.5 Flash for cost efficiency while maintaining
    quality analysis results.
    
    Example:
        analyst = AIAnalyst()
        
        # Analyze a news headline
        result = await analyst.analyze_news(
            title="Tesla stock surges on record deliveries",
            ticker="TSLA",
        )
        
        print(result.sentiment_score)  # 0.8
        print(result.summary)  # Korean summary
    """
    
    MODEL_NAME = "gemini-1.5-flash"
    
    ANALYSIS_PROMPT = """너는 퀀트 투자 전문가야. 아래 뉴스가 해당 기업({ticker}) 주가에 미칠 영향을 분석해줘.

뉴스 제목: {title}

다음 형식의 JSON으로만 응답해:
{{
    "sentiment_score": <-1.0에서 1.0 사이 실수. -1은 매우 악재, 0은 중립, 1은 매우 호재>,
    "summary": "<핵심 내용을 한국어로 3줄 요약. 각 줄은 \\n으로 구분>"
}}

분석 기준:
- 매출/이익 증가, 신제품 출시, 시장 확대: 양수 점수
- 매출/이익 감소, 소송, 규제, 경쟁 심화: 음수 점수
- 일반적인 정보나 중립적 뉴스: 0에 가까운 점수

JSON 외 다른 텍스트는 포함하지 마."""

    def __init__(self) -> None:
        """Initialize the AI analyst."""
        self._model = None
        self._initialized = False
    
    def _init_model(self) -> bool:
        """
        Initialize the Gemini model (lazy loading).
        
        Returns:
            True if initialization successful, False otherwise.
        """
        if self._initialized:
            return self._model is not None
        
        self._initialized = True
        
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            logger.warning(
                "GEMINI_API_KEY not configured. AI analysis will be unavailable."
            )
            return False
        
        try:
            import google.generativeai as genai
            
            genai.configure(api_key=api_key)
            self._model = genai.GenerativeModel(self.MODEL_NAME)
            logger.info(f"Initialized Gemini model: {self.MODEL_NAME}")
            return True
            
        except ImportError:
            logger.error(
                "google-generativeai package not installed. "
                "Install with: pip install google-generativeai"
            )
            return False
        except Exception as e:
            logger.error(f"Failed to initialize Gemini model: {e}")
            return False
    
    def _create_fallback_result(self, error_msg: str = "분석 불가") -> AnalysisResult:
        """
        Create a fallback result when AI analysis is unavailable.
        
        Args:
            error_msg: Error message to include.
        
        Returns:
            AnalysisResult with neutral score and error message.
        """
        return AnalysisResult(
            sentiment_score=0.0,
            summary="분석 불가: AI 서비스를 사용할 수 없습니다.",
            ai_model="fallback",
            success=False,
            error=error_msg,
        )
    
    def _parse_response(self, response_text: str) -> dict:
        """
        Parse JSON response from Gemini.
        
        Args:
            response_text: Raw response text from Gemini.
        
        Returns:
            Parsed JSON as dictionary.
        
        Raises:
            ValueError: If response cannot be parsed.
        """
        # Clean up response text (remove markdown code blocks if present)
        text = response_text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        
        text = text.strip()
        
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response: {text[:200]}")
            raise ValueError(f"Invalid JSON response: {e}")
    
    async def analyze_news(
        self,
        title: str,
        ticker: str,
    ) -> AnalysisResult:
        """
        Analyze a news headline and generate sentiment/summary.
        
        Args:
            title: News article title.
            ticker: Stock ticker symbol.
        
        Returns:
            AnalysisResult with sentiment score and summary.
        """
        # Initialize model if needed
        if not self._init_model():
            return self._create_fallback_result("API key not configured")
        
        try:
            # Build prompt
            prompt = self.ANALYSIS_PROMPT.format(
                ticker=ticker.upper(),
                title=title,
            )
            
            # Call Gemini API
            response = self._model.generate_content(prompt)
            
            if not response or not response.text:
                return self._create_fallback_result("Empty response from AI")
            
            # Parse response
            parsed = self._parse_response(response.text)
            
            # Extract and validate fields
            sentiment_score = float(parsed.get("sentiment_score", 0))
            sentiment_score = max(-1.0, min(1.0, sentiment_score))  # Clamp
            
            summary = parsed.get("summary", "요약을 생성할 수 없습니다.")
            
            logger.info(
                f"Analyzed news for {ticker}: score={sentiment_score:.2f}"
            )
            
            return AnalysisResult(
                sentiment_score=sentiment_score,
                summary=summary,
                ai_model=self.MODEL_NAME,
                success=True,
            )
            
        except ValueError as e:
            logger.error(f"Failed to parse AI response: {e}")
            return self._create_fallback_result(str(e))
        except Exception as e:
            logger.error(f"AI analysis failed: {e}")
            return self._create_fallback_result(str(e))
    
    async def analyze_batch(
        self,
        news_items: list[tuple[str, str]],
    ) -> list[AnalysisResult]:
        """
        Analyze multiple news items.
        
        Args:
            news_items: List of (title, ticker) tuples.
        
        Returns:
            List of AnalysisResult objects.
        """
        results = []
        for title, ticker in news_items:
            result = await self.analyze_news(title, ticker)
            results.append(result)
        return results




