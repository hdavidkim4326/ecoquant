#!/bin/bash
# =============================================================================
# Celery Worker Startup Script
# =============================================================================

set -e

echo "🔧 Starting EcoQuant Celery Worker..."

# Check if Redis is running
if ! docker compose ps | grep -q "redis.*running"; then
    echo "🐳 Starting Redis..."
    docker compose up -d redis
    sleep 2
fi

# Start Celery worker
celery -A app.worker worker \
    --loglevel=info \
    --concurrency=4 \
    -Q backtest,data,default

