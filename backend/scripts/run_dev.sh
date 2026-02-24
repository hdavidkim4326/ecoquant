#!/bin/bash
# =============================================================================
# Development Server Startup Script
# =============================================================================

set -e

echo "🚀 Starting EcoQuant Development Server..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📋 Creating .env from env.example..."
    cp env.example .env
fi

# Start Docker services if not running
if ! docker compose ps | grep -q "postgres.*running"; then
    echo "🐳 Starting Docker services..."
    docker compose up -d postgres redis
    
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 5
fi

# Run database migrations
echo "📊 Running database migrations..."
alembic upgrade head || echo "⚠️  Migrations skipped (tables may already exist)"

# Start the FastAPI server
echo "🌐 Starting FastAPI server on http://localhost:8000"
echo "📚 API docs available at http://localhost:8000/docs"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

