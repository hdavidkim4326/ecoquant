"""Add sentiment strategy types to StrategyType enum

Revision ID: 004_sentiment_strategies
Revises: 003_news
Create Date: 2026-02-02

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '004_sentiment_strategies'
down_revision: Union[str, None] = '003_news'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add new sentiment strategy types to the enum."""
    # PostgreSQL requires ALTER TYPE to add new enum values
    # Note: In PostgreSQL, enum values cannot be removed, only added
    
    # Add new enum values for sentiment strategies
    op.execute("ALTER TYPE strategytype ADD VALUE IF NOT EXISTS 'sentiment_sma'")
    op.execute("ALTER TYPE strategytype ADD VALUE IF NOT EXISTS 'sentiment_sma_aggressive'")
    op.execute("ALTER TYPE strategytype ADD VALUE IF NOT EXISTS 'sentiment_sma_conservative'")


def downgrade() -> None:
    """
    Note: PostgreSQL does not support removing enum values.
    
    To fully downgrade, you would need to:
    1. Create a new enum without the values
    2. Alter the column to use the new enum
    3. Drop the old enum
    4. Rename the new enum
    
    This is a complex operation and typically not recommended.
    The enum values will remain but be unused after downgrade.
    """
    pass




