#!/usr/bin/env bash
#
# PromptAds AI – Setup & Start Wizard
# Auto-installs dependencies, configures DB, and starts all services.
#
# Usage:  ./start.sh
# Stop:   Ctrl+C
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Colours ──────────────────────────────────────────────────────────
G="\033[92m"   # green
C="\033[96m"   # cyan
Y="\033[93m"   # yellow
R="\033[91m"   # red
M="\033[95m"   # magenta
B="\033[1m"    # bold
D="\033[0m"    # reset
DIM="\033[2m"  # dim
W="\033[97m"   # white

# ── Default Config ───────────────────────────────────────────────────
PG_PORT=5433
QDRANT_PORT=6333
REDIS_PORT=6379
BE_PORT=8000
FE_PORT=3002
CHAT_PORT=3050

# ── PIDs (for cleanup) ──────────────────────────────────────────────
BE_PID=""
FE_PID=""
CHAT_PID=""
QDRANT_PID=""

# ── Helper: ask yes/no ──────────────────────────────────────────────
ask_yn() {
    local prompt="$1" default="${2:-y}"
    local yn
    while true; do
        if [[ "$default" == "y" ]]; then
            echo -ne "  ${W}${prompt} [Y/n]: ${D}" >&2
        else
            echo -ne "  ${W}${prompt} [y/N]: ${D}" >&2
        fi
        read -r yn
        yn="${yn:-$default}"
        case "$yn" in
            [Yy]*) return 0 ;;
            [Nn]*) return 1 ;;
            *) echo -e "  ${Y}Please answer y or n${D}" >&2 ;;
        esac
    done
}

# ── Helper: ask for input with default ───────────────────────────────
ask_input() {
    local prompt="$1" default="$2" result
    echo -ne "  ${W}${prompt} [${C}${default}${W}]: ${D}" >&2
    read -r result
    echo "${result:-$default}"
}

# ── Cleanup on Ctrl+C / exit ────────────────────────────────────────
cleanup() {
    echo ""
    echo -e "${Y}${B}Stopping PromptAds AI…${D}"
    [[ -n "$CHAT_PID" ]]   && kill "$CHAT_PID"   2>/dev/null && wait "$CHAT_PID"   2>/dev/null
    [[ -n "$FE_PID" ]]     && kill "$FE_PID"     2>/dev/null && wait "$FE_PID"     2>/dev/null
    [[ -n "$BE_PID" ]]     && kill "$BE_PID"     2>/dev/null && wait "$BE_PID"     2>/dev/null
    [[ -n "$QDRANT_PID" ]] && kill "$QDRANT_PID" 2>/dev/null && wait "$QDRANT_PID" 2>/dev/null
    echo -e "${G}✓ All services stopped.${D}"
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# ── Detect OS & package manager ──────────────────────────────────────
detect_os() {
    OS="unknown"
    PKG=""
    if [[ "$(uname)" == "Darwin" ]]; then
        OS="macos"
        if command -v brew &>/dev/null; then
            PKG="brew"
        fi
    elif [[ -f /etc/debian_version ]]; then
        OS="debian"
        PKG="apt"
    elif [[ -f /etc/redhat-release ]]; then
        OS="redhat"
        PKG="yum"
    fi
}

detect_arch() {
    ARCH="$(uname -m)"
    case "$ARCH" in
        x86_64)  QDRANT_ARCH="x86_64" ;;
        arm64|aarch64) QDRANT_ARCH="aarch64" ;;
        *) QDRANT_ARCH="x86_64" ;;
    esac
    if [[ "$(uname)" == "Darwin" ]]; then
        QDRANT_OS="apple-darwin"
    else
        QDRANT_OS="unknown-linux-gnu"
    fi
}

# ══════════════════════════════════════════════════════════════════════
#  BANNER
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${M}${B}╔══════════════════════════════════════════════════════╗${D}"
echo -e "${M}${B}║           ✦  PromptAds AI  —  Setup Wizard          ║${D}"
echo -e "${M}${B}║           AI-Native Contextual Ad Engine             ║${D}"
echo -e "${M}${B}╚══════════════════════════════════════════════════════╝${D}"
echo ""

detect_os
detect_arch

# ══════════════════════════════════════════════════════════════════════
#  MODE SELECTION — Auto vs Manual
# ══════════════════════════════════════════════════════════════════════

