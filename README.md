<p align="center">
  <h1 align="center">PromptAds AI</h1>
  <p align="center">
    <strong>Contextual advertising infrastructure for AI-powered applications</strong>
  </p>
  <p align="center">
    <a href="#quick-start">Quick Start</a> &middot;
    <a href="docs/ARCHITECTURE.md">Architecture</a> &middot;
    <a href="docs/DEVELOPER_GUIDE.md">Developer Guide</a> &middot;
    <a href="docs/ADVERTISER_GUIDE.md">Advertiser Guide</a> &middot;
    <a href="docs/SETUP.md">Setup</a>
  </p>
</p>

---

PromptAds AI is an open-source platform that lets AI applications — chatbots, copilots, search agents — serve **contextual, non-intrusive ads** that match what the user is already talking about. Instead of banner ads or pop-ups, PromptAds matches ads to the semantic meaning of the conversation.

## How It Works

```
User prompt                      PromptAds Engine
─────────────                    ────────────────
"best coding laptop"  ──────▶   1. Embed prompt (sentence-transformers)
                                 2. Vector search (Qdrant)
                                 3. Rank candidates (relevance × bid)
                                 4. Return best ad
                      ◀──────   { title: "MacBook Pro M3 — 30% off", ... }
```

**Three lines. That's it.**

```ts
import { getAd } from "promptads-ai";

const ad = await getAd("best coding laptop");
```

```python
from promptads_ai import get_ad

ad = get_ad("best coding laptop")
```

## Features

- **Semantic Ad Matching** — Matches ads to prompts using vector embeddings, not keywords
- **Real-time Ranking** — Combines relevance score and bid amount with configurable weights
- **Sub-50ms Latency** — Qdrant vector search + Redis caching for production speed
- **Privacy-First** — No user tracking, no cookies; ads are matched to content, not people
- **SDKs for JS & Python** — Drop-in clients with zero dependencies
- **Advertiser Dashboard** — Create ads, view analytics, manage campaigns from a web UI
- **Fully Open Source** — MIT licensed, self-host everything

## Quick Start

### 1. Clone & Start

```bash
git clone https://github.com/abhishek/promptads-ai.git
cd promptads-ai
cp .env.example .env
docker compose up -d
```

This starts 5 services: backend API (`:8000`), frontend dashboard (`:3000`), PostgreSQL, Qdrant, and Redis.

### 2. Create an Ad (via API)

```bash
# Register
curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@test.com", "password": "demo1234"}' | jq .token

# Create an ad (use the token from above)
curl -s -X POST http://localhost:8000/ads/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "title": "MacBook Pro M3 — 30% off",
    "text": "The fastest laptop for developers. Apple M3 chip, 18h battery.",
    "target_keywords": ["laptop", "coding", "developer", "macbook"],
    "bid_amount": 2.50,
    "daily_budget": 100.00,
    "destination_url": "https://apple.com/macbook-pro"
  }'
```

### 3. Match an Ad

```bash
curl -s -X POST http://localhost:8000/engine/match-ad \
  -H "Content-Type: application/json" \
  -d '{"user_prompt": "best coding laptop"}' | jq
```

### 4. Use the SDK

```bash
npm install promptads-ai          # JavaScript / TypeScript
pip install promptads-ai          # Python
```

```ts
import { getAd } from "promptads-ai";

const ad = await getAd("best coding laptop");
console.log(ad.title); // "MacBook Pro M3 — 30% off"
```

## Project Structure

```
promptads-ai/
├── backend/                   # FastAPI backend
│   ├── api/                   # Route handlers (auth, ads, engine, analytics)
│   ├── engine/                # AI matching engine
│   │   ├── embedding_service.py   # Sentence-transformer embeddings
│   │   ├── vector_search.py       # Qdrant vector similarity search
│   │   ├── ad_ranker.py           # Relevance × bid scoring
│   │   ├── ad_generator.py        # Ad text generation
│   │   └── engine_service.py      # Pipeline orchestrator
│   ├── models/                # SQLAlchemy models (User, Ad, AnalyticsEvent)
│   ├── schemas/               # Pydantic request/response schemas
│   ├── services/              # Business logic layer
│   ├── core/                  # Config, security, JWT
│   ├── db/                    # Database session & base
│   ├── tests/                 # Pytest test suite
│   └── main.py                # FastAPI app entry point
├── frontend/                  # Next.js 15 dashboard
│   └── src/
│       ├── app/               # App Router pages
│       │   ├── dashboard/     # Ads manager, analytics, settings
│       │   ├── login/         # Auth pages
│       │   └── register/
│       ├── components/        # UI components (shadcn/ui)
│       ├── lib/               # API client, auth context, utils
│       └── types/             # TypeScript type definitions
├── sdk/
│   ├── js/                    # JavaScript / TypeScript SDK
│   │   ├── client.ts          # PromptAdsClient class
│   │   ├── index.ts           # Top-level exports (getAd, getAds, ...)
│   │   └── package.json
│   └── python/                # Python SDK
│       ├── promptads_ai/
│       │   ├── client.py      # PromptAdsClient class + get_ad()
│       │   └── __init__.py
│       └── pyproject.toml
├── examples/
│   └── chatbot/               # Example chatbot integration
│       ├── python/main.py
│       └── javascript/index.ts
├── docs/                      # Documentation
│   ├── ARCHITECTURE.md        # System architecture & design
│   ├── SETUP.md               # Development setup guide
│   ├── DEVELOPER_GUIDE.md     # SDK integration guide
│   └── ADVERTISER_GUIDE.md    # Advertiser onboarding guide
├── docker-compose.yml         # Full-stack Docker setup
├── CONTRIBUTING.md
└── LICENSE                    # MIT
```

## Tech Stack

| Layer              | Technology                                                          |
| ------------------ | ------------------------------------------------------------------- |
| **Backend API**    | Python, FastAPI, SQLAlchemy, Pydantic                               |
| **AI Engine**      | sentence-transformers, Qdrant, NumPy                                |
| **Database**       | PostgreSQL 16, Alembic migrations                                   |
| **Vector Store**   | Qdrant                                                              |
| **Cache**          | Redis 7                                                             |
| **Frontend**       | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| **SDKs**           | TypeScript (zero-dep), Python (zero-dep)                            |
| **Infrastructure** | Docker Compose                                                      |

## API Reference

| Method   | Endpoint                | Description                   |
| -------- | ----------------------- | ----------------------------- |
| `POST`   | `/auth/register`        | Register a new user           |
| `POST`   | `/auth/login`           | Log in and get JWT token      |
| `POST`   | `/ads/create`           | Create a new ad               |
| `GET`    | `/ads/list`             | List your ads                 |
| `PUT`    | `/ads/update/{id}`      | Update an ad                  |
| `DELETE` | `/ads/delete/{id}`      | Delete an ad                  |
| `POST`   | `/engine/match-ad`      | Get the best ad for a prompt  |
| `POST`   | `/engine/match-ads`     | Get multiple ads for a prompt |
| `POST`   | `/analytics/impression` | Track an ad impression        |
| `POST`   | `/analytics/click`      | Track an ad click             |
| `GET`    | `/health`               | Health check                  |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design, data flow, engine pipeline
- [Setup Guide](docs/SETUP.md) — Local development, Docker, environment variables
- [Developer Guide](docs/DEVELOPER_GUIDE.md) — SDK integration for AI apps
- [Advertiser Guide](docs/ADVERTISER_GUIDE.md) — Creating and managing ads

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE) for details.
