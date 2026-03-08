# PromptAds AI — Architecture

System design document for the PromptAds AI contextual advertising platform.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Ad Matching Pipeline](#ad-matching-pipeline)
3. [Data Models](#data-models)
4. [API Design](#api-design)
5. [Frontend Dashboard](#frontend-dashboard)
6. [Infrastructure](#infrastructure)
7. [Security](#security)
8. [Scaling Strategy](#scaling-strategy)

---

## System Overview

PromptAds AI serves contextual ads to AI applications by matching user prompts
to advertiser content using semantic vector similarity.

    ┌─────────────────────────────────────────────────────────────────┐
    │                      AI Application                            │
    │  (Chatbot, Copilot, Search Agent, etc.)                        │
    │                                                                │
    │   from promptads_ai import get_ad                              │
    │   ad = get_ad(user_prompt)                                     │
    └──────────────────────┬──────────────────────────────────────────┘
                           │ POST /engine/match-ad
                           ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                   PromptAds API  (FastAPI)                      │
    │                                                                │
    │  ┌──────────┐  ┌──────────────────┐  ┌───────────────┐        │
    │  │ Auth     │  │ Engine           │  │ Analytics     │        │
    │  │ Service  │  │ (Match Pipeline) │  │ Service       │        │
    │  └──────────┘  └────────┬─────────┘  └───────────────┘        │
    │                         │                                      │
    │              ┌──────────┼──────────┐                           │
    │              ▼          ▼          ▼                            │
    │  ┌────────────────┐ ┌────────┐ ┌──────────┐ ┌─────────┐      │
    │  │ Embedding      │ │ Qdrant │ │ Postgres │ │ Redis   │      │
    │  │ (sentence-     │ │(vector)│ │  (RDBMS) │ │ (cache) │      │
    │  │  transformers) │ │        │ │          │ │         │      │
    │  └────────────────┘ └────────┘ └──────────┘ └─────────┘      │
    └─────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────┐
    │                   Advertiser Dashboard  (Next.js 15)            │
    │                                                                │
    │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐     │
    │  │ Overview │  │ Ad Mgr   │  │ Analytics │  │ Settings │     │
    │  └──────────┘  └──────────┘  └───────────┘  └──────────┘     │
    └─────────────────────────────────────────────────────────────────┘

## Ad Matching Pipeline

When a developer calls `getAd("best coding laptop")`, the engine runs a
5-stage pipeline:

    User Prompt
        │
        ▼
    ┌─────────────────────┐
    │ 1. Embedding        │  Convert prompt to 384-dim vector
    │    Service          │  (all-MiniLM-L6-v2)
    └────────┬────────────┘
             │
             ▼
    ┌─────────────────────┐
    │ 2. Vector Search    │  Find top-K nearest ad vectors
    │    (Qdrant)         │  in the vector store
    └────────┬────────────┘
             │
             ▼
    ┌─────────────────────┐
    │ 3. Ad Ranker        │  Score each candidate:
    │                     │  final = relevance × 0.70 + bid × 0.30
    └────────┬────────────┘
             │
             ▼
    ┌─────────────────────┐
    │ 4. Ad Generator     │  Optionally rewrite ad copy to
    │    (optional)       │  better fit the prompt context
    └────────┬────────────┘
             │
             ▼
    ┌─────────────────────┐
    │ 5. Engine Service   │  Orchestrates the full pipeline,
    │    (orchestrator)   │  returns MatchResponse
    └─────────────────────┘

### Module Details

| Module            | File                          | Responsibility                                                                     |
| ----------------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| Embedding Service | `engine/embedding_service.py` | Encodes text to dense vectors using sentence-transformers                          |
| Vector Search     | `engine/vector_search.py`     | Queries Qdrant for nearest-neighbor ad vectors                                     |
| Ad Ranker         | `engine/ad_ranker.py`         | Computes final score: `relevance_weight * relevance + bid_weight * normalized_bid` |
| Ad Generator      | `engine/ad_generator.py`      | Optional LLM-based ad copy rewriting for context fit                               |
| Engine Service    | `engine/engine_service.py`    | Orchestrates the pipeline end-to-end                                               |

### Scoring Formula

    final_score = (relevance_weight × cosine_similarity) + (bid_weight × normalized_bid)

Default weights: `relevance_weight = 0.70`, `bid_weight = 0.30`.

The highest-scoring ad wins. Weights are configurable per request
to let developers tune the relevance-vs-revenue trade-off.

## Data Models

### User

| Column          | Type     | Description       |
| --------------- | -------- | ----------------- |
| id              | UUID     | Primary key       |
| email           | String   | Unique email      |
| hashed_password | String   | bcrypt hash       |
| created_at      | DateTime | Registration time |

### Ad

| Column          | Type          | Description             |
| --------------- | ------------- | ----------------------- |
| id              | UUID          | Primary key             |
| owner_id        | UUID          | FK to User              |
| title           | String        | Ad headline             |
| text            | String        | Ad body copy            |
| target_keywords | Array[String] | Targeting keywords      |
| bid_amount      | Float         | Cost-per-impression bid |
| daily_budget    | Float         | Daily spend cap         |
| destination_url | String        | Click-through URL       |
| is_active       | Boolean       | Active/paused toggle    |
| created_at      | DateTime      | Creation time           |

### AnalyticsEvent

| Column     | Type     | Description             |
| ---------- | -------- | ----------------------- |
| id         | UUID     | Primary key             |
| ad_id      | UUID     | FK to Ad                |
| event_type | String   | `impression` or `click` |
| created_at | DateTime | Event time              |

## API Design

All routes are prefixed from the FastAPI root. Authentication uses JWT
Bearer tokens issued by `/auth/login`.

### Auth

    POST /auth/register    { email, password }           → { token }
    POST /auth/login       { email, password }           → { token }

### Ads (authenticated)

    POST   /ads/create     { title, text, ... }          → Ad
    GET    /ads/list                                      → [ Ad, ... ]
    PUT    /ads/update/{id} { title?, text?, ... }       → Ad
    DELETE /ads/delete/{id}                               → { ok }

### Engine

    POST /engine/match-ad
      Request:  { user_prompt, top_k?, relevance_weight?, bid_weight? }
      Response: { ad_id, title, text, relevance_score, bid_amount, final_score }

    POST /engine/match-ads
      Request:  { user_prompt, n?, top_k?, relevance_weight?, bid_weight? }
      Response: { ads: [...], total_candidates, pipeline_latency_ms }

### Analytics

    POST /analytics/impression   { ad_id }    → { ok }
    POST /analytics/click        { ad_id }    → { ok }

### Health

    GET /health   → { status: "ok" }

## Frontend Dashboard

Built with **Next.js 15** (App Router), **React 19**, **TypeScript**,
**Tailwind CSS**, **shadcn/ui**, and **Recharts**.

| Page               | Route                  | Description                                  |
| ------------------ | ---------------------- | -------------------------------------------- |
| Landing            | `/`                    | Marketing page with CTA                      |
| Login              | `/login`               | Email/password authentication                |
| Register           | `/register`            | New account creation                         |
| Dashboard Overview | `/dashboard`           | KPI cards + area chart                       |
| Ads Manager        | `/dashboard/ads`       | CRUD table with search, edit, delete         |
| Create Ad          | `/dashboard/ads/new`   | Form with validation (react-hook-form + zod) |
| Analytics          | `/dashboard/analytics` | Tabbed charts (impressions, clicks, CTR)     |
| Settings           | `/dashboard/settings`  | Profile, API keys, danger zone               |

## Infrastructure

### Docker Compose Services

| Service  | Image                | Port       | Purpose                  |
| -------- | -------------------- | ---------- | ------------------------ |
| backend  | Custom (Dockerfile)  | 8000       | FastAPI API server       |
| frontend | Custom (Dockerfile)  | 3000       | Next.js dashboard        |
| postgres | postgres:16-alpine   | 5432       | Primary database         |
| qdrant   | qdrant/qdrant:latest | 6333, 6334 | Vector similarity search |
| redis    | redis:7-alpine       | 6379       | Response caching         |

### Environment Variables

See `.env.example` for the full list. Key variables:

    DATABASE_URL           PostgreSQL connection string
    QDRANT_HOST / PORT     Qdrant vector DB connection
    REDIS_URL              Redis connection string
    JWT_SECRET_KEY         Secret for signing JWT tokens
    EMBEDDING_MODEL        sentence-transformers model name

## Security

- **Authentication**: JWT Bearer tokens (HS256), issued on register/login
- **Password Hashing**: bcrypt via passlib
- **CORS**: Configurable allowed origins
- **Input Validation**: Pydantic schemas on all endpoints
- **SQL Injection**: SQLAlchemy ORM (parameterized queries)
- **Rate Limiting**: Can be added via Redis-backed middleware

## Scaling Strategy

### Horizontal Scaling

- **Backend**: Stateless FastAPI workers behind a load balancer
- **Qdrant**: Supports clustering and sharding for large ad catalogs
- **PostgreSQL**: Read replicas for analytics queries
- **Redis**: Cluster mode for distributed caching

### Performance Targets

| Metric                  | Target                 |
| ----------------------- | ---------------------- |
| Match latency (p95)     | < 50ms                 |
| Embedding inference     | < 20ms (MiniLM on CPU) |
| Vector search (10K ads) | < 5ms                  |
| Concurrent requests     | 1,000+ per worker      |

### Caching Strategy

1. **Embedding cache** — Cache prompt embeddings in Redis (TTL: 5 min)
2. **Match cache** — Cache full match results for repeated prompts (TTL: 1 min)
3. **Ad vector cache** — Qdrant keeps vectors in memory, no extra caching needed
