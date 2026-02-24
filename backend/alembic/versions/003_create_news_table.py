"""Create news table for financial news and AI sentiment analysis

Revision ID: 003_news
Revises: 
Create Date: 2026-02-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003_news'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create news table and indexes."""
    op.create_table(
        'news',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('ticker', sa.String(length=20), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('url', sa.String(length=2048), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'sentiment_score', 
            sa.Float(), 
            nullable=True,
            comment='Sentiment score from -1.0 (bearish) to 1.0 (bullish)',
        ),
        sa.Column(
            'summary', 
            sa.Text(), 
            nullable=True,
            comment='AI-generated 3-line summary in Korean',
        ),
        sa.Column(
            'ai_model', 
            sa.String(length=50), 
            nullable=True,
            comment='Name of AI model used for analysis',
        ),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('url'),
    )
    
    # Create indexes for efficient queries
    op.create_index('ix_news_id', 'news', ['id'], unique=False)
    op.create_index('ix_news_ticker', 'news', ['ticker'], unique=False)
    op.create_index('ix_news_url', 'news', ['url'], unique=False)
    op.create_index('ix_news_ticker_published', 'news', ['ticker', 'published_at'], unique=False)
    op.create_index('ix_news_sentiment', 'news', ['ticker', 'sentiment_score'], unique=False)


def downgrade() -> None:
    """Drop news table and indexes."""
    op.drop_index('ix_news_sentiment', table_name='news')
    op.drop_index('ix_news_ticker_published', table_name='news')
    op.drop_index('ix_news_url', table_name='news')
    op.drop_index('ix_news_ticker', table_name='news')
    op.drop_index('ix_news_id', table_name='news')
    op.drop_table('news')




