"""
Database Configuration and Session Management Module.

This module provides async database connectivity using SQLAlchemy 2.0
with asyncpg driver for PostgreSQL.

Features:
- Async session management with context managers
- Connection pooling configuration
- Health check functionality
- Transaction management utilities

Usage:
    from app.core.database import get_db_session
    
    async with get_db_session() as session:
        result = await session.execute(query)
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings
from app.core.exceptions import DatabaseConnectionError


class Base(DeclarativeBase):
    """
    SQLAlchemy declarative base class.
    
    All ORM models should inherit from this class.
    Provides common functionality and metadata for all models.
    """
    pass


def create_database_engine() -> AsyncEngine:
    """
    Create and configure the async database engine.
    
    Configures connection pooling and other database-specific settings
    for optimal performance in production environments.
    
    Returns:
        AsyncEngine: Configured SQLAlchemy async engine.
    """
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,  # SQL logging in debug mode
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_recycle=settings.DB_POOL_RECYCLE,
        pool_pre_ping=True,  # Verify connections before use
    )
    return engine


# Global engine instance
engine = create_database_engine()

# Session factory with optimized settings
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Prevent lazy loading issues
    autoflush=False,  # Manual flush for better control
    autocommit=False,
)


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Async context manager for database sessions.
    
    Provides automatic session cleanup and transaction management.
    Commits on successful exit, rolls back on exception.
    
    Yields:
        AsyncSession: Active database session.
    
    Raises:
        DatabaseConnectionError: If database connection fails.
    
    Example:
        async with get_db_session() as session:
            user = await session.get(User, user_id)
            user.name = "New Name"
            await session.commit()
    """
    session = async_session_factory()
    try:
        yield session
        await session.commit()
    except SQLAlchemyError as e:
        await session.rollback()
        raise DatabaseConnectionError(f"Database operation failed: {str(e)}") from e
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for database sessions.
    
    Use this in FastAPI route dependencies for automatic
    session injection and cleanup.
    
    Yields:
        AsyncSession: Active database session.
    
    Example:
        @router.get("/users/{user_id}")
        async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
            return await db.get(User, user_id)
    """
    async with get_db_session() as session:
        yield session


async def check_database_health() -> dict:
    """
    Check database connectivity and health.
    
    Performs a simple query to verify the database is accessible
    and responding correctly.
    
    Returns:
        dict: Health status with connection info.
    
    Raises:
        DatabaseConnectionError: If health check fails.
    """
    try:
        async with get_db_session() as session:
            result = await session.execute(text("SELECT 1 as health"))
            row = result.fetchone()
            
            if row and row[0] == 1:
                return {
                    "status": "healthy",
                    "database": "connected",
                    "pool_size": settings.DB_POOL_SIZE,
                }
    except Exception as e:
        raise DatabaseConnectionError(f"Database health check failed: {str(e)}") from e
    
    raise DatabaseConnectionError("Database health check returned unexpected result")


async def create_all_tables() -> None:
    """
    Create all database tables defined in models.
    
    Should only be used in development or testing.
    Use Alembic migrations in production.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_all_tables() -> None:
    """
    Drop all database tables.
    
    WARNING: This will delete all data! Only use in testing.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def dispose_engine() -> None:
    """
    Dispose of the database engine and close all connections.
    
    Should be called during application shutdown.
    """
    await engine.dispose()

