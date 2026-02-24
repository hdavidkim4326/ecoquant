"""
Security Module for Authentication and Authorization.

This module provides:
- Password hashing and verification using bcrypt
- JWT token creation and validation
- Authentication dependencies for FastAPI routes

Usage:
    from app.core.security import (
        hash_password,
        verify_password,
        create_access_token,
        get_current_user,
    )
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.core.config import settings
from app.core.exceptions import (
    InvalidTokenError,
    TokenExpiredError,
)


# =============================================================================
# Password Hashing Configuration
# =============================================================================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=settings.PASSWORD_HASH_ROUNDS,
)


def hash_password(password: str) -> str:
    """
    Hash a plain text password using bcrypt.
    
    Args:
        password: Plain text password to hash.
    
    Returns:
        str: Hashed password string.
    
    Example:
        hashed = hash_password("mysecretpassword")
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain text password against a hashed password.
    
    Args:
        plain_password: Plain text password to verify.
        hashed_password: Hashed password to compare against.
    
    Returns:
        bool: True if password matches, False otherwise.
    
    Example:
        if verify_password("mysecretpassword", user.hashed_password):
            print("Password is correct!")
    """
    return pwd_context.verify(plain_password, hashed_password)


# =============================================================================
# JWT Token Models
# =============================================================================

class TokenPayload(BaseModel):
    """JWT token payload structure."""
    
    sub: str  # Subject (user ID)
    exp: datetime  # Expiration time
    iat: datetime  # Issued at
    type: str  # Token type: "access" or "refresh"


class TokenResponse(BaseModel):
    """Response model for token endpoints."""
    
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # Seconds until access token expires


# =============================================================================
# JWT Token Creation
# =============================================================================

def create_token(
    subject: str,
    token_type: str,
    expires_delta: timedelta,
    additional_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Create a JWT token with specified claims.
    
    Args:
        subject: The subject of the token (usually user ID).
        token_type: Type of token ("access" or "refresh").
        expires_delta: Time until token expires.
        additional_claims: Extra claims to include in the token.
    
    Returns:
        str: Encoded JWT token string.
    """
    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    
    payload = {
        "sub": str(subject),
        "exp": expire,
        "iat": now,
        "type": token_type,
    }
    
    if additional_claims:
        payload.update(additional_claims)
    
    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_access_token(
    subject: str,
    additional_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Create a short-lived access token.
    
    Args:
        subject: The subject of the token (usually user ID).
        additional_claims: Extra claims to include in the token.
    
    Returns:
        str: Encoded JWT access token.
    
    Example:
        token = create_access_token(subject=str(user.id))
    """
    return create_token(
        subject=subject,
        token_type="access",
        expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
        additional_claims=additional_claims,
    )


def create_refresh_token(
    subject: str,
    additional_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Create a long-lived refresh token.
    
    Args:
        subject: The subject of the token (usually user ID).
        additional_claims: Extra claims to include in the token.
    
    Returns:
        str: Encoded JWT refresh token.
    
    Example:
        refresh = create_refresh_token(subject=str(user.id))
    """
    return create_token(
        subject=subject,
        token_type="refresh",
        expires_delta=timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
        additional_claims=additional_claims,
    )


def create_tokens(subject: str) -> TokenResponse:
    """
    Create both access and refresh tokens.
    
    Args:
        subject: The subject of the tokens (usually user ID).
    
    Returns:
        TokenResponse: Object containing both tokens and metadata.
    """
    return TokenResponse(
        access_token=create_access_token(subject),
        refresh_token=create_refresh_token(subject),
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# =============================================================================
# JWT Token Validation
# =============================================================================

def decode_token(token: str) -> TokenPayload:
    """
    Decode and validate a JWT token.
    
    Args:
        token: The JWT token string to decode.
    
    Returns:
        TokenPayload: Decoded token payload.
    
    Raises:
        TokenExpiredError: If the token has expired.
        InvalidTokenError: If the token is malformed or invalid.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        
        return TokenPayload(
            sub=payload["sub"],
            exp=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
            iat=datetime.fromtimestamp(payload["iat"], tz=timezone.utc),
            type=payload.get("type", "access"),
        )
        
    except jwt.ExpiredSignatureError:
        raise TokenExpiredError()
    except JWTError:
        raise InvalidTokenError()


def verify_access_token(token: str) -> str:
    """
    Verify an access token and return the subject (user ID).
    
    Args:
        token: The JWT access token to verify.
    
    Returns:
        str: The subject (user ID) from the token.
    
    Raises:
        InvalidTokenError: If token is not an access token.
    """
    payload = decode_token(token)
    
    if payload.type != "access":
        raise InvalidTokenError()
    
    return payload.sub


def verify_refresh_token(token: str) -> str:
    """
    Verify a refresh token and return the subject (user ID).
    
    Args:
        token: The JWT refresh token to verify.
    
    Returns:
        str: The subject (user ID) from the token.
    
    Raises:
        InvalidTokenError: If token is not a refresh token.
    """
    payload = decode_token(token)
    
    if payload.type != "refresh":
        raise InvalidTokenError()
    
    return payload.sub


# =============================================================================
# FastAPI Dependencies
# =============================================================================

# HTTP Bearer token extractor
security_scheme = HTTPBearer(
    scheme_name="JWT",
    description="Enter your JWT access token",
    auto_error=True,
)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> int:
    """
    FastAPI dependency to extract and validate user ID from JWT token.
    
    Use this dependency in routes that require authentication.
    
    Args:
        credentials: HTTP Authorization header with Bearer token.
    
    Returns:
        int: The authenticated user's ID.
    
    Raises:
        HTTPException: If token is invalid or expired.
    
    Example:
        @router.get("/me")
        async def get_current_user(user_id: int = Depends(get_current_user_id)):
            return {"user_id": user_id}
    """
    try:
        user_id_str = verify_access_token(credentials.credentials)
        return int(user_id_str)
    except (TokenExpiredError, InvalidTokenError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e.message),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )


# Optional authentication (for public endpoints that can be enhanced with auth)
async def get_optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
) -> Optional[int]:
    """
    FastAPI dependency for optional authentication.
    
    Returns user ID if valid token is provided, None otherwise.
    Useful for endpoints that work for both authenticated and anonymous users.
    
    Returns:
        Optional[int]: User ID if authenticated, None otherwise.
    """
    if not credentials:
        return None
    
    try:
        user_id_str = verify_access_token(credentials.credentials)
        return int(user_id_str)
    except (TokenExpiredError, InvalidTokenError, ValueError):
        return None

