"""
Authentication Endpoints.

This module provides endpoints for user authentication including:
- User registration
- Login (token generation)
- Token refresh
- Current user info
- Google OAuth authentication

All passwords are hashed using bcrypt before storage.
JWT tokens are used for stateless authentication.
"""

import secrets
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import (
    InvalidCredentialsError,
    UserAlreadyExistsError,
    UserInactiveError,
    UserNotFoundError,
    to_http_exception,
)
from app.core.security import (
    create_tokens,
    get_current_user_id,
    hash_password,
    verify_password,
    verify_refresh_token,
)
from app.models.user import User
from app.schemas.user import (
    RefreshTokenRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)


class GoogleTokenRequest(BaseModel):
    """Request model for Google OAuth token exchange."""
    code: str
    redirect_uri: Optional[str] = None

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    responses={
        201: {"description": "User successfully created"},
        409: {"description": "User with this email already exists"},
    },
)
async def register(
    user_data: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Register a new user account.
    
    - **email**: Valid email address (must be unique)
    - **password**: At least 8 characters with 1 letter and 1 digit
    - **full_name**: Optional display name
    """
    # Check if user already exists
    existing_user = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    if existing_user.scalar_one_or_none():
        raise to_http_exception(UserAlreadyExistsError(email=user_data.email))
    
    # Create new user
    user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        full_name=user_data.full_name,
        bio=user_data.bio,
        is_active=True,
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and get tokens",
    responses={
        200: {"description": "Successfully authenticated"},
        401: {"description": "Invalid credentials"},
        403: {"description": "User account is inactive"},
    },
)
async def login(
    credentials: UserLogin,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """
    Authenticate with email and password to receive JWT tokens.
    
    Returns:
    - **access_token**: Short-lived token for API access
    - **refresh_token**: Long-lived token for obtaining new access tokens
    - **expires_in**: Access token lifetime in seconds
    """
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == credentials.email)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise to_http_exception(InvalidCredentialsError())
    
    # Verify password
    if not verify_password(credentials.password, user.hashed_password):
        raise to_http_exception(InvalidCredentialsError())
    
    # Check if user is active
    if not user.is_active:
        raise to_http_exception(UserInactiveError(email=credentials.email))
    
    # Generate tokens
    return create_tokens(subject=str(user.id))


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    responses={
        200: {"description": "New tokens generated"},
        401: {"description": "Invalid or expired refresh token"},
    },
)
async def refresh_token(
    request: RefreshTokenRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """
    Get new access and refresh tokens using a valid refresh token.
    
    The old refresh token is invalidated after use (rotation).
    """
    try:
        user_id_str = verify_refresh_token(request.refresh_token)
        user_id = int(user_id_str)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    
    # Verify user still exists and is active
    user = await db.get(User, user_id)
    if not user:
        raise to_http_exception(UserNotFoundError(user_id=user_id))
    
    if not user.is_active:
        raise to_http_exception(UserInactiveError(email=user.email))
    
    # Generate new tokens
    return create_tokens(subject=str(user.id))


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user info",
    responses={
        200: {"description": "Current user details"},
        401: {"description": "Not authenticated"},
    },
)
async def get_current_user(
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Get the currently authenticated user's profile.
    
    Requires a valid access token in the Authorization header.
    """
    user = await db.get(User, user_id)
    
    if not user:
        raise to_http_exception(UserNotFoundError(user_id=user_id))
    
    return user


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Logout (client-side)",
)
async def logout() -> None:
    """
    Logout the current user.
    
    Note: Since we use stateless JWT tokens, actual logout happens
    client-side by discarding the tokens. This endpoint exists for
    API consistency and potential future server-side token invalidation.
    """
    # For stateless JWT, logout is handled client-side
    # Future: Add token to blacklist in Redis for immediate invalidation
    return None


# =============================================================================
# Google OAuth Endpoints
# =============================================================================

@router.get(
    "/google",
    summary="Get Google OAuth URL",
    responses={
        200: {"description": "Google OAuth authorization URL"},
    },
)
async def google_oauth_url():
    """
    Get the Google OAuth authorization URL.
    
    Redirect the user to this URL to start the OAuth flow.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        )
    
    # Generate a random state for CSRF protection
    state = secrets.token_urlsafe(32)
    
    google_oauth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={settings.GOOGLE_REDIRECT_URI}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        f"&state={state}"
        "&access_type=offline"
        "&prompt=consent"
    )
    
    return {
        "url": google_oauth_url,
        "state": state,
    }


@router.post(
    "/google/callback",
    response_model=TokenResponse,
    summary="Handle Google OAuth callback",
    responses={
        200: {"description": "Successfully authenticated with Google"},
        400: {"description": "Invalid authorization code"},
        503: {"description": "Google OAuth not configured"},
    },
)
async def google_oauth_callback(
    request: GoogleTokenRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """
    Exchange Google OAuth authorization code for tokens.
    
    This endpoint:
    1. Exchanges the authorization code for Google tokens
    2. Fetches user info from Google
    3. Creates or updates the user in our database
    4. Returns JWT tokens for our application
    """
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured",
        )
    
    redirect_uri = request.redirect_uri or settings.GOOGLE_REDIRECT_URI
    
    # Exchange authorization code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "code": request.code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
        )
        
        if token_response.status_code != 200:
            error_detail = token_response.json() if token_response.content else "Unknown error"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to exchange authorization code: {error_detail}",
            )
        
        tokens = token_response.json()
        access_token = tokens.get("access_token")
        
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No access token received from Google",
            )
        
        # Fetch user info from Google
        userinfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        
        if userinfo_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to fetch user info from Google",
            )
        
        google_user = userinfo_response.json()
    
    email = google_user.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No email received from Google",
        )
    
    # Check if user exists
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if user:
        # Update existing user's info if needed
        if not user.full_name and google_user.get("name"):
            user.full_name = google_user.get("name")
            await db.commit()
    else:
        # Create new user
        user = User(
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),  # Random password for OAuth users
            full_name=google_user.get("name"),
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    
    # Check if user is active
    if not user.is_active:
        raise to_http_exception(UserInactiveError(email=email))
    
    # Return our application's tokens
    return create_tokens(subject=str(user.id))

