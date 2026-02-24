"""
SQLAlchemy Model Mixins.

This module provides reusable mixins for common model functionality.
All models should use these mixins for consistent behavior.
"""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, event
from sqlalchemy.orm import Mapped, mapped_column


class TimestampMixin:
    """
    Mixin that adds created_at and updated_at timestamp fields.
    
    Automatically sets created_at on insert and updates updated_at
    on every modification.
    
    Attributes:
        created_at: Timestamp when the record was created.
        updated_at: Timestamp when the record was last updated.
    """
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


def register_timestamp_listeners(mapper: Any, connection: Any, target: Any) -> None:
    """
    Event listener to update timestamps before insert/update.
    
    This ensures timestamps are always set correctly, even when
    bulk operations bypass the default value mechanism.
    """
    now = datetime.now(timezone.utc)
    
    if hasattr(target, 'updated_at'):
        target.updated_at = now


# Register event listeners for timestamp updates
# Note: This is registered per-model in the model definitions

