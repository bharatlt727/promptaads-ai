<p align="center">
  <h1 align="center">✦ PromptAds AI</h1>
  <p align="center">
    <strong>AI-native contextual advertising engine/AdSense for chatbots, copilots and LLM applications.</strong>
  </p>
  <p align="center">
    <a href="#-one-command-start">Quick Start</a> &middot;
    <a href="#-how-it-works">How It Works</a> &middot;
    <a href="#-sdk-integration">SDK Guide</a> &middot;
    <a href="#-manual-setup">Manual Setup</a> &middot;
    <a href="#-api-reference">API Docs</a>
  </p>
</p>

---

## What is PromptAds AI?

PromptAds AI is an open-source platform that lets AI applications — chatbots, copilots, search agents — serve **contextual, non-intrusive ads** that match the _semantic meaning_ of the user's conversation. No banners. No pop-ups. No cookies. Ads are matched to content, not people.

**The idea:** A user asks your AI chatbot _"what's the best laptop for coding?"_ — PromptAds embeds that prompt as a vector, searches your ad catalog in Qdrant, ranks by `relevance × bid`, and returns the single best ad in under 50ms.

```
User prompt                      PromptAds Engine
─────────────                    ────────────────
"best coding laptop"  ──────▶   1. Embed prompt   → Gemini / OpenAI embeddings
                                 2. Vector search  → Qdrant (cosine similarity)
                                 3. Rank           → relevance 70% + bid 30%
                                 4. Return best ad → JSON response
                      ◀──────   { title, description, relevance_score, ... }
```

---

## ✦ One-Command Start

The fastest way to run everything locally:

```bash
git clone https://github.com/abhishekayu/promptads-ai.git
cd promptads-ai
./start.sh
```

The wizard will ask you to choose:

```
How would you like to start?

  1) Auto Setup  — Install missing dependencies, configure DB, start everything
  2) Manual      — Skip setup, just start the servers (deps already installed)
```

### Auto Setup (Option 1) — Fresh clone, nothing installed

Walks you through 4 phases before starting servers:

| Phase               | What it does                                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Dependencies** | Checks Python 3.11+, Node.js 18+, PostgreSQL 16, Qdrant, Redis. If missing, asks `Install? [Y/n]` and installs via brew/apt/yum. If already installed, shows version with ✓ |
| **2. Database**     | Asks for PostgreSQL port, user, password, database name (smart defaults provided)                                                                                           |
| **3. API Keys**     | Asks for AI provider (Gemini/OpenAI) and API key. If existing `.env` found, asks to keep it                                                                                 |
| **4. Project Deps** | Runs `pip install -r requirements.txt`, `npm install` for dashboard and chat app                                                                                            |

Then starts all 6 servers automatically.

### Manual (Option 2) — Dependencies already installed

Skips setup, goes straight to starting servers. Use this for day-to-day development after initial setup.

### After starting

| Service                    | URL                        |
| -------------------------- | -------------------------- |
| **Advertiser Dashboard**   | http://localhost:3002      |
| **Conversational AI Demo** | http://localhost:3050      |
| **Backend API**            | http://localhost:8000      |
| **API Docs (Swagger)**     | http://localhost:8000/docs |

---

## ✦ How It Works

### The Ad Matching Pipeline

When a user sends a prompt to your AI app, the PromptAds engine runs this pipeline:

```
┌─────────────────────────────────────────────────────────────┐
│                     PromptAds Engine                        │
│                                                             │
│  User Prompt ──▶ Embedding Service ──▶ Vector Search        │
│                  (Gemini / OpenAI)     (Qdrant cosine)      │
│                                            │                │
│                                            ▼                │
│                                       Ad Ranker             │
│                                  (relevance × bid)          │
│                                            │                │
│                                            ▼                │
│                                     Best Ad ──▶ Response    │
└─────────────────────────────────────────────────────────────┘
```

**Step by step:**