echo -e "${B}${C}How would you like to start?${D}"
echo ""
echo -e "  ${G}1)${D} ${B}Auto Setup${D}  — Install missing dependencies, configure DB, start everything"
echo -e "  ${Y}2)${D} ${B}Manual${D}      — Skip setup, just start the servers (deps already installed)"
echo ""
echo -ne "  ${W}Choose [1/2]: ${D}"
read -r SETUP_MODE
SETUP_MODE="${SETUP_MODE:-1}"

if [[ "$SETUP_MODE" == "2" ]]; then
    echo ""
    echo -e "  ${DIM}Skipping setup, starting servers…${D}"
    SKIP_SETUP=true
else
    SKIP_SETUP=false
    echo ""
    echo -e "  ${G}✓ Auto Setup selected${D}"
fi

# ══════════════════════════════════════════════════════════════════════
#  PHASE 1 — DEPENDENCY CHECK & INSTALL (Auto mode only)
# ══════════════════════════════════════════════════════════════════════

if [[ "$SKIP_SETUP" == false ]]; then
    echo ""
    echo -e "${M}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${D}"
    echo -e "${M}${B}  PHASE 1 — Checking & Installing Dependencies${D}"
    echo -e "${M}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${D}"

    # ── Homebrew (macOS) ─────────────────────────────────────────────
    if [[ "$OS" == "macos" && -z "$PKG" ]]; then
        echo ""
        echo -e "  ${Y}⚠  Homebrew not found.${D} It's needed to install dependencies on macOS."
        if ask_yn "Install Homebrew?"; then
            echo -e "  ${DIM}Installing Homebrew…${D}"
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            # Add to PATH for this session
            if [[ -f "/opt/homebrew/bin/brew" ]]; then
                eval "$(/opt/homebrew/bin/brew shellenv)"
            elif [[ -f "/usr/local/bin/brew" ]]; then
                eval "$(/usr/local/bin/brew shellenv)"
            fi
            PKG="brew"
            echo -e "  ${G}✓ Homebrew installed${D}"
        else
            echo -e "  ${R}✗ Cannot install dependencies without Homebrew. Exiting.${D}"
            exit 1
        fi
    fi

    # ═══════════════════════════════════════════════════════════════════
    #  1. Python
    # ═══════════════════════════════════════════════════════════════════
    echo ""
    echo -e "  ${B}▸ Python 3.11+${D}"

    PYTHON_CMD=""
    for cmd in python3.12 python3.11 python3; do
        if command -v "$cmd" &>/dev/null; then
            PY_VER=$("$cmd" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
            PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
            PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
            if [[ "$PY_MAJOR" -ge 3 && "$PY_MINOR" -ge 11 ]]; then
                PYTHON_CMD="$cmd"
                break
            fi
        fi
    done

    if [[ -n "$PYTHON_CMD" ]]; then
        echo -e "    ${G}✓ Already installed:${D} $($PYTHON_CMD --version 2>&1)"
    else
        echo -e "    ${Y}✗ Not found${D}"
        if ask_yn "Install Python 3.12?"; then
            echo -e "    ${DIM}Installing…${D}"
            if [[ "$PKG" == "brew" ]]; then
                brew install python@3.12 2>&1 | tail -3
            elif [[ "$PKG" == "apt" ]]; then
                sudo apt update -qq && sudo apt install -y python3.12 python3.12-venv python3-pip 2>&1 | tail -3
            elif [[ "$PKG" == "yum" ]]; then
                sudo yum install -y python3.12 2>&1 | tail -3
            fi
            # Re-detect
            for cmd in python3.12 python3.11 python3; do
                if command -v "$cmd" &>/dev/null; then
                    PYTHON_CMD="$cmd"
                    break
                fi
            done
            if [[ -n "$PYTHON_CMD" ]]; then
                echo -e "    ${G}✓ Python installed:${D} $($PYTHON_CMD --version 2>&1)"
            else
                echo -e "    ${R}✗ Installation failed. Install Python 3.11+ manually.${D}"
                exit 1
            fi
        else
            echo -e "    ${R}✗ Python 3.11+ is required. Exiting.${D}"
            exit 1
        fi
    fi

    # ═══════════════════════════════════════════════════════════════════
    #  2. Node.js
    # ═══════════════════════════════════════════════════════════════════
    echo ""
    echo -e "  ${B}▸ Node.js 18+${D}"

    if command -v node &>/dev/null; then
        NODE_VER=$(node --version 2>/dev/null | grep -oE '[0-9]+' | head -1)
        if [[ "$NODE_VER" -ge 18 ]]; then
            echo -e "    ${G}✓ Already installed:${D} Node.js $(node --version)"
        else
            echo -e "    ${Y}⚠  Found Node.js $(node --version) but need 18+${D}"
            if ask_yn "Upgrade Node.js?"; then
                echo -e "    ${DIM}Installing…${D}"
                if [[ "$PKG" == "brew" ]]; then
                    brew install node 2>&1 | tail -3
                elif [[ "$PKG" == "apt" ]]; then
                    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>&1 | tail -3
                    sudo apt install -y nodejs 2>&1 | tail -3
                fi
                echo -e "    ${G}✓ Node.js updated:${D} $(node --version)"
            else
                echo -e "    ${R}✗ Node.js 18+ is required. Exiting.${D}"
                exit 1
            fi
        fi
    else
        echo -e "    ${Y}✗ Not found${D}"
        if ask_yn "Install Node.js 20?"; then
            echo -e "    ${DIM}Installing…${D}"
            if [[ "$PKG" == "brew" ]]; then
                brew install node 2>&1 | tail -3
            elif [[ "$PKG" == "apt" ]]; then
                curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>&1 | tail -3
                sudo apt install -y nodejs 2>&1 | tail -3
            elif [[ "$PKG" == "yum" ]]; then
                curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - 2>&1 | tail -3
                sudo yum install -y nodejs 2>&1 | tail -3
            fi
            if command -v node &>/dev/null; then
                echo -e "    ${G}✓ Node.js installed:${D} $(node --version)"
            else
                echo -e "    ${R}✗ Installation failed. Install Node.js 18+ manually.${D}"
                exit 1
            fi
        else
            echo -e "    ${R}✗ Node.js 18+ is required. Exiting.${D}"
            exit 1
        fi
    fi

    # ═══════════════════════════════════════════════════════════════════
    #  3. PostgreSQL
    # ═══════════════════════════════════════════════════════════════════
    echo ""
    echo -e "  ${B}▸ PostgreSQL 16${D}"

    PG_FOUND=false
    PG_BIN=""
    for pg_path in "" "/opt/homebrew/opt/postgresql@16/bin/" "/opt/homebrew/opt/postgresql@15/bin/" "/usr/local/opt/postgresql@16/bin/" "/usr/lib/postgresql/16/bin/"; do
        if [[ -x "${pg_path}pg_isready" ]] || command -v "${pg_path}pg_isready" &>/dev/null; then
            PG_BIN="$pg_path"
            PG_FOUND=true
            PG_VERSION=$("${pg_path}pg_isready" --version 2>/dev/null | grep -oE '[0-9]+' | head -1)
            break
        fi
    done

    if [[ "$PG_FOUND" == true ]]; then
        echo -e "    ${G}✓ Already installed:${D} PostgreSQL ${PG_VERSION:-detected}"
    else
        echo -e "    ${Y}✗ Not found${D}"
        if ask_yn "Install PostgreSQL 16?"; then
            echo -e "    ${DIM}Installing…${D}"
            if [[ "$PKG" == "brew" ]]; then
                brew install postgresql@16 2>&1 | tail -3
                brew services start postgresql@16 2>&1 | tail -1
                PG_BIN="/opt/homebrew/opt/postgresql@16/bin/"
            elif [[ "$PKG" == "apt" ]]; then
                sudo apt update -qq && sudo apt install -y postgresql-16 2>&1 | tail -3
                sudo systemctl start postgresql 2>/dev/null || true
                PG_BIN="/usr/lib/postgresql/16/bin/"
            elif [[ "$PKG" == "yum" ]]; then
                sudo yum install -y postgresql16-server postgresql16 2>&1 | tail -3
                sudo postgresql-setup --initdb 2>/dev/null || true
                sudo systemctl start postgresql 2>/dev/null || true
            fi
            if [[ -x "${PG_BIN}pg_isready" ]] || command -v pg_isready &>/dev/null; then
                echo -e "    ${G}✓ PostgreSQL installed${D}"
                PG_FOUND=true
            else
                echo -e "    ${R}✗ Installation failed. Install PostgreSQL 16 manually.${D}"
                exit 1
            fi
        else
            echo -e "    ${R}✗ PostgreSQL is required. Exiting.${D}"
            exit 1
        fi
    fi

    # ═══════════════════════════════════════════════════════════════════
    #  4. Qdrant
    # ═══════════════════════════════════════════════════════════════════
    echo ""
    echo -e "  ${B}▸ Qdrant (Vector DB)${D}"

    QDRANT_BIN=""
    if command -v qdrant &>/dev/null; then
        QDRANT_BIN="qdrant"
    elif [[ -x "/usr/local/bin/qdrant" ]]; then
        QDRANT_BIN="/usr/local/bin/qdrant"
    fi

    if [[ -n "$QDRANT_BIN" ]]; then
        echo -e "    ${G}✓ Already installed:${D} $QDRANT_BIN"
    else
        echo -e "    ${Y}✗ Not found${D}"
        if ask_yn "Download & install Qdrant v1.13.2?"; then
            echo -e "    ${DIM}Downloading Qdrant for ${QDRANT_ARCH}-${QDRANT_OS}…${D}"
            QDRANT_URL="https://github.com/qdrant/qdrant/releases/download/v1.13.2/qdrant-${QDRANT_ARCH}-${QDRANT_OS}.tar.gz"
            QDRANT_TMP="/tmp/qdrant-download"
            mkdir -p "$QDRANT_TMP"
            if curl -fSL "$QDRANT_URL" -o "$QDRANT_TMP/qdrant.tar.gz" 2>&1 | tail -2; then
                tar -xzf "$QDRANT_TMP/qdrant.tar.gz" -C "$QDRANT_TMP" 2>/dev/null
                if [[ -f "$QDRANT_TMP/qdrant" ]]; then
                    chmod +x "$QDRANT_TMP/qdrant"
                    sudo mv "$QDRANT_TMP/qdrant" /usr/local/bin/qdrant 2>/dev/null || mv "$QDRANT_TMP/qdrant" /usr/local/bin/qdrant
                    QDRANT_BIN="/usr/local/bin/qdrant"
                    echo -e "    ${G}✓ Qdrant installed to /usr/local/bin/qdrant${D}"
                else
                    echo -e "    ${R}✗ Binary not found in archive${D}"
                    exit 1
                fi
            else
                echo -e "    ${R}✗ Download failed${D}"
                echo -e "    ${DIM}Manual: https://github.com/qdrant/qdrant/releases${D}"
                exit 1
            fi
            rm -rf "$QDRANT_TMP"
        else
            echo -e "    ${R}✗ Qdrant is required. Exiting.${D}"
            exit 1
        fi
    fi

    # ═══════════════════════════════════════════════════════════════════
    #  5. Redis
    # ═══════════════════════════════════════════════════════════════════
    echo ""
    echo -e "  ${B}▸ Redis${D}"

    if command -v redis-server &>/dev/null; then
        REDIS_VER=$(redis-server --version 2>/dev/null | grep -oE 'v=[0-9]+\.[0-9]+' | head -1 | sed 's/v=//')
        echo -e "    ${G}✓ Already installed:${D} Redis ${REDIS_VER:-detected}"
    else
        echo -e "    ${Y}✗ Not found${D} ${DIM}(optional — app works without it)${D}"
        if ask_yn "Install Redis?" "y"; then
            echo -e "    ${DIM}Installing…${D}"
            if [[ "$PKG" == "brew" ]]; then
                brew install redis 2>&1 | tail -3
            elif [[ "$PKG" == "apt" ]]; then
                sudo apt install -y redis-server 2>&1 | tail -3
            elif [[ "$PKG" == "yum" ]]; then
                sudo yum install -y redis 2>&1 | tail -3
            fi
            if command -v redis-server &>/dev/null; then
                echo -e "    ${G}✓ Redis installed${D}"
            else
                echo -e "    ${Y}⚠  Redis install failed — continuing without cache${D}"
            fi
        else
            echo -e "    ${DIM}Skipped — app will run without caching${D}"
        fi
    fi

    echo ""
    echo -e "  ${G}${B}✓ All dependencies checked${D}"

    # ══════════════════════════════════════════════════════════════════
    #  PHASE 2 — DATABASE CONFIGURATION (Auto mode only)
    # ══════════════════════════════════════════════════════════════════
    echo ""
    echo -e "${M}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${D}"
    echo -e "${M}${B}  PHASE 2 — Database Configuration${D}"
    echo -e "${M}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${D}"
    echo ""

    CFG_PG_PORT=$(ask_input "PostgreSQL port" "$PG_PORT")
    CFG_PG_USER=$(ask_input "Database user" "promptads")
    CFG_PG_PASS=$(ask_input "Database password" "changeme_in_production")
    CFG_PG_DB=$(ask_input "Database name" "promptads")

    PG_PORT="$CFG_PG_PORT"
    PG_USER="$CFG_PG_USER"
    PG_PASS="$CFG_PG_PASS"
    PG_DB="$CFG_PG_DB"

    echo ""
    echo -e "  ${DIM}────────────────────────────────────────${D}"
    echo -e "  ${DIM}Port     : ${C}$PG_PORT${D}"
    echo -e "  ${DIM}User     : ${C}$PG_USER${D}"
    echo -e "  ${DIM}Password : ${C}$PG_PASS${D}"
    echo -e "  ${DIM}Database : ${C}$PG_DB${D}"
    echo -e "  ${DIM}────────────────────────────────────────${D}"

    # ══════════════════════════════════════════════════════════════════
    #  PHASE 3 — ENVIRONMENT SETUP (Auto mode only)
    # ══════════════════════════════════════════════════════════════════
    echo ""
    echo -e "${M}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${D}"
    echo -e "${M}${B}  PHASE 3 — Environment & API Keys${D}"
    echo -e "${M}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${D}"
    echo ""

    # Check for existing .env
    EXISTING_KEY=""
    EXISTING_PROVIDER=""
    if [[ -f ".env" ]]; then
        EXISTING_KEY=$(grep '^LLM_API_KEY=' .env 2>/dev/null | sed 's/^LLM_API_KEY=//')
        EXISTING_PROVIDER=$(grep '^LLM_PROVIDER=' .env 2>/dev/null | sed 's/^LLM_PROVIDER=//')
    fi

    if [[ -n "$EXISTING_KEY" && "$EXISTING_KEY" != "your-api-key-here" ]]; then
        echo -e "  ${G}✓ Found existing API key in .env${D} ${DIM}(provider: ${EXISTING_PROVIDER:-gemini})${D}"
        if ask_yn "Keep existing .env settings?" "y"; then
            CFG_PROVIDER="$EXISTING_PROVIDER"
            CFG_API_KEY="$EXISTING_KEY"
        else
            CFG_PROVIDER=""
        fi
    fi

    if [[ -z "$CFG_API_KEY" || "$CFG_API_KEY" == "your-api-key-here" ]]; then
        echo ""
        echo -e "  ${B}Which AI provider?${D}"
        echo -e "    ${G}1)${D} Gemini ${DIM}(recommended — free tier available)${D}"
        echo -e "    ${C}2)${D} OpenAI"
        echo ""
        echo -ne "  ${W}Choose [1/2]: ${D}"
        read -r PROVIDER_CHOICE
        PROVIDER_CHOICE="${PROVIDER_CHOICE:-1}"

        if [[ "$PROVIDER_CHOICE" == "2" ]]; then
            CFG_PROVIDER="openai"
            CFG_MODEL="gpt-4o-mini"
            CFG_EMBED_MODEL="text-embedding-3-small"
            CFG_EMBED_DIM="1536"
        else
            CFG_PROVIDER="gemini"
            CFG_MODEL="gemini-2.5-flash"
            CFG_EMBED_MODEL="gemini-embedding-001"
            CFG_EMBED_DIM="3072"
        fi

        echo ""
        echo -ne "  ${W}Enter your ${CFG_PROVIDER} API key: ${D}"
        read -r CFG_API_KEY

        if [[ -z "$CFG_API_KEY" ]]; then
            echo -e "  ${R}✗ API key is required. You can edit .env later.${D}"
            CFG_API_KEY="your-api-key-here"
        fi
    fi

    # Set defaults if not set
    CFG_PROVIDER="${CFG_PROVIDER:-gemini}"
    if [[ "$CFG_PROVIDER" == "openai" ]]; then
        CFG_MODEL="${CFG_MODEL:-gpt-4o-mini}"
        CFG_EMBED_MODEL="${CFG_EMBED_MODEL:-text-embedding-3-small}"
        CFG_EMBED_DIM="${CFG_EMBED_DIM:-1536}"
    else
        CFG_MODEL="${CFG_MODEL:-gemini-2.5-flash}"
        CFG_EMBED_MODEL="${CFG_EMBED_MODEL:-gemini-embedding-001}"
        CFG_EMBED_DIM="${CFG_EMBED_DIM:-3072}"
    fi

    # ── Write .env ───────────────────────────────────────────────────
    echo ""
    echo -e "  ${DIM}Writing .env…${D}"
    cat > .env <<ENVFILE
# PromptAds AI - Environment Configuration (auto-generated by start.sh)

# ─────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────
POSTGRES_USER=${PG_USER}
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=${PG_DB}
POSTGRES_HOST=localhost
POSTGRES_PORT=${PG_PORT}
DATABASE_URL=postgresql+asyncpg://${PG_USER}:${PG_PASS}@localhost:${PG_PORT}/${PG_DB}

# ─────────────────────────────────────────────
# Qdrant (Vector DB)
# ─────────────────────────────────────────────
QDRANT_HOST=localhost
QDRANT_PORT=${QDRANT_PORT}
QDRANT_COLLECTION=ad_embeddings

# ─────────────────────────────────────────────
# Backend
# ─────────────────────────────────────────────
BACKEND_HOST=0.0.0.0
BACKEND_PORT=${BE_PORT}
BACKEND_SECRET_KEY=promptads-$(date +%s)-$(head -c 8 /dev/urandom | xxd -p)
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:3001","http://localhost:3002","http://localhost:3050"]

# ─────────────────────────────────────────────
# AI / LLM
# ─────────────────────────────────────────────
LLM_PROVIDER=${CFG_PROVIDER}
LLM_API_KEY=${CFG_API_KEY}
LLM_MODEL=${CFG_MODEL}
EMBEDDING_MODEL=${CFG_EMBED_MODEL}
EMBEDDING_DIMENSIONS=${CFG_EMBED_DIM}

# ─────────────────────────────────────────────
# Frontend
# ─────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:${BE_PORT}
NEXT_PUBLIC_APP_NAME=PromptAds AI

# ─────────────────────────────────────────────
# Redis
# ─────────────────────────────────────────────
REDIS_URL=redis://localhost:${REDIS_PORT}/0
ENVFILE

    cp -f .env backend/.env 2>/dev/null || true
    echo -e "  ${G}✓ .env created & synced to backend/.env${D}"

    # ── Create conv-ai .env.local ────────────────────────────────────
    cat > conversational-ai-test/.env.local <<CHATENV
PROMPTADS_BASE_URL=http://localhost:${BE_PORT}
GEMINI_API_KEY=${CFG_API_KEY}
CHATENV
    echo -e "  ${G}✓ conversational-ai-test/.env.local created${D}"

    # ══════════════════════════════════════════════════════════════════
    #  PHASE 4 — INSTALL PROJECT DEPENDENCIES (Auto mode only)
    # ══════════════════════════════════════════════════════════════════
    echo ""
    echo -e "${M}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${D}"
    echo -e "${M}${B}  PHASE 4 — Installing Project Dependencies${D}"
    echo -e "${M}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${D}"

    # ── Python venv + requirements.txt ───────────────────────────────
    echo ""
    echo -e "  ${B}▸ Backend (Python)${D}"
    if [[ ! -d "backend/.venv" ]]; then
        echo -e "    ${DIM}Creating virtual environment…${D}"
        "$PYTHON_CMD" -m venv backend/.venv
    else
        echo -e "    ${DIM}Virtual environment exists${D}"
    fi
    echo -e "    ${DIM}Installing requirements.txt…${D}"
    backend/.venv/bin/pip install -r backend/requirements.txt --quiet 2>&1 | tail -2
    echo -e "    ${G}✓ Backend dependencies installed${D}"

    # ── Frontend npm install ─────────────────────────────────────────
    echo ""
    echo -e "  ${B}▸ Dashboard Frontend (npm)${D}"
    echo -e "    ${DIM}Running npm install…${D}"
    (cd frontend && npm install 2>&1 | tail -3)
    echo -e "    ${G}✓ Dashboard dependencies installed${D}"

    # ── Conv AI npm install ──────────────────────────────────────────
    echo ""
    echo -e "  ${B}▸ Conversational AI Test (npm)${D}"
    echo -e "    ${DIM}Running npm install…${D}"
    (cd conversational-ai-test && npm install 2>&1 | tail -3)
    echo -e "    ${G}✓ Chat app dependencies installed${D}"

    echo ""
    echo -e "  ${G}${B}✓ All project dependencies installed${D}"

fi  # end SKIP_SETUP


# ══════════════════════════════════════════════════════════════════════
# ══════════════════════════════════════════════════════════════════════
#  START SERVERS
# ══════════════════════════════════════════════════════════════════════
# ══════════════════════════════════════════════════════════════════════

echo ""
echo -e "${G}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${D}"
echo -e "${G}${B}  Starting All Services${D}"
echo -e "${G}${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${D}"

# ── Load env values for server start ─────────────────────────────────
if [[ -f ".env" ]]; then
    eval "$(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB|POSTGRES_PORT|QDRANT_PORT|QDRANT_HOST|REDIS_URL|BACKEND_PORT|LLM_API_KEY)=' .env 2>/dev/null)"
fi

# Apply loaded values (with defaults)
PG_PORT="${POSTGRES_PORT:-$PG_PORT}"
PG_USER="${POSTGRES_USER:-promptads}"
PG_PASS="${POSTGRES_PASSWORD:-changeme_in_production}"
PG_DB="${POSTGRES_DB:-promptads}"

# ── Detect paths ─────────────────────────────────────────────────────
# Python
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

# PostgreSQL binary path
if [[ -z "$PG_BIN" ]]; then
    PG_BIN=""
    for pg_path in "" "/opt/homebrew/opt/postgresql@16/bin/" "/opt/homebrew/opt/postgresql@15/bin/" "/usr/local/opt/postgresql@16/bin/" "/usr/lib/postgresql/16/bin/"; do
        if [[ -x "${pg_path}pg_isready" ]] || command -v "${pg_path}pg_isready" &>/dev/null; then
            PG_BIN="$pg_path"
            break
        fi
    done
fi

# Qdrant binary path
if [[ -z "$QDRANT_BIN" ]]; then
    QDRANT_BIN=""
    if command -v qdrant &>/dev/null; then
        QDRANT_BIN="qdrant"
    elif [[ -x "/usr/local/bin/qdrant" ]]; then
        QDRANT_BIN="/usr/local/bin/qdrant"
    fi
fi

# ══════════════════════════════════════════════════════════════════════
#  [1/6] PostgreSQL
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${B}[1/6]${D} ${C}PostgreSQL (port $PG_PORT)…${D}"

if "${PG_BIN}pg_isready" -p "$PG_PORT" -q 2>/dev/null; then
    echo -e "  ${G}✓ Already running${D}"
else
    echo -e "  ${Y}Starting…${D}"
    if command -v brew &>/dev/null; then
        brew services start postgresql@16 2>/dev/null || true
    elif command -v pg_ctl &>/dev/null; then
        pg_ctl start -D /usr/local/var/postgres 2>/dev/null || true
    elif command -v systemctl &>/dev/null; then
        sudo systemctl start postgresql 2>/dev/null || true
    fi
    for i in $(seq 1 15); do
        "${PG_BIN}pg_isready" -p "$PG_PORT" -q 2>/dev/null && break
        sleep 1
    done
    if "${PG_BIN}pg_isready" -p "$PG_PORT" -q 2>/dev/null; then
        echo -e "  ${G}✓ PostgreSQL started${D}"
    else
        echo -e "  ${R}✗ PostgreSQL failed to start on port $PG_PORT${D}"
        exit 1
    fi
fi

# Ensure role & database exist
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
#  [2/6] Qdrant
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${B}[2/6]${D} ${C}Qdrant (port $QDRANT_PORT)…${D}"

if curl -sf "http://localhost:$QDRANT_PORT/healthz" &>/dev/null; then
    echo -e "  ${G}✓ Already running${D}"
else
    if [[ -n "$QDRANT_BIN" ]]; then
        echo -e "  ${Y}Starting…${D}"
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
            echo -e "  ${R}✗ Qdrant failed to start. Check /tmp/qdrant.log${D}"
            exit 1
        fi
    else
        echo -e "  ${R}✗ Qdrant binary not found${D}"
        exit 1
    fi
fi

# ══════════════════════════════════════════════════════════════════════
#  [3/6] Redis
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${B}[3/6]${D} ${C}Redis (port $REDIS_PORT)…${D}"

if command -v redis-cli &>/dev/null && redis-cli -p "$REDIS_PORT" ping &>/dev/null; then
    echo -e "  ${G}✓ Already running${D}"
else
    if command -v redis-server &>/dev/null; then
        echo -e "  ${Y}Starting…${D}"
        if command -v brew &>/dev/null; then
            brew services start redis 2>/dev/null || true
        else
            redis-server --port "$REDIS_PORT" --daemonize yes 2>/dev/null || true
        fi
        sleep 2
        if command -v redis-cli &>/dev/null && redis-cli -p "$REDIS_PORT" ping &>/dev/null; then
            echo -e "  ${G}✓ Redis started${D}"
        else
            echo -e "  ${Y}⚠  Redis not responding — app will run without caching${D}"
        fi
    else
        echo -e "  ${Y}⚠  Redis not installed — app will run without caching${D}"
    fi
fi

# ══════════════════════════════════════════════════════════════════════
#  [4/6] Backend
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${B}[4/6]${D} ${C}Backend API (port $BE_PORT)…${D}"

# Ensure venv + deps exist (for manual mode)
if [[ ! -d "backend/.venv" ]]; then
    echo -e "  ${Y}Creating Python venv…${D}"
    python3 -m venv backend/.venv
    echo -e "  ${DIM}Installing dependencies…${D}"
    backend/.venv/bin/pip install -r backend/requirements.txt --quiet 2>&1
    echo -e "  ${G}✓ Backend deps installed${D}"
fi

# Ensure .env synced
if [[ -f ".env" && ! -f "backend/.env" ]]; then
    cp .env backend/.env
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
#  [5/6] Dashboard Frontend
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${B}[5/6]${D} ${C}Dashboard (port $FE_PORT)…${D}"

if [[ ! -d "frontend/node_modules" ]]; then
    echo -e "  ${DIM}Installing dependencies…${D}"
    (cd frontend && npm install 2>&1 | tail -3)
    echo -e "  ${G}✓ Deps installed${D}"
fi

lsof -iTCP:$FE_PORT -sTCP:LISTEN -t 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

cd frontend && PORT=$FE_PORT npx next dev --port $FE_PORT &>/tmp/promptads-frontend.log &
FE_PID=$!
cd "$SCRIPT_DIR"
sleep 3

echo -e "  ${G}✓ Dashboard starting${D}"

# ══════════════════════════════════════════════════════════════════════
#  [6/6] Conversational AI Test
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${B}[6/6]${D} ${C}Conversational AI (port $CHAT_PORT)…${D}"

if [[ ! -d "conversational-ai-test/node_modules" ]]; then
    echo -e "  ${DIM}Installing dependencies…${D}"
    (cd conversational-ai-test && npm install 2>&1 | tail -3)
    echo -e "  ${G}✓ Deps installed${D}"
fi

if [[ ! -f "conversational-ai-test/.env.local" ]]; then
    GEMINI_KEY=$(grep 'LLM_API_KEY=' .env 2>/dev/null | sed 's/^LLM_API_KEY=//' || echo "your-gemini-key")
    cat > conversational-ai-test/.env.local <<ENVEOF
PROMPTADS_BASE_URL=http://localhost:$BE_PORT
GEMINI_API_KEY=$GEMINI_KEY
ENVEOF
    echo -e "  ${DIM}Created .env.local${D}"
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
echo -e "${G}${B}║            ✦  PromptAds AI — All Running!            ║${D}"
echo -e "${G}${B}╠══════════════════════════════════════════════════════╣${D}"
echo -e "${G}${B}║${D}                                                      ${G}${B}║${D}"
echo -e "${G}${B}║${D}  ${B}Dashboard${D}         →  ${C}http://localhost:$FE_PORT${D}           ${G}${B}║${D}"
echo -e "${G}${B}║${D}  ${B}Conversational AI${D} →  ${C}http://localhost:$CHAT_PORT${D}           ${G}${B}║${D}"
echo -e "${G}${B}║${D}  ${B}Backend API${D}       →  ${C}http://localhost:$BE_PORT${D}           ${G}${B}║${D}"
echo -e "${G}${B}║${D}  ${B}API Docs${D}          →  ${C}http://localhost:$BE_PORT/docs${D}      ${G}${B}║${D}"
echo -e "${G}${B}║${D}                                                      ${G}${B}║${D}"
echo -e "${G}${B}╠══════════════════════════════════════════════════════╣${D}"
echo -e "${G}${B}║${D}  PostgreSQL  ${DIM}:$PG_PORT${D}   Qdrant ${DIM}:$QDRANT_PORT${D}   Redis ${DIM}:$REDIS_PORT${D}   ${G}${B}║${D}"
echo -e "${G}${B}╠══════════════════════════════════════════════════════╣${D}"
echo -e "${G}${B}║${D}  Logs:                                                ${G}${B}║${D}"
echo -e "${G}${B}║${D}    ${DIM}/tmp/promptads-backend.log${D}                       ${G}${B}║${D}"
echo -e "${G}${B}║${D}    ${DIM}/tmp/promptads-frontend.log${D}                      ${G}${B}║${D}"
echo -e "${G}${B}║${D}    ${DIM}/tmp/promptads-chat.log${D}                          ${G}${B}║${D}"
echo -e "${G}${B}╠══════════════════════════════════════════════════════╣${D}"
echo -e "${G}${B}║${D}  Press ${Y}Ctrl+C${D} to stop all services                   ${G}${B}║${D}"
echo -e "${G}${B}╚══════════════════════════════════════════════════════╝${D}"
echo ""

wait
