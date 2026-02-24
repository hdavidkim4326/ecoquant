-- =============================================================================
-- EcoQuant Database Initialization Script
-- This script runs automatically when the PostgreSQL container starts
-- =============================================================================

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search optimization

-- Grant privileges (if using non-default user)
-- GRANT ALL PRIVILEGES ON DATABASE ecoquant_db TO ecoquant;

-- Create indexes for common queries (Alembic will handle table creation)
-- These are supplementary indexes beyond what SQLAlchemy creates

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'EcoQuant database initialized successfully';
END $$;