1. **Embedding** — The user's prompt is converted into a 3072-dimensional vector using Gemini's `gemini-embedding-001` (or OpenAI's `text-embedding-3-small`)
2. **Vector Search** — The prompt vector is compared against all ad embeddings stored in Qdrant using cosine similarity
3. **Score Filtering** — Ads below a 0.55 relevance threshold are discarded (prevents irrelevant matches)
4. **Ranking** — Remaining ads are scored: `final_score = (relevance × 0.70) + (normalized_bid × 0.30)`
5. **Response** — The highest scoring ad is returned with title, description, image, relevance score, and product URL

### When does an ad NOT show?

If no ad in the catalog exceeds the 0.55 similarity threshold for the user's prompt, the engine returns nothing. This means your app never shows irrelevant ads.

---

## ✦ The Two Apps

### 1. Advertiser Dashboard (port 3002)

The web UI where advertisers manage their ads:

- **Register / Login** — JWT-based authentication
- **Create Ads** — Title, description, keywords, bid amount, product URL, image URL
- **Ads Manager** — View, edit, delete, pause/activate ads in a card grid
- **Analytics** — Impressions, clicks, CTR charts (Recharts)

When an ad is created, the backend automatically:

1. Saves it to PostgreSQL
2. Generates an embedding from the ad's title + description + keywords
3. Upserts the embedding vector into Qdrant

### 2. Conversational AI Demo (port 3050)

A full working chatbot that demonstrates the SDK in action:

- Chat powered by **Gemini 2.5 Flash** via `@google/genai`
- After each AI response, calls the PromptAds `match-ad` API
- If a relevant ad is found, renders it inline as a styled card
- Tracks impressions and clicks through the analytics API
- Right sidebar shows real-time **SDK Activity** logs

This is the reference implementation showing how any AI app can integrate PromptAds.

---

## ✦ SDK Integration

### JavaScript / TypeScript

```bash
npm install promptads-ai
```

**Simple API (3 lines):**

```ts
import { getAd, trackImpression, trackClick } from "promptads-ai";

// Match an ad to a user prompt
const ad = await getAd("best coding laptop");

console.log(ad.title); // "MacBook Pro M3"
console.log(ad.relevance_score); // 0.87
console.log(ad.product_url); // "https://..."

// Track events
await trackImpression(ad.ad_id);
await trackClick(ad.ad_id);
```

**Full client (more control):**

```ts
import { PromptAdsClient } from "promptads-ai";

const client = new PromptAdsClient({
  baseUrl: "http://localhost:8000",
  apiKey: "optional-api-key",
});

// Get multiple ads
const result = await client.getAds("best coding laptop", { n: 5 });
result.ads.forEach((ad) => console.log(ad.title, ad.relevance_score));
```

**Environment variables (auto-configured):**

```bash
PROMPTADS_BASE_URL=http://localhost:8000   # Backend API URL
PROMPTADS_API_KEY=pk_live_xxx              # Optional API key
```

### Python

```bash
pip install promptads-ai
```

```python
from promptads_ai import get_ad, track_impression, track_click

ad = get_ad("best coding laptop")
print(ad.title, ad.relevance_score)

track_impression(ad.ad_id)
track_click(ad.ad_id)
```

**Full client:**

```python
from promptads_ai import PromptAdsClient

client = PromptAdsClient(base_url="http://localhost:8000")
result = client.get_ads("best coding laptop", n=5)
for ad in result.ads:
    print(ad.title, ad.relevance_score)
```

Both SDKs are zero-dependency and work with any AI framework (LangChain, LlamaIndex, Vercel AI SDK, etc).

---

## ✦ Manual Setup

If you prefer to start each service individually instead of using `./start.sh`:

### Prerequisites

| Dependency | Version | Install (macOS)                                              |
| ---------- | ------- | ------------------------------------------------------------ |
| Python     | 3.11+   | `brew install python@3.12`                                   |
| Node.js    | 18+     | `brew install node`                                          |
| PostgreSQL | 16      | `brew install postgresql@16`                                 |
| Qdrant     | 1.7+    | [Download binary](https://github.com/qdrant/qdrant/releases) |
| Redis      | 7+      | `brew install redis`                                         |

### Step 1 — Environment

```bash
cp .env.example .env
```

Edit `.env` and set your API key:

```env
LLM_PROVIDER=gemini                          # or "openai"
LLM_API_KEY=your-api-key-here                # Gemini or OpenAI key
LLM_MODEL=gemini-2.5-flash                   # Chat model
EMBEDDING_MODEL=gemini-embedding-001         # Embedding model
EMBEDDING_DIMENSIONS=3072                    # 3072 for Gemini, 1536 for OpenAI

DATABASE_URL=postgresql+asyncpg://promptads:changeme_in_production@localhost:5433/promptads
POSTGRES_PORT=5433
```

### Step 2 — Start Infrastructure

```bash
# PostgreSQL
brew services start postgresql@16

# Create database
psql -p 5433 -d postgres -c "CREATE ROLE promptads WITH LOGIN PASSWORD 'changeme_in_production' CREATEDB;"
psql -p 5433 -d postgres -c "CREATE DATABASE promptads OWNER promptads;"

# Qdrant
mkdir -p /tmp/qdrant_data
QDRANT__STORAGE__STORAGE_PATH=/tmp/qdrant_data/storage \
QDRANT__SERVICE__HTTP_PORT=6333 \
  /usr/local/bin/qdrant --disable-telemetry &

# Redis
brew services start redis
```

### Step 3 — Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Copy env
cp ../.env .env

# Run migrations
alembic upgrade head

# Start server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 4 — Dashboard Frontend

```bash
cd frontend
npm install
npm run dev    # Starts on port 3002
```

### Step 5 — Conversational AI Demo

```bash
cd conversational-ai-test
npm install

# Create env file
cat > .env.local <<EOF
PROMPTADS_BASE_URL=http://localhost:8000
GEMINI_API_KEY=your-gemini-api-key
EOF

npm run dev    # Starts on port 3050
```

### Docker Alternative

```bash
docker compose up -d
```

This starts backend (`:8000`), frontend (`:3000`), PostgreSQL (`:5432`), Qdrant (`:6333`), and Redis (`:6379`) — all containerized.

---

## ✦ Testing the Full Flow

### 1. Register & Login

Open http://localhost:3002/register and create an account.

### 2. Create an Ad

Go to **Ads Manager → + New Ad** and fill in:

- **Title:** "Best CPU for Gaming"
- **Description:** "Intel i9 processor with 24 cores"
- **Keywords:** CPU, gaming, processor, Intel
- **Bid Amount:** $5.00
- **Product URL:** https://example.com
- **Image URL:** (optional)

### 3. Test Ad Matching

Open http://localhost:3050 (Conversational AI demo) and type:

> "What is a CPU and how does it work?"

The AI will respond with an answer, and if the ad matches (relevance > 55%), it will appear as an inline sponsored card below the response.

### 4. Check the SDK Activity Log

The right sidebar in the Conversational AI demo shows real-time logs:

- `MATCH` — SDK called `getAd()` and found a result
- `IMPRESSION` — Impression was tracked
- `CLICK` — User clicked "Learn more"

### 5. Test via cURL

```bash
# Register
curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@test.com", "password": "demo1234"}'

# Login (get token)
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@test.com", "password": "demo1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Create an ad
curl -s -X POST http://localhost:8000/ads/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "MacBook Pro M3",
    "description": "The fastest laptop for developers. Apple M3 chip, 18h battery.",
    "keywords": ["laptop", "coding", "developer", "macbook"],
    "bid_amount": 2.50,
    "category": "Technology",
    "product_url": "https://apple.com/macbook-pro"
  }'

# Match an ad
curl -s -X POST http://localhost:8000/engine/match-ad \
  -H "Content-Type: application/json" \
  -d '{"user_prompt": "best laptop for coding"}' | python3 -m json.tool
```

---

## ✦ Project Structure

```
promptads-ai/
├── start.sh                       # One-command start (all services)
├── .env.example                   # Environment template
├── docker-compose.yml             # Docker setup
│
├── backend/                       # FastAPI backend (Python)
│   ├── main.py                    # App entry point
│   ├── api/
│   │   ├── auth.py                # Register / Login (JWT)
│   │   ├── ads.py                 # CRUD for ads
│   │   ├── engine.py              # Ad matching endpoint
│   │   └── analytics.py           # Impression & click tracking
│   ├── engine/
│   │   ├── embedding_service.py   # Gemini / OpenAI embeddings
│   │   ├── vector_store.py        # Qdrant collection management
│   │   ├── vector_search.py       # Cosine similarity search
│   │   ├── ad_ranker.py           # Relevance × bid scoring
│   │   ├── ad_generator.py        # LLM-based ad text generation
│   │   └── engine_service.py      # Pipeline orchestrator
│   ├── models/                    # SQLAlchemy models
│   ├── schemas/                   # Pydantic schemas
│   ├── services/                  # Business logic
│   ├── core/config.py             # Settings (env vars)
│   ├── db/                        # DB session & base
│   ├── alembic/                   # Database migrations
│   └── requirements.txt
│
├── frontend/                      # Next.js 15 advertiser dashboard
│   └── src/app/
│       ├── login/                 # Login page
│       ├── register/              # Registration page
│       └── dashboard/
│           ├── page.tsx           # Overview (metrics, chart)
│           ├── ads/page.tsx       # Ads manager (CRUD)
│           └── ads/new/page.tsx   # Create new ad
│
├── conversational-ai-test/        # Demo chatbot (Gemini + PromptAds)
│   └── src/app/
│       ├── page.tsx               # Chat UI with inline ads
│       ├── api/chat/route.ts      # Gemini chat proxy
│       ├── api/ad/route.ts        # PromptAds match proxy
│       └── api/analytics/route.ts # Analytics proxy
│
├── sdk/
│   ├── js/                        # TypeScript SDK (zero-dep)
│   │   ├── index.ts               # getAd, getAds, trackImpression, trackClick
│   │   └── client.ts              # PromptAdsClient class
│   └── python/                    # Python SDK (zero-dep)
│       └── promptads_ai/client.py # get_ad, PromptAdsClient
│
├── docs/                          # Architecture & guides
└── examples/                      # Example integrations
```

---

## ✦ Tech Stack

| Layer          | Technology                                          | Purpose                                    |
| -------------- | --------------------------------------------------- | ------------------------------------------ |
| **Backend**    | FastAPI, SQLAlchemy, Pydantic                       | REST API, ORM, validation                  |
| **AI Engine**  | Gemini / OpenAI API                                 | Embeddings + ad text generation            |
| **Vector DB**  | Qdrant                                              | Cosine similarity search on ad embeddings  |
| **Database**   | PostgreSQL 16 + Alembic                             | Ads, users, analytics storage + migrations |
| **Cache**      | Redis 7                                             | Rate limiting & response caching           |
| **Dashboard**  | Next.js 15, React 19, shadcn/ui, Tailwind, Recharts | Advertiser web UI                          |
| **Chat Demo**  | Next.js 15, `@google/genai`, PromptAds SDK          | Live SDK demo                              |
| **JS SDK**     | TypeScript, zero dependencies                       | `npm install promptads-ai`                 |
| **Python SDK** | Pure Python stdlib                                  | `pip install promptads-ai`                 |

---

## ✦ API Reference

### Authentication

| Method | Endpoint         | Body                                 | Description                |
| ------ | ---------------- | ------------------------------------ | -------------------------- |
| `POST` | `/auth/register` | `{ email, password, company_name? }` | Register                   |
| `POST` | `/auth/login`    | `{ email, password }`                | Login → `{ access_token }` |

### Ads (requires `Authorization: Bearer <token>`)

| Method   | Endpoint           | Description                         |
| -------- | ------------------ | ----------------------------------- |
| `POST`   | `/ads/create`      | Create ad (auto-embeds into Qdrant) |
| `GET`    | `/ads/list`        | List your ads                       |
| `PUT`    | `/ads/update/{id}` | Update ad (re-embeds)               |
| `DELETE` | `/ads/delete/{id}` | Delete ad (removes from Qdrant)     |

### Engine (public)

| Method | Endpoint            | Body                      | Description      |
| ------ | ------------------- | ------------------------- | ---------------- |
| `POST` | `/engine/match-ad`  | `{ user_prompt }`         | Best matching ad |
| `POST` | `/engine/match-ads` | `{ user_prompt, top_k? }` | Multiple matches |

### Analytics (public)

| Method | Endpoint                | Body        | Description      |
| ------ | ----------------------- | ----------- | ---------------- |
| `POST` | `/analytics/impression` | `{ ad_id }` | Track impression |
| `POST` | `/analytics/click`      | `{ ad_id }` | Track click      |

### Health

| Method | Endpoint  | Description             |
| ------ | --------- | ----------------------- |
| `GET`  | `/health` | `{ status: "healthy" }` |

Full interactive docs at http://localhost:8000/docs (Swagger UI).

---

## ✦ Environment Variables

| Variable               | Default                     | Description                                  |
| ---------------------- | --------------------------- | -------------------------------------------- |
| `LLM_PROVIDER`         | `gemini`                    | AI provider: `gemini` or `openai`            |
| `LLM_API_KEY`          | —                           | Your Gemini or OpenAI API key                |
| `LLM_MODEL`            | `gemini-2.5-flash`          | Chat model for ad text generation            |
| `EMBEDDING_MODEL`      | `gemini-embedding-001`      | Embedding model                              |
| `EMBEDDING_DIMENSIONS` | `3072`                      | Vector dimensions (3072 Gemini, 1536 OpenAI) |
| `DATABASE_URL`         | `postgresql+asyncpg://...`  | PostgreSQL connection string                 |
| `POSTGRES_PORT`        | `5433`                      | PostgreSQL port                              |
| `QDRANT_HOST`          | `localhost`                 | Qdrant hostname                              |
| `QDRANT_PORT`          | `6333`                      | Qdrant port                                  |
| `REDIS_URL`            | `redis://localhost:6379/0`  | Redis connection                             |
| `BACKEND_CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed CORS origins                         |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:8000`     | Frontend → backend URL                       |

---

## ✦ Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design, data flow, engine pipeline
- [Setup Guide](docs/SETUP.md) — Local development, Docker, environment variables
- [Developer Guide](docs/DEVELOPER_GUIDE.md) — SDK integration for AI apps
- [Advertiser Guide](docs/ADVERTISER_GUIDE.md) — Creating and managing ads
- [JS SDK Reference](sdk/js/README.md) — Full TypeScript SDK docs
- [Python SDK Reference](sdk/python/README.md) — Full Python SDK docs

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE) for details.
