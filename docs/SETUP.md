# PromptAds AI — Setup Guide

How to get the full PromptAds stack running for local development or production.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Docker)](#quick-start-docker)
3. [Manual Setup](#manual-setup)
4. [Environment Variables](#environment-variables)
5. [Database Migrations](#database-migrations)
6. [Running Tests](#running-tests)
7. [Production Deployment](#production-deployment)

---

## Prerequisites

- **Docker** and **Docker Compose** (recommended)
- Or manually: Python 3.11+, Node.js 18+, PostgreSQL 16, Qdrant, Redis

## Quick Start (Docker)

The fastest way to get everything running:

    git clone https://github.com/abhishek/promptads-ai.git
    cd promptads-ai

    # Copy and edit environment variables
    cp .env.example .env

    # Start all services
    docker compose up -d

This starts 5 containers:

| Service     | URL                   | Description       |
| ----------- | --------------------- | ----------------- |
| Backend API | http://localhost:8000 | FastAPI server    |
| Frontend    | http://localhost:3000 | Next.js dashboard |
| PostgreSQL  | localhost:5432        | Primary database  |
| Qdrant      | http://localhost:6333 | Vector store      |
| Redis       | localhost:6379        | Cache             |

**Verify it's running:**

    curl http://localhost:8000/health
    # { "status": "ok" }

**View logs:**

    docker compose logs -f backend
    docker compose logs -f frontend

**Stop everything:**

    docker compose down

**Reset everything (including data):**

    docker compose down -v

## Manual Setup

### Backend

    cd backend

    # Create virtual environment
    python -m venv .venv
    source .venv/bin/activate   # Linux/macOS
    # .venv\Scripts\activate    # Windows

    # Install dependencies
    pip install -r requirements.txt

    # Set environment variables
    cp .env.example .env
    # Edit .env with your database/service URLs

    # Run database migrations
    alembic upgrade head

    # Start the server
    uvicorn main:app --reload --port 8000

### Frontend

    cd frontend

    # Install dependencies
    npm install

    # Start the dev server
    npm run dev

The frontend runs at http://localhost:3000.

### External Services

You still need PostgreSQL, Qdrant, and Redis running. You can start just
those from Docker Compose:

    docker compose up -d postgres qdrant redis

## Environment Variables

Create a `.env` file in the project root. See `.env.example` for all options.

### Required

| Variable         | Description                   | Example                                                    |
| ---------------- | ----------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string  | `postgresql://promptads:changeme@localhost:5432/promptads` |
| `JWT_SECRET_KEY` | Secret for signing JWT tokens | `your-secret-key-here`                                     |

### Services

| Variable      | Description             | Default                  |
| ------------- | ----------------------- | ------------------------ |
| `QDRANT_HOST` | Qdrant server hostname  | `localhost`              |
| `QDRANT_PORT` | Qdrant server port      | `6333`                   |
| `REDIS_URL`   | Redis connection string | `redis://localhost:6379` |

### AI Engine

| Variable          | Description                 | Default            |
| ----------------- | --------------------------- | ------------------ |
| `EMBEDDING_MODEL` | sentence-transformers model | `all-MiniLM-L6-v2` |

### Frontend

| Variable              | Description                        | Default                 |
| --------------------- | ---------------------------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL` | Backend API URL (used by frontend) | `http://localhost:8000` |

## Database Migrations

PromptAds uses Alembic for database schema migrations.

    cd backend

    # Apply all pending migrations
    alembic upgrade head

    # Create a new migration after model changes
    alembic revision --autogenerate -m "description of change"

    # Rollback one migration
    alembic downgrade -1

    # View migration history
    alembic history

## Running Tests

    cd backend

    # Run all tests
    pytest

    # Run with coverage
    pytest --cov=. --cov-report=term-missing

    # Run specific test file
    pytest tests/test_engine.py

    # Run with verbose output
    pytest -v

## Production Deployment

### Recommended Architecture

    Load Balancer (nginx/Cloudflare)
        │
        ├── Backend API (multiple workers)
        │     uvicorn main:app --workers 4
        │
        ├── Frontend (static build)
        │     npm run build && npm start
        │
        ├── PostgreSQL (managed: RDS/Supabase)
        │
        ├── Qdrant (managed: Qdrant Cloud)
        │
        └── Redis (managed: ElastiCache/Upstash)

### Backend Production Config

    # Use multiple workers
    uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

    # Or with Gunicorn
    gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

### Frontend Production Build

    cd frontend
    npm run build
    npm start

### Environment Checklist

- [ ] Set a strong `JWT_SECRET_KEY` (not the default)
- [ ] Use a managed PostgreSQL with backups
- [ ] Use Qdrant Cloud or a dedicated Qdrant instance
- [ ] Use a managed Redis with persistence
- [ ] Set up HTTPS with a reverse proxy
- [ ] Configure CORS to allow only your frontend domain
- [ ] Set up monitoring and logging
- [ ] Run database migrations before deploying
