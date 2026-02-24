"""
Celery Worker Configuration and Tasks.

This module configures the Celery application for background task processing.
Main tasks include:
- Backtest execution (long-running)
- Scheduled data updates
- Email notifications

Run worker with:
    celery -A app.worker worker --loglevel=info

Run beat scheduler with:
    celery -A app.worker beat --loglevel=info
"""

import json
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List

from celery import Celery, states
from celery.exceptions import SoftTimeLimitExceeded

from app.core.config import settings


def json_serializable(obj: Any) -> Any:
    """
    Convert non-JSON-serializable objects to serializable format.

    Handles:
    - date -> ISO format string
    - datetime -> ISO format string
    - Decimal -> float
    - Other objects -> str
    """
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    elif isinstance(obj, Decimal):
        return float(obj)
    elif hasattr(obj, "__dict__"):
        return str(obj)
    return obj


def make_json_safe(data: Any) -> Any:
    """
    Recursively convert a data structure to be JSON serializable.

    Args:
        data: Any data structure (dict, list, or primitive).

    Returns:
        JSON-safe version of the data.
    """
    if isinstance(data, dict):
        return {k: make_json_safe(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [make_json_safe(item) for item in data]
    elif isinstance(data, tuple):
        return [make_json_safe(item) for item in data]
    elif isinstance(data, (date, datetime)):
        return data.isoformat()
    elif isinstance(data, Decimal):
        return float(data)
    elif data is None or isinstance(data, (str, int, float, bool)):
        return data
    else:
        # Fallback: convert to string
        return str(data)


# Configure logging
logger = logging.getLogger(__name__)

# =============================================================================
# Celery Application Configuration
# =============================================================================

celery_app = Celery(
    "ecoquant",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# Celery configuration
# NOTE: All tasks use the default "celery" queue for simplicity.
# If you need multi-queue routing in production, restart worker with:
#   celery -A app.worker worker -Q celery,backtest,data,news --loglevel=info

# NOTE (fix): soft time limit can go negative if CELERY_TASK_TIME_LIMIT <= 30
_safe_soft_limit = max(1, int(settings.CELERY_TASK_TIME_LIMIT) - 30)

celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Task execution
    task_track_started=True,
    task_time_limit=settings.CELERY_TASK_TIME_LIMIT,
    task_soft_time_limit=_safe_soft_limit,
    # Result backend
    result_expires=3600 * 24,  # 24 hours
    # Worker settings
    worker_prefetch_multiplier=1,  # Fair task distribution
    worker_concurrency=4,
    # NOTE: task_routes removed - all tasks go to default "celery" queue
    # Beat schedule for periodic tasks (using default queue)
    beat_schedule={
        "update-market-data-daily": {
            "task": "app.worker.update_market_data",
            "schedule": 60 * 60 * 24,  # Every 24 hours
        },
    },
)


# =============================================================================
# Backtest Task
# =============================================================================

@celery_app.task(
    bind=True,
    name="app.worker.run_backtest_task",
    max_retries=2,
    default_retry_delay=60,
    soft_time_limit=280,
    time_limit=300,
)
def run_backtest_task(
    self,
    backtest_id: int,
    strategy_type: str,
    symbols: List[str],
    start_date: str,
    end_date: str,
    initial_capital: float,
    commission: float,
    strategy_params: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Execute a backtest as a Celery task.

    This task runs asynchronously and updates the BacktestResult
    record with the results upon completion.

    Args:
        backtest_id: ID of the BacktestResult to update.
        strategy_type: Type of strategy to use.
        symbols: List of ticker symbols.
        start_date: Start date (ISO format).
        end_date: End date (ISO format).
        initial_capital: Starting capital.
        commission: Trading commission rate.
        strategy_params: Strategy-specific parameters.

    Returns:
        Dict with status and result summary.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.core.config import settings
    from app.engine.runner import run_backtest
    from app.models.backtest import BacktestResult, BacktestStatus

    # =========================================================================
    # 1. Symbols 및 파라미터 기본값 설정
    # =========================================================================
    DEFAULT_SYMBOL = "AAPL"  # 기본 종목: Apple
    DEFAULT_INITIAL_CAPITAL = 100_000_000.0  # 1억원
    DEFAULT_POSITION_SIZE = 1.0  # 100%

    if not symbols or len(symbols) == 0:
        logger.warning(
            f"No symbols provided for backtest {backtest_id}, using default: {DEFAULT_SYMBOL}"
        )
        symbols = [DEFAULT_SYMBOL]

    # 빈 문자열 필터링
    symbols = [s.strip().upper() for s in symbols if s and s.strip()]
    if not symbols:
        symbols = [DEFAULT_SYMBOL]

    # 초기 자본금 검증
    if not initial_capital or initial_capital <= 0:
        logger.warning(
            f"Invalid initial_capital ({initial_capital}), using default: {DEFAULT_INITIAL_CAPITAL}"
        )
        initial_capital = DEFAULT_INITIAL_CAPITAL

    # strategy_params에서 position_size 확인 및 기본값 설정
    if strategy_params is None:
        strategy_params = {}

    if "position_size" not in strategy_params or not strategy_params.get("position_size"):
        strategy_params["position_size"] = DEFAULT_POSITION_SIZE
        logger.info(f"Using default position_size: {DEFAULT_POSITION_SIZE}")

    logger.info(
        f"Starting backtest task: id={backtest_id}, strategy={strategy_type}, "
        f"symbols={symbols}, initial_capital={initial_capital:,.0f}, "
        f"position_size={strategy_params.get('position_size', 'N/A')}"
    )

    # Update progress
    self.update_state(
        state="RUNNING",
        meta={"progress": 10, "message": "Initializing backtest..."},
    )

    # =========================================================================
    # 2. 동기 DB 세션 사용 (Event Loop 충돌 해결)
    # =========================================================================
    # Celery worker에서는 async 세션 대신 동기 세션 사용
    sync_database_url = (
        settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
        .replace("postgresql://", "postgresql+psycopg2://")
        .replace("postgres://", "postgresql+psycopg2://")
    )

    sync_engine = create_engine(sync_database_url)
    SyncSession = sessionmaker(bind=sync_engine)

    def update_backtest_status(status: BacktestStatus, **kwargs: Any) -> None:
        with SyncSession() as session:
            try:
                backtest = session.get(BacktestResult, backtest_id)
                if backtest:
                    backtest.status = status
                    for key, value in kwargs.items():
                        if hasattr(backtest, key):
                            setattr(backtest, key, value)
                    session.commit()
            except Exception as db_err:
                logger.error(f"DB Update failed: {db_err}")
                session.rollback()

    try:
        # Mark as running
        update_backtest_status(
            BacktestStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
        )

        self.update_state(
            state="RUNNING",
            meta={"progress": 20, "message": "Fetching market data..."},
        )

        # Parse dates
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)

        # Run the backtest
        result = run_backtest(
            strategy_type=strategy_type,
            symbols=symbols,
            start_date=start,
            end_date=end,
            initial_capital=initial_capital,
            commission=commission,
            strategy_params=strategy_params,
        )

        self.update_state(
            state="RUNNING",
            meta={"progress": 90, "message": "Saving results..."},
        )

        # NOTE (fix): use raw_metrics consistently (metrics var was undefined)
        raw_metrics: Dict[str, Any] = result.get("metrics", {}) or {}

        # trades 데이터를 metrics 안에 포함
        final_metrics = make_json_safe(raw_metrics)
        if "trades" not in final_metrics:
            final_metrics["trades"] = make_json_safe(result.get("trades", []))

        # (kept) not strictly needed, but keep structure minimal
        equity_curve_data = make_json_safe(result.get("equity_curve", []))  # noqa: F841

        # Update backtest record with results
        update_backtest_status(
            BacktestStatus.COMPLETED,
            completed_at=datetime.now(timezone.utc),
            final_value=Decimal(str(result.get("final_value", 0))),
            total_return=Decimal(str(raw_metrics.get("total_return", 0))),
            cagr=(
                Decimal(str(raw_metrics.get("cagr", 0)))
                if raw_metrics.get("cagr") is not None
                else None
            ),
            mdd=Decimal(str(raw_metrics.get("mdd", 0))),
            sharpe_ratio=Decimal(str(raw_metrics.get("sharpe_ratio", 0))),
            sortino_ratio=(
                Decimal(str(raw_metrics.get("sortino_ratio", 0)))
                if raw_metrics.get("sortino_ratio") is not None
                else None
            ),
            calmar_ratio=(
                Decimal(str(raw_metrics.get("calmar_ratio", 0)))
                if raw_metrics.get("calmar_ratio") is not None
                else None
            ),
            win_rate=Decimal(str(raw_metrics.get("win_rate", 0))),
            total_trades=raw_metrics.get("total_trades", 0) or 0,
            winning_trades=raw_metrics.get("winning_trades", 0) or 0,
            losing_trades=raw_metrics.get("losing_trades", 0) or 0,
            avg_win=(
                Decimal(str(raw_metrics.get("avg_win", 0)))
                if raw_metrics.get("avg_win") is not None
                else None
            ),
            avg_loss=(
                Decimal(str(raw_metrics.get("avg_loss", 0)))
                if raw_metrics.get("avg_loss") is not None
                else None
            ),
            profit_factor=(
                Decimal(str(raw_metrics.get("profit_factor", 0)))
                if raw_metrics.get("profit_factor") is not None
                else None
            ),
            execution_time_seconds=Decimal(str(result.get("execution_time", 0))),
            equity_curve={"data": make_json_safe(result.get("equity_curve", []))},
            metrics=final_metrics,
        )

        logger.info(f"Backtest {backtest_id} completed successfully")

        return {
            "status": "completed",
            "backtest_id": backtest_id,
            "total_return": raw_metrics.get("total_return"),
        }

    except SoftTimeLimitExceeded:
        logger.warning(f"Backtest {backtest_id} exceeded time limit")
        update_backtest_status(
            BacktestStatus.FAILED,
            error_message="Backtest exceeded maximum time limit",
            completed_at=datetime.now(timezone.utc),
        )
        raise

    except Exception as e:
        logger.exception(f"Backtest {backtest_id} failed: {e}")
        update_backtest_status(
            BacktestStatus.FAILED,
            error_message=str(e)[:500],
            completed_at=datetime.now(timezone.utc),
        )

        # NOTE (fix): ensure retry logic is reachable (remove unconditional raise e)
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)

        raise


# =============================================================================
# Data Update Task
# =============================================================================

@celery_app.task(
    name="app.worker.update_market_data",
    soft_time_limit=3600,
)
def update_market_data() -> Dict[str, Any]:
    """
    Periodic task to update cached market data.

    This task runs daily to pre-fetch common stock data
    and update any cached indicators.
    """
    logger.info("Starting market data update task")

    # Placeholder for actual implementation
    # In production, this would:
    # 1. Fetch latest data for popular symbols
    # 2. Update Redis cache
    # 3. Pre-calculate common indicators

    return {
        "status": "completed",
        "message": "Market data update task placeholder",
    }


# =============================================================================
# Notification Task
# =============================================================================

@celery_app.task(
    name="app.worker.send_notification",
    max_retries=3,
    default_retry_delay=30,
)
def send_notification(
    user_id: int,
    notification_type: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Send a notification to a user.

    Supports multiple notification channels:
    - email
    - push
    - websocket

    Args:
        user_id: Target user ID.
        notification_type: Type of notification (backtest_complete, signal, etc.).
        payload: Notification content.

    Returns:
        Dict with delivery status.
    """
    logger.info(f"Sending {notification_type} notification to user {user_id}")

    # Placeholder for actual implementation
    # Would integrate with email service, push notification service, etc.

    return {
        "status": "sent",
        "user_id": user_id,
        "type": notification_type,
    }


# =============================================================================
# News Collection & AI Analysis Task
# =============================================================================

@celery_app.task(
    bind=True,
    name="app.worker.fetch_and_analyze_news",
    max_retries=3,
    default_retry_delay=60,
    soft_time_limit=280,
    time_limit=300,
)
def fetch_and_analyze_news(
    self,
    ticker: str,
) -> Dict[str, Any]:
    """
    Fetch news for a ticker and analyze with AI.

    This task performs the following steps:
    1. Fetch news from yfinance
    2. Save new articles to database
    3. Analyze each article with Google Gemini
    4. Update database with sentiment scores and summaries

    Args:
        ticker: Stock ticker symbol (e.g., 'AAPL', 'TSLA').

    Returns:
        Dict with status and result summary.
    """
    import asyncio

    from app.core.database import async_session_factory
    from app.models.news import News  # noqa: F401
    from app.services.ai_analyst import AIAnalyst
    from app.services.news_collector import NewsCollector

    ticker = ticker.upper()
    logger.info(f"Starting news fetch and analysis task for {ticker}")

    self.update_state(
        state="RUNNING",
        meta={"progress": 10, "message": f"Fetching news for {ticker}..."},
    )

    async def run_news_pipeline() -> Dict[str, Any]:
        """Async pipeline for news collection and analysis."""
        collector = NewsCollector()
        analyst = AIAnalyst()

        async with async_session_factory() as session:
            # Step 1 & 2: Fetch and save new news
            self.update_state(
                state="RUNNING",
                meta={"progress": 20, "message": "Collecting news from yfinance..."},
            )

            new_articles = await collector.fetch_and_save(ticker, session)

            if not new_articles:
                logger.info(f"No new news found for {ticker}")
                return {
                    "status": "completed",
                    "ticker": ticker,
                    "new_articles": 0,
                    "analyzed": 0,
                    "message": "No new articles found",
                }

            # Commit the initial save
            await session.commit()

            # Step 3 & 4: Analyze each article with AI
            self.update_state(
                state="RUNNING",
                meta={
                    "progress": 50,
                    "message": f"Analyzing {len(new_articles)} articles with AI...",
                },
            )

            analyzed_count = 0
            for i, article in enumerate(new_articles):
                try:
                    # Analyze with AI
                    result = await analyst.analyze_news(
                        title=article.title,
                        ticker=ticker,
                    )

                    # Update article with AI results
                    article.sentiment_score = result.sentiment_score
                    article.summary = result.summary
                    article.ai_model = result.ai_model

                    if result.success:
                        analyzed_count += 1

                    # Update progress
                    progress = 50 + int((i + 1) / len(new_articles) * 40)
                    self.update_state(
                        state="RUNNING",
                        meta={
                            "progress": progress,
                            "message": f"Analyzed {i + 1}/{len(new_articles)} articles",
                        },
                    )

                except Exception as e:
                    logger.error(f"Failed to analyze article {article.id}: {e}")
                    article.sentiment_score = 0.0
                    article.summary = f"분석 실패: {str(e)}"
                    article.ai_model = "error"

            # Commit AI analysis results
            await session.commit()

            logger.info(
                f"Completed news analysis for {ticker}: "
                f"{len(new_articles)} new, {analyzed_count} analyzed"
            )

            return {
                "status": "completed",
                "ticker": ticker,
                "new_articles": len(new_articles),
                "analyzed": analyzed_count,
            }

    try:
        # Run the async pipeline
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(run_news_pipeline())
        finally:
            loop.close()

        return result

    except Exception as e:
        logger.exception(f"News task failed for {ticker}: {e}")

        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)

        return {
            "status": "failed",
            "ticker": ticker,
            "error": str(e),
        }
