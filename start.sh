#!/usr/bin/env bash
#
# PromptAds AI – One-command start
# Starts: PostgreSQL · Qdrant · Redis · Backend · Dashboard · Conv AI Test
#
# Usage:  ./start.sh
# Stop:   Ctrl+C
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Ports ────────────────────────────────────────────────────────────
PG_PORT=5433
QDRANT_PORT=6333
REDIS_PORT=6379
BE_PORT=8000
FE_PORT=3002
CHAT_PORT=3050

# ── PIDs ─────────────────────────────────────────────────────────────
BE_PID=""
FE_PID=""
CHAT_PID=""
QDRANT_PID=""

# ── Colours ──────────────────────────────────────────────────────────
G="\033[92m"   # green
C="\033[96m"   # cyan
Y="\033[93m"   # yellow
R="\033[91m"   # red
M="\033[95m"   # magenta
B="\033[1m"    # bold
D="\033[0m"    # reset
DIM="\033[2m"  # dim

# ── Detect Python venv ───────────────────────────────────────────────
if [[ -f "backend/.venv/bin/python" ]]; then
    PY="backend/.venv/bin/python"
    UVICORN="backend/.venv/bin/uvicorn"
    ALEMBIC="backend/.venv/bin/alembic"
elif [[ -n "$VIRTUAL_ENV" ]]; then
    PY="$VIRTUAL_ENV/bin/python"
    UVICORN="$VIRTUAL_ENV/bin/uvicorn"
    ALEMBIC="$VIRTUAL_ENV/bin/alembic"
else
    PY="python3"
    UVICORN="uvicorn"
    ALEMBIC="alembic"
fi

