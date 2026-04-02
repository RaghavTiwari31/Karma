#!/bin/bash

# ============================================
#  KARMA — Mac Launcher (Server & Frontend)
# ============================================

# Ensure we're in the project root (where this script is located)
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_ROOT"

echo "============================================"
echo "  KARMA — Mac Launch Sequence Starting..."
echo "============================================"
echo ""

# 1. Virtual Environment Setup Check
VENV_DIR="$PROJECT_ROOT/venv"
if [ ! -d "$VENV_DIR" ]; then
    # Check if they have .venv instead
    if [ -d "$PROJECT_ROOT/.venv" ]; then
        VENV_DIR="$PROJECT_ROOT/.venv"
    else
        echo "⚠️  Wait! Virtual Environment ('venv') not found in root."
        echo "Creating one now to ensure KARMA works..."
        python3 -m venv venv
        VENV_DIR="$PROJECT_ROOT/venv"
        echo "✅ Created venv. Installing backend dependencies..."
        "$VENV_DIR/bin/pip" install -r backend/requirements.txt
    fi
fi

PYTHON_EXEC="$VENV_DIR/bin/python3"

# 2. Seed Gemini Cache (Offline mode prep)
echo "[STEP 0] Seeding Gemini cache for offline demo..."
$PYTHON_EXEC seed_gemini_cache.py
echo ""

# Function to launch a command in a new Mac Terminal window
launch_tab() {
    local title="$1"
    local command="$2"
    local working_dir="${3:-$PROJECT_ROOT}"
    
    osascript -e "tell application \"Terminal\"
        do script \"cd '$working_dir' && clear && echo '🚀 Starting $title...' && $command\"
    end tell" > /dev/null
}

# [1/3] Starting Mock Server on port 8001
echo "[1/3] Starting Mock Server on port 8001..."
launch_tab "Mock Server" "$PYTHON_EXEC -m uvicorn backend.connectors.mock_server:mock_app --host 0.0.0.0 --port 8001"

echo "Waiting 2 seconds..."
sleep 2

# [2/3] Starting Main API on port 8000
echo "[2/3] Starting Main API on port 8000..."
launch_tab "Main API" "$PYTHON_EXEC -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

echo "Waiting 4 seconds for backend to sync..."
sleep 4

# [3/3] Starting React Frontend on port 5173
echo "[3/3] Starting React Frontend on port 5173..."
launch_tab "Frontend" "npm run dev" "$PROJECT_ROOT/frontend"

echo ""
echo "============================================"
echo "  ✅ KARMA IS LIVE (MAC EDITION)"
echo "============================================"
echo "  Frontend:    http://localhost:5173"
echo "  Main API:    http://localhost:8000/docs"
echo "  Mock Server: http://localhost:8001/health"
echo "============================================"
echo ""
echo "Keep this window open or press Ctrl+C to stop (though services live in separate terminals)."
