"""
Application Configuration Module.

This module uses Pydantic Settings to manage environment variables
with type validation and automatic loading from .env files.

Usage:
    from app.core.config import settings
    print(settings.DATABASE_URL)
"""

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    
    All settings can be overridden via environment variables.
    Sensitive defaults are only used in development.
    """
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
    
    # -------------------------------------------------------------------------
    # Application Settings
    # -------------------------------------------------------------------------
    APP_NAME: str = "EcoQuant"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = Field(default="development", pattern="^(development|staging|production)$")
    DEBUG: bool = True
    
    # -------------------------------------------------------------------------
    # Server Configuration
    # -------------------------------------------------------------------------
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4
    
    # -------------------------------------------------------------------------
    # Database Configuration
    # -------------------------------------------------------------------------
    POSTGRES_USER: str = "ecoquant"
    POSTGRES_PASSWORD: str = "ecoquant_secret_2024"
    POSTGRES_DB: str = "ecoquant_db"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://ecoquant:ecoquant_secret_2024@localhost:5432/ecoquant_db"
    )
    
    # Database Pool Settings
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800  # 30 minutes
    
    # -------------------------------------------------------------------------
    # Redis Configuration
    # -------------------------------------------------------------------------
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # -------------------------------------------------------------------------
    # Celery Configuration
    # -------------------------------------------------------------------------
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    CELERY_TASK_TRACK_STARTED: bool = True
    CELERY_TASK_TIME_LIMIT: int = 300  # 5 minutes max per task
    
    # -------------------------------------------------------------------------
    # Security & Authentication
    # -------------------------------------------------------------------------
    SECRET_KEY: str = Field(
        default="dev-secret-key-please-change-in-production-32chars",
        min_length=32,
    )
    
    # JWT Settings
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Password Hashing
    PASSWORD_HASH_ROUNDS: int = 12
    
    # -------------------------------------------------------------------------
    # CORS Settings
    # -------------------------------------------------------------------------
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | List[str]) -> str:
        """Ensure CORS origins is a string for storage, parsed later."""
        if isinstance(v, list):
            return ",".join(v)
        return v
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins string into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
    
    # -------------------------------------------------------------------------
    # External API Keys
    # -------------------------------------------------------------------------
    ALPHA_VANTAGE_API_KEY: str = ""
    FMP_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""  # Google Gemini API (for news sentiment analysis)
    
    # -------------------------------------------------------------------------
    # Google OAuth Configuration
    # -------------------------------------------------------------------------
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:3000/auth/google/callback"
    
    # -------------------------------------------------------------------------
    # Logging Configuration
    # -------------------------------------------------------------------------
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json | text
    
    # -------------------------------------------------------------------------
    # Backtest Configuration
    # -------------------------------------------------------------------------
    BACKTEST_DEFAULT_CASH: float = 100000.0
    BACKTEST_DEFAULT_COMMISSION: float = 0.001  # 0.1%
    BACKTEST_MAX_CONCURRENT: int = 5
    
    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.APP_ENV == "production"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.APP_ENV == "development"


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.
    
    Uses lru_cache to ensure settings are only loaded once
    during application lifecycle.
    
    Returns:
        Settings: Application settings instance.
    """
    return Settings()


# Global settings instance for easy import
settings = get_settings()