# ── Cleanup on Ctrl+C / exit ────────────────────────────────────────
cleanup() {
    echo ""
    echo -e "${Y}${B}Stopping PromptAds AI…${D}"
    [[ -n "$CHAT_PID" ]] && kill "$CHAT_PID" 2>/dev/null && wait "$CHAT_PID" 2>/dev/null
    [[ -n "$FE_PID" ]]   && kill "$FE_PID"   2>/dev/null && wait "$FE_PID"   2>/dev/null
    [[ -n "$BE_PID" ]]   && kill "$BE_PID"   2>/dev/null && wait "$BE_PID"   2>/dev/null
    [[ -n "$QDRANT_PID" ]] && kill "$QDRANT_PID" 2>/dev/null && wait "$QDRANT_PID" 2>/dev/null
    echo -e "${G}✓ All services stopped.${D}"
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# ══════════════════════════════════════════════════════════════════════
#  BANNER
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${M}${B}╔══════════════════════════════════════════════════════╗${D}"
echo -e "${M}${B}║           ✦  PromptAds AI  —  Start Wizard          ║${D}"
echo -e "${M}${B}║           AI-Native Contextual Ad Engine             ║${D}"
echo -e "${M}${B}╚══════════════════════════════════════════════════════╝${D}"
echo ""
echo -e "  ${DIM}Python  : ${C}$PY${D}"
echo -e "  ${DIM}Script  : ${C}$SCRIPT_DIR${D}"
echo ""

# ══════════════════════════════════════════════════════════════════════
#  STEP 1 — Check .env
# ══════════════════════════════════════════════════════════════════════
echo -e "${B}[1/7]${D} ${C}Checking environment…${D}"

if [[ ! -f ".env" ]]; then
    echo -e "  ${Y}⚠  No .env file found. Creating from .env.example…${D}"
    if [[ -f ".env.example" ]]; then
        cp .env.example .env
        echo -e "  ${G}✓ .env created — ${Y}please edit it with your API keys${D}"
    else
        echo -e "  ${R}✗ No .env.example found either. Please create .env manually.${D}"
        exit 1
    fi
fi

# Copy .env to backend if not symlinked
if [[ ! -f "backend/.env" ]]; then
    cp .env backend/.env
    echo -e "  ${DIM}Synced .env → backend/.env${D}"
fi

# Read env values the script needs (without exporting to child processes)
eval "$(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB|POSTGRES_PORT|QDRANT_PORT|QDRANT_HOST|REDIS_URL|BACKEND_PORT)=' .env 2>/dev/null)"

echo -e "  ${G}✓ Environment loaded${D}"

# ══════════════════════════════════════════════════════════════════════
#  STEP 2 — PostgreSQL
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${B}[2/7]${D} ${C}PostgreSQL (port $PG_PORT)…${D}"

PG_BIN=""
if command -v pg_isready &>/dev/null; then
    PG_BIN=""
elif [[ -f "/opt/homebrew/opt/postgresql@16/bin/pg_isready" ]]; then
    PG_BIN="/opt/homebrew/opt/postgresql@16/bin/"
elif [[ -f "/opt/homebrew/opt/postgresql@15/bin/pg_isready" ]]; then
    PG_BIN="/opt/homebrew/opt/postgresql@15/bin/"
elif [[ -f "/usr/local/opt/postgresql@16/bin/pg_isready" ]]; then
    PG_BIN="/usr/local/opt/postgresql@16/bin/"
fi

if "${PG_BIN}pg_isready" -p "$PG_PORT" -q 2>/dev/null; then
    echo -e "  ${G}✓ PostgreSQL already running${D}"
else
    echo -e "  ${Y}Starting PostgreSQL…${D}"
    if command -v brew &>/dev/null; then
        brew services start postgresql@16 2>/dev/null || true
    elif command -v pg_ctl &>/dev/null; then
        pg_ctl start -D /usr/local/var/postgres 2>/dev/null || true
    fi
    # Wait
    for i in $(seq 1 15); do
        "${PG_BIN}pg_isready" -p "$PG_PORT" -q 2>/dev/null && break
        sleep 1
    done
    if "${PG_BIN}pg_isready" -p "$PG_PORT" -q 2>/dev/null; then
        echo -e "  ${G}✓ PostgreSQL started${D}"
    else
        echo -e "  ${R}✗ PostgreSQL failed to start on port $PG_PORT${D}"
        echo -e "  ${DIM}Install: brew install postgresql@16 && brew services start postgresql@16${D}"
        exit 1
    fi
fi

# ── Ensure DB & role exist ───────────────────────────────────────────
PG_USER="${POSTGRES_USER:-promptads}"
PG_PASS="${POSTGRES_PASSWORD:-changeme_in_production}"
PG_DB="${POSTGRES_DB:-promptads}"
PSQL="${PG_BIN}psql"

if ! "$PSQL" -p "$PG_PORT" -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$PG_USER'" 2>/dev/null | grep -q 1; then
    "$PSQL" -p "$PG_PORT" -d postgres -c "CREATE ROLE $PG_USER WITH LOGIN PASSWORD '$PG_PASS' CREATEDB;" 2>/dev/null || true
    echo -e "  ${DIM}Created role: $PG_USER${D}"
fi
if ! "$PSQL" -p "$PG_PORT" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$PG_DB'" 2>/dev/null | grep -q 1; then
    "$PSQL" -p "$PG_PORT" -d postgres -c "CREATE DATABASE $PG_DB OWNER $PG_USER;" 2>/dev/null || true
    echo -e "  ${DIM}Created database: $PG_DB${D}"
fi

# ══════════════════════════════════════════════════════════════════════
#  STEP 3 — Qdrant
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${B}[3/7]${D} ${C}Qdrant (port $QDRANT_PORT)…${D}"

if curl -sf "http://localhost:$QDRANT_PORT/healthz" &>/dev/null; then
    echo -e "  ${G}✓ Qdrant already running${D}"
else
    QDRANT_BIN=""
    if command -v qdrant &>/dev/null; then
        QDRANT_BIN="qdrant"
    elif [[ -f "/usr/local/bin/qdrant" ]]; then
        QDRANT_BIN="/usr/local/bin/qdrant"
    fi

    if [[ -n "$QDRANT_BIN" ]]; then
        echo -e "  ${Y}Starting Qdrant…${D}"
        mkdir -p /tmp/qdrant_data
        QDRANT__STORAGE__STORAGE_PATH=/tmp/qdrant_data/storage \
        QDRANT__SERVICE__HTTP_PORT=$QDRANT_PORT \
            "$QDRANT_BIN" --disable-telemetry &>/tmp/qdrant.log &
        QDRANT_PID=$!
        for i in $(seq 1 15); do
            curl -sf "http://localhost:$QDRANT_PORT/healthz" &>/dev/null && break
            sleep 1
        done
        if curl -sf "http://localhost:$QDRANT_PORT/healthz" &>/dev/null; then
            echo -e "  ${G}✓ Qdrant started${D}"
        else
            echo -e "  ${R}✗ Qdrant failed to start${D}"
            exit 1
        fi
    else
        echo -e "  ${R}✗ Qdrant binary not found${D}"
        echo -e "  ${DIM}Install: curl -fsSL https://github.com/qdrant/qdrant/releases/latest -o qdrant${D}"
        echo -e "  ${DIM}Or use Docker: docker run -p 6333:6333 qdrant/qdrant${D}"
        exit 1
    fi
fi

# ══════════════════════════════════════════════════════════════════════
#  STEP 4 — Redis
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${B}[4/7]${D} ${C}Redis (port $REDIS_PORT)…${D}"

if redis-cli -p "$REDIS_PORT" ping &>/dev/null; then
    echo -e "  ${G}✓ Redis already running${D}"
else
    echo -e "  ${Y}Starting Redis…${D}"
    if command -v brew &>/dev/null; then
        brew services start redis 2>/dev/null || true
    elif command -v redis-server &>/dev/null; then
        redis-server --port "$REDIS_PORT" --daemonize yes 2>/dev/null || true
    fi
    sleep 2
    if redis-cli -p "$REDIS_PORT" ping &>/dev/null; then
        echo -e "  ${G}✓ Redis started${D}"
    else
        echo -e "  ${Y}⚠  Redis not available — app will run without caching${D}"
    fi
fi

# ══════════════════════════════════════════════════════════════════════
#  STEP 5 — Backend
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${B}[5/7]${D} ${C}Backend API (port $BE_PORT)…${D}"

# Install backend deps if needed
if [[ ! -d "backend/.venv" ]]; then
    echo -e "  ${Y}Creating Python venv…${D}"
    python3 -m venv backend/.venv
    echo -e "  ${DIM}Installing dependencies…${D}"
    backend/.venv/bin/pip install -r backend/requirements.txt --quiet 2>&1
    echo -e "  ${G}✓ Backend deps installed${D}"
fi

# Kill anything on BE_PORT
lsof -iTCP:$BE_PORT -sTCP:LISTEN -t 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

# Run migrations
echo -e "  ${DIM}Running database migrations…${D}"
cd backend
../$ALEMBIC upgrade head 2>&1 | tail -1
cd "$SCRIPT_DIR"
echo -e "  ${G}✓ Migrations done${D}"

# Start backend
cd backend
../$UVICORN main:app --host 0.0.0.0 --port $BE_PORT --reload &>/tmp/promptads-backend.log &
BE_PID=$!
cd "$SCRIPT_DIR"

echo -ne "  Waiting"
for i in $(seq 1 20); do
    curl -sf "http://localhost:$BE_PORT/health" &>/dev/null && break
    kill -0 "$BE_PID" 2>/dev/null || { echo -e "\n  ${R}✗ Backend crashed. Check /tmp/promptads-backend.log${D}"; exit 1; }
    echo -n "."
    sleep 1
done

if curl -sf "http://localhost:$BE_PORT/health" &>/dev/null; then
    echo -e "\n  ${G}✓ Backend running${D}"
else
    echo -e "\n  ${R}✗ Backend timeout. Check /tmp/promptads-backend.log${D}"
    exit 1
fi

# ══════════════════════════════════════════════════════════════════════
#  STEP 6 — Dashboard Frontend
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${B}[6/7]${D} ${C}Dashboard (port $FE_PORT)…${D}"

# Install deps if needed
if [[ ! -d "frontend/node_modules" ]]; then
    echo -e "  ${DIM}Installing dependencies…${D}"
    (cd frontend && npm install --silent 2>&1)
    echo -e "  ${G}✓ Frontend deps installed${D}"
fi

lsof -iTCP:$FE_PORT -sTCP:LISTEN -t 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

cd frontend && PORT=$FE_PORT npx next dev --port $FE_PORT &>/tmp/promptads-frontend.log &
FE_PID=$!
cd "$SCRIPT_DIR"
sleep 3

echo -e "  ${G}✓ Dashboard starting${D}"

# ══════════════════════════════════════════════════════════════════════
#  STEP 7 — Conversational AI Test
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${B}[7/7]${D} ${C}Conversational AI (port $CHAT_PORT)…${D}"

# Install deps if needed
if [[ ! -d "conversational-ai-test/node_modules" ]]; then
    echo -e "  ${DIM}Installing dependencies…${D}"
    (cd conversational-ai-test && npm install --silent 2>&1)
    echo -e "  ${G}✓ Chat app deps installed${D}"
fi

# Check env
if [[ ! -f "conversational-ai-test/.env.local" ]]; then
    echo -e "  ${Y}⚠  No .env.local — creating with defaults…${D}"
    GEMINI_KEY=$(grep 'LLM_API_KEY=' .env 2>/dev/null | sed 's/^LLM_API_KEY=//' || echo "your-gemini-key")
    cat > conversational-ai-test/.env.local <<ENVEOF
PROMPTADS_BASE_URL=http://localhost:$BE_PORT
GEMINI_API_KEY=$GEMINI_KEY
ENVEOF
    echo -e "  ${DIM}Created conversational-ai-test/.env.local${D}"
fi

lsof -iTCP:$CHAT_PORT -sTCP:LISTEN -t 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

cd conversational-ai-test && npx next dev --port $CHAT_PORT &>/tmp/promptads-chat.log &
CHAT_PID=$!
cd "$SCRIPT_DIR"
sleep 3

echo -e "  ${G}✓ Conversational AI starting${D}"

# ══════════════════════════════════════════════════════════════════════
#  READY
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${G}${B}╔══════════════════════════════════════════════════════╗${D}"
echo -e "${G}${B}║              ✦  PromptAds AI — Running               ║${D}"
echo -e "${G}${B}╠══════════════════════════════════════════════════════╣${D}"
echo -e "${G}${B}║${D}                                                      ${G}${B}║${D}"
echo -e "${G}${B}║${D}  Dashboard        →  ${C}http://localhost:$FE_PORT${D}           ${G}${B}║${D}"
echo -e "${G}${B}║${D}  Conversational AI→  ${C}http://localhost:$CHAT_PORT${D}           ${G}${B}║${D}"
echo -e "${G}${B}║${D}  Backend API      →  ${C}http://localhost:$BE_PORT${D}           ${G}${B}║${D}"
echo -e "${G}${B}║${D}  API Docs         →  ${C}http://localhost:$BE_PORT/docs${D}      ${G}${B}║${D}"
echo -e "${G}${B}║${D}                                                      ${G}${B}║${D}"
echo -e "${G}${B}╠══════════════════════════════════════════════════════╣${D}"
echo -e "${G}${B}║${D}  PostgreSQL  ${DIM}localhost:$PG_PORT${D}     Qdrant ${DIM}localhost:$QDRANT_PORT${D}  ${G}${B}║${D}"
echo -e "${G}${B}║${D}  Redis       ${DIM}localhost:$REDIS_PORT${D}                          ${G}${B}║${D}"
echo -e "${G}${B}╠══════════════════════════════════════════════════════╣${D}"
echo -e "${G}${B}║${D}  Logs: ${DIM}/tmp/promptads-backend.log${D}                   ${G}${B}║${D}"
echo -e "${G}${B}║${D}        ${DIM}/tmp/promptads-frontend.log${D}                  ${G}${B}║${D}"
echo -e "${G}${B}║${D}        ${DIM}/tmp/promptads-chat.log${D}                      ${G}${B}║${D}"
echo -e "${G}${B}╠══════════════════════════════════════════════════════╣${D}"
echo -e "${G}${B}║${D}  Press ${Y}Ctrl+C${D} to stop all services                   ${G}${B}║${D}"
echo -e "${G}${B}╚══════════════════════════════════════════════════════╝${D}"
echo ""

wait
