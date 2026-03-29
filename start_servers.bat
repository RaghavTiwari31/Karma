@echo off
echo ============================================
echo  KARMA — Full Stack Demo Launcher
echo ============================================
echo.

REM Activate virtual environment
call venv\Scripts\activate

echo [STEP 0] Seeding Gemini cache for offline demo...
venv\Scripts\python.exe seed_gemini_cache.py
echo.

echo [1/3] Starting Mock Server on port 8001...
start "KARMA Mock Server" cmd /k "venv\Scripts\python.exe -m uvicorn backend.connectors.mock_server:mock_app --host 0.0.0.0 --port 8001"

echo Waiting 2 seconds...
timeout /t 2 /nobreak >nul

echo [2/3] Starting Main API on port 8000...
start "KARMA Main API" cmd /k "venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

echo Waiting 4 seconds for backend to fully initialise...
timeout /t 4 /nobreak >nul

echo [3/3] Starting React Frontend on port 5173...
start "KARMA Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ============================================
echo  KARMA is live! Open the browser to:
echo.
echo  Frontend:    http://localhost:5173
echo  Main API:    http://localhost:8000/docs
echo  Mock Server: http://localhost:8001/health
echo.
echo  Gemini cache is pre-seeded. Demo works
echo  FULLY OFFLINE (Ghost Approver < 100ms).
echo ============================================
pause
