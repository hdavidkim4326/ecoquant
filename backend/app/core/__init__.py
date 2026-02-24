"""
Core module containing fundamental configurations and utilities.

This module provides:
- Application configuration (config.py)
- Database session management (database.py)
- Custom exception handlers (exceptions.py)
- Security utilities including JWT and password hashing (security.py)
"""

from app.core.config import settings
from app.core.database import get_db_session

__all__ = ["settings", "get_db_session"]

