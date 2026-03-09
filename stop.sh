#!/usr/bin/env bash
#
# PromptAds AI – Stop Script
# Gracefully stops application services, then optionally infrastructure.
#
# Usage:  ./stop.sh
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

# ── Ports ────────────────────────────────────────────────────────────
PG_PORT=5433
QDRANT_PORT=6333
REDIS_PORT=6379
BE_PORT=8000
FE_PORT=3002
CHAT_PORT=3050

# ── Helper: kill processes on a port ─────────────────────────────────
kill_port() {
    local port="$1"
    local pids
    pids=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null)
    if [[ -n "$pids" ]]; then
        echo "$pids" | xargs kill -9 2>/dev/null
        return 0
    fi
    return 1
}

# ── Helper: check if port is in use ─────────────────────────────────
port_active() {
    lsof -iTCP:"$1" -sTCP:LISTEN -t &>/dev/null
}

# ══════════════════════════════════════════════════════════════════════
#  Phase 1: Stop Application Services
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${Y}${B}╔══════════════════════════════════════════════════════╗${D}"
echo -e "${Y}${B}║          Stopping PromptAds AI Services…             ║${D}"
echo -e "${Y}${B}╚══════════════════════════════════════════════════════╝${D}"
echo ""

# ── Dashboard (port 3002) ────────────────────────────────────────────
echo -ne "  ${B}Dashboard${D}         ${DIM}:$FE_PORT${D}  "
if kill_port $FE_PORT; then
    echo -e "${G}✓ Stopped${D}"
else
    echo -e "${DIM}not running${D}"
fi

# ── Conversational AI (port 3050) ────────────────────────────────────
echo -ne "  ${B}Conversational AI${D} ${DIM}:$CHAT_PORT${D}  "
if kill_port $CHAT_PORT; then
    echo -e "${G}✓ Stopped${D}"
else
    echo -e "${DIM}not running${D}"
fi

# ── Backend API (port 8000) ──────────────────────────────────────────
echo -ne "  ${B}Backend API${D}       ${DIM}:$BE_PORT${D}  "
if kill_port $BE_PORT; then
    echo -e "${G}✓ Stopped${D}"
else
    echo -e "${DIM}not running${D}"
fi

echo ""
echo -e "${G}${B}╔══════════════════════════════════════════════════════╗${D}"
echo -e "${G}${B}║          ✦  Application services stopped!            ║${D}"
echo -e "${G}${B}╚══════════════════════════════════════════════════════╝${D}"
echo ""

# ══════════════════════════════════════════════════════════════════════
#  Phase 2: Ask about Infrastructure
# ══════════════════════════════════════════════════════════════════════

# Check which infra services are running
PG_RUNNING=false
QD_RUNNING=false
RD_RUNNING=false
port_active $PG_PORT    && PG_RUNNING=true
port_active $QDRANT_PORT && QD_RUNNING=true
port_active $REDIS_PORT  && RD_RUNNING=true

if ! $PG_RUNNING && ! $QD_RUNNING && ! $RD_RUNNING; then
    echo -e "  ${DIM}Infrastructure services are not running.${D}"
    echo ""
    exit 0
fi

echo -e "  ${Y}Infrastructure still running:${D}"
echo ""
$PG_RUNNING && echo -e "    ${B}PostgreSQL${D}  ${DIM}:$PG_PORT${D}"
$QD_RUNNING && echo -e "    ${B}Qdrant${D}      ${DIM}:$QDRANT_PORT${D}"
$RD_RUNNING && echo -e "    ${B}Redis${D}       ${DIM}:$REDIS_PORT${D}"
echo ""
echo -e "  ${W}Want to stop infrastructure too?${D}"
echo -e "  ${DIM}Press ${Y}Ctrl+C${D}${DIM} → stop them  │  Press ${C}Enter${D}${DIM} → keep them running${D}"
echo ""

# Trap Ctrl+C in this phase to stop infra
stop_infra() {
    echo ""
    echo ""
    echo -e "  ${Y}${B}Stopping infrastructure…${D}"
    echo ""

    if $PG_RUNNING; then
        echo -ne "    ${B}PostgreSQL${D}  ${DIM}:$PG_PORT${D}  "
        # Try graceful pg_ctl stop first, fall back to kill
        if command -v /opt/homebrew/opt/postgresql@16/bin/pg_ctl &>/dev/null; then
            /opt/homebrew/opt/postgresql@16/bin/pg_ctl -D /opt/homebrew/var/postgresql@16 stop -m fast &>/dev/null && echo -e "${G}✓ Stopped${D}" || {
                kill_port $PG_PORT && echo -e "${G}✓ Stopped${D}" || echo -e "${R}✗ Failed${D}"
            }
        else
            kill_port $PG_PORT && echo -e "${G}✓ Stopped${D}" || echo -e "${R}✗ Failed${D}"
        fi
    fi

    if $QD_RUNNING; then
        echo -ne "    ${B}Qdrant${D}      ${DIM}:$QDRANT_PORT${D}  "
        kill_port $QDRANT_PORT && echo -e "${G}✓ Stopped${D}" || echo -e "${R}✗ Failed${D}"
    fi

    if $RD_RUNNING; then
        echo -ne "    ${B}Redis${D}       ${DIM}:$REDIS_PORT${D}  "
        if command -v redis-cli &>/dev/null; then
            redis-cli -p $REDIS_PORT shutdown &>/dev/null && echo -e "${G}✓ Stopped${D}" || {
                kill_port $REDIS_PORT && echo -e "${G}✓ Stopped${D}" || echo -e "${R}✗ Failed${D}"
            }
        else
            kill_port $REDIS_PORT && echo -e "${G}✓ Stopped${D}" || echo -e "${R}✗ Failed${D}"
        fi
    fi

    echo ""
    echo -e "  ${G}${B}✦  Everything stopped. Goodbye!${D}"
    echo ""
    exit 0
}

trap stop_infra SIGINT

# Wait for Enter
read -r

# User pressed Enter → keep infra, just exit
echo -e "  ${G}${B}✦  Infrastructure kept running. Goodbye!${D}"
echo ""
exit 0
