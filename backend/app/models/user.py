"""
User Model Definition.

This module defines the User model for authentication and user management.
Passwords are stored as hashed values using bcrypt.

Table: users
"""

from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.strategy import Strategy


class User(Base, TimestampMixin):
    """
    User account model for authentication and authorization.
    
    Attributes:
        id: Primary key, auto-incrementing integer.
        email: Unique email address for login.
        hashed_password: Bcrypt hashed password.
        full_name: Optional display name.
        is_active: Whether the user account is active.
        is_superuser: Whether the user has admin privileges.
        strategies: Related trading strategies owned by this user.
    
    Example:
        user = User(
            email="trader@example.com",
            hashed_password=hash_password("secretpass"),
            full_name="John Trader",
        )
    """
    
    __tablename__ = "users"
    
    # Primary Key
    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
        index=True,
    )
    
    # Authentication Fields
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    
    # Profile Fields
    full_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    
    bio: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    
    # Status Fields
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    
    is_superuser: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    
    # Relationships
    strategies: Mapped[List["Strategy"]] = relationship(
        "Strategy",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    
    def __repr__(self) -> str:
        """String representation for debugging."""
        return f"<User(id={self.id}, email='{self.email}', active={self.is_active})>"
    
    def __str__(self) -> str:
        """Human-readable string representation."""
        return self.full_name or self.email

