#!/usr/bin/env bash
set -euo pipefail

# PromptAds AI - Development Setup Script
# ────────────────────────────────────────

echo "🚀 Setting up PromptAds AI..."

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required. Install: https://docs.docker.com/get-docker/"; exit 1; }
command -v docker compose >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required."; exit 1; }

# Create .env if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your OPENAI_API_KEY"
fi

# Start infrastructure
echo "🐳 Starting Docker containers..."
docker compose up -d postgres redis qdrant

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Backend setup
echo "🐍 Setting up backend..."
cd backend
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q poetry
poetry install --no-interaction
echo "📦 Running database migrations..."
alembic upgrade head 2>/dev/null || echo "⚠️  Run 'alembic revision --autogenerate -m init && alembic upgrade head' to initialize DB"
deactivate
cd ..

# Frontend setup
echo "⚛️  Setting up frontend..."
cd frontend
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Start the dev servers:"
echo "  Backend:  cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
echo "  Frontend: cd frontend && npm run dev"
echo ""
echo "Or use Docker Compose:"
echo "  docker compose up"
echo ""
echo "📖 API docs: http://localhost:8000/docs"
echo "🌐 Frontend: http://localhost:3000"
