"""
Custom Exception Handlers Module.

This module defines application-specific exceptions that provide
clear error messages and appropriate HTTP status codes.

All custom exceptions inherit from EcoQuantException base class
for consistent error handling across the application.

Usage:
    from app.core.exceptions import StrategyNotFoundError
    
    if not strategy:
        raise StrategyNotFoundError(strategy_id=123)
"""

from typing import Any, Dict, Optional

from fastapi import HTTPException, status


class EcoQuantException(Exception):
    """
    Base exception class for all EcoQuant custom exceptions.
    
    Provides consistent error structure with message and optional details.
    """
    
    def __init__(
        self,
        message: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.message = message
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for JSON serialization."""
        return {
            "error": self.__class__.__name__,
            "message": self.message,
            "details": self.details,
        }


# =============================================================================
# Database Exceptions
# =============================================================================

class DatabaseConnectionError(EcoQuantException):
    """Raised when database connection fails or is unavailable."""
    
    def __init__(self, message: str = "Database connection failed") -> None:
        super().__init__(message=message)


class DatabaseTransactionError(EcoQuantException):
    """Raised when a database transaction fails."""
    
    def __init__(
        self,
        message: str = "Database transaction failed",
        operation: Optional[str] = None,
    ) -> None:
        super().__init__(
            message=message,
            details={"operation": operation} if operation else {},
        )


# =============================================================================
# Authentication & Authorization Exceptions
# =============================================================================

class AuthenticationError(EcoQuantException):
    """Raised when authentication fails."""
    
    def __init__(self, message: str = "Authentication failed") -> None:
        super().__init__(message=message)


class InvalidCredentialsError(AuthenticationError):
    """Raised when provided credentials are invalid."""
    
    def __init__(self) -> None:
        super().__init__(message="Invalid email or password")


class TokenExpiredError(AuthenticationError):
    """Raised when JWT token has expired."""
    
    def __init__(self) -> None:
        super().__init__(message="Token has expired")


class InvalidTokenError(AuthenticationError):
    """Raised when JWT token is malformed or invalid."""
    
    def __init__(self) -> None:
        super().__init__(message="Invalid or malformed token")


class InsufficientPermissionsError(EcoQuantException):
    """Raised when user lacks required permissions."""
    
    def __init__(self, required_permission: Optional[str] = None) -> None:
        message = "Insufficient permissions"
        details = {}
        if required_permission:
            details["required"] = required_permission
            message = f"Missing required permission: {required_permission}"
        super().__init__(message=message, details=details)


# =============================================================================
# User Exceptions
# =============================================================================

class UserNotFoundError(EcoQuantException):
    """Raised when requested user does not exist."""
    
    def __init__(self, user_id: Optional[int] = None, email: Optional[str] = None) -> None:
        identifier = user_id or email or "unknown"
        super().__init__(
            message=f"User not found: {identifier}",
            details={"user_id": user_id, "email": email},
        )


class UserAlreadyExistsError(EcoQuantException):
    """Raised when attempting to create a user that already exists."""
    
    def __init__(self, email: str) -> None:
        super().__init__(
            message=f"User with email '{email}' already exists",
            details={"email": email},
        )


class UserInactiveError(EcoQuantException):
    """Raised when attempting to authenticate an inactive user."""
    
    def __init__(self, email: str) -> None:
        super().__init__(
            message="User account is inactive",
            details={"email": email},
        )


# =============================================================================
# Strategy Exceptions
# =============================================================================

class StrategyNotFoundError(EcoQuantException):
    """Raised when requested strategy does not exist."""
    
    def __init__(self, strategy_id: int) -> None:
        super().__init__(
            message=f"Strategy not found: {strategy_id}",
            details={"strategy_id": strategy_id},
        )


class InvalidStrategyConfigError(EcoQuantException):
    """Raised when strategy configuration is invalid."""
    
    def __init__(self, message: str, config_errors: Optional[Dict[str, str]] = None) -> None:
        super().__init__(
            message=message,
            details={"config_errors": config_errors or {}},
        )


class StrategyExecutionError(EcoQuantException):
    """Raised when strategy execution fails."""
    
    def __init__(self, strategy_id: int, reason: str) -> None:
        super().__init__(
            message=f"Strategy execution failed: {reason}",
            details={"strategy_id": strategy_id, "reason": reason},
        )


# =============================================================================
# Backtest Exceptions
# =============================================================================

class BacktestNotFoundError(EcoQuantException):
    """Raised when requested backtest result does not exist."""
    
    def __init__(self, backtest_id: int) -> None:
        super().__init__(
            message=f"Backtest not found: {backtest_id}",
            details={"backtest_id": backtest_id},
        )


class BacktestInProgressError(EcoQuantException):
    """Raised when backtest is still running."""
    
    def __init__(self, backtest_id: int, task_id: str) -> None:
        super().__init__(
            message=f"Backtest {backtest_id} is still in progress",
            details={"backtest_id": backtest_id, "task_id": task_id},
        )


class BacktestFailedError(EcoQuantException):
    """Raised when backtest execution fails."""
    
    def __init__(self, reason: str, strategy_id: Optional[int] = None) -> None:
        super().__init__(
            message=f"Backtest failed: {reason}",
            details={"strategy_id": strategy_id, "reason": reason},
        )


class InvalidDateRangeError(EcoQuantException):
    """Raised when date range for backtest is invalid."""
    
    def __init__(self, start_date: str, end_date: str) -> None:
        super().__init__(
            message=f"Invalid date range: {start_date} to {end_date}",
            details={"start_date": start_date, "end_date": end_date},
        )


# =============================================================================
# Data Exceptions
# =============================================================================

class DataFetchError(EcoQuantException):
    """Raised when fetching market data fails."""
    
    def __init__(self, symbol: str, reason: str) -> None:
        super().__init__(
            message=f"Failed to fetch data for {symbol}: {reason}",
            details={"symbol": symbol, "reason": reason},
        )


class InsufficientDataError(EcoQuantException):
    """Raised when insufficient data is available for analysis."""
    
    def __init__(self, symbol: str, required_days: int, available_days: int) -> None:
        super().__init__(
            message=f"Insufficient data for {symbol}: need {required_days} days, have {available_days}",
            details={
                "symbol": symbol,
                "required_days": required_days,
                "available_days": available_days,
            },
        )


# =============================================================================
# HTTP Exception Converters
# =============================================================================

def to_http_exception(exc: EcoQuantException) -> HTTPException:
    """
    Convert EcoQuantException to FastAPI HTTPException.
    
    Maps custom exceptions to appropriate HTTP status codes.
    
    Args:
        exc: The EcoQuant exception to convert.
    
    Returns:
        HTTPException: FastAPI HTTP exception with proper status code.
    """
    status_code_map = {
        # 400 Bad Request
        InvalidStrategyConfigError: status.HTTP_400_BAD_REQUEST,
        InvalidDateRangeError: status.HTTP_400_BAD_REQUEST,
        
        # 401 Unauthorized
        AuthenticationError: status.HTTP_401_UNAUTHORIZED,
        InvalidCredentialsError: status.HTTP_401_UNAUTHORIZED,
        TokenExpiredError: status.HTTP_401_UNAUTHORIZED,
        InvalidTokenError: status.HTTP_401_UNAUTHORIZED,
        
        # 403 Forbidden
        InsufficientPermissionsError: status.HTTP_403_FORBIDDEN,
        UserInactiveError: status.HTTP_403_FORBIDDEN,
        
        # 404 Not Found
        UserNotFoundError: status.HTTP_404_NOT_FOUND,
        StrategyNotFoundError: status.HTTP_404_NOT_FOUND,
        BacktestNotFoundError: status.HTTP_404_NOT_FOUND,
        
        # 409 Conflict
        UserAlreadyExistsError: status.HTTP_409_CONFLICT,
        BacktestInProgressError: status.HTTP_409_CONFLICT,
        
        # 500 Internal Server Error
        DatabaseConnectionError: status.HTTP_500_INTERNAL_SERVER_ERROR,
        DatabaseTransactionError: status.HTTP_500_INTERNAL_SERVER_ERROR,
        StrategyExecutionError: status.HTTP_500_INTERNAL_SERVER_ERROR,
        BacktestFailedError: status.HTTP_500_INTERNAL_SERVER_ERROR,
        
        # 503 Service Unavailable
        DataFetchError: status.HTTP_503_SERVICE_UNAVAILABLE,
    }
    
    status_code = status_code_map.get(
        type(exc),
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
    
    return HTTPException(
        status_code=status_code,
        detail=exc.to_dict(),
    )

