"""
User Schema Definitions.

Pydantic models for User-related API operations including
authentication, registration, and profile management.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserBase(BaseModel):
    """
    Base schema with common user fields.
    
    Shared between create and update operations.
    """
    
    email: EmailStr = Field(
        ...,
        description="User's email address for authentication",
        examples=["trader@example.com"],
    )
    
    full_name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
        description="User's display name",
        examples=["John Trader"],
    )
    
    bio: Optional[str] = Field(
        None,
        max_length=1000,
        description="User's bio or description",
    )


class UserCreate(UserBase):
    """
    Schema for user registration.
    
    Includes password with validation rules.
    """
    
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="User password (min 8 characters)",
        examples=["SecurePass123!"],
    )
    
    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """
        Validate password meets security requirements.
        
        Requirements:
        - At least 8 characters
        - Contains at least one digit
        - Contains at least one letter
        """
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")
        
        return v


class UserUpdate(BaseModel):
    """
    Schema for updating user profile.
    
    All fields are optional for partial updates.
    """
    
    email: Optional[EmailStr] = Field(
        None,
        description="New email address",
    )
    
    full_name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
    )
    
    bio: Optional[str] = Field(
        None,
        max_length=1000,
    )
    
    password: Optional[str] = Field(
        None,
        min_length=8,
        max_length=128,
        description="New password",
    )


class UserResponse(BaseModel):
    """
    Schema for user API responses.
    
    Excludes sensitive fields like password.
    """
    
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    bio: Optional[str] = None
    is_active: bool = True
    is_superuser: bool = False
    created_at: datetime
    updated_at: datetime


class UserLogin(BaseModel):
    """
    Schema for user login request.
    """
    
    email: EmailStr = Field(
        ...,
        description="Registered email address",
        examples=["trader@example.com"],
    )
    
    password: str = Field(
        ...,
        min_length=1,
        description="User password",
    )


class TokenResponse(BaseModel):
    """
    Schema for authentication token response.
    """
    
    access_token: str = Field(
        ...,
        description="JWT access token for API authentication",
    )
    
    refresh_token: str = Field(
        ...,
        description="JWT refresh token for obtaining new access tokens",
    )
    
    token_type: str = Field(
        default="bearer",
        description="Token type (always 'bearer')",
    )
    
    expires_in: int = Field(
        ...,
        description="Access token expiration time in seconds",
    )


class RefreshTokenRequest(BaseModel):
    """
    Schema for token refresh request.
    """
    
    refresh_token: str = Field(
        ...,
        description="Valid refresh token",
    )

