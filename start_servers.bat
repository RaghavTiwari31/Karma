@echo off
echo ============================================
echo  KARMA — Starting Backend Services
echo ============================================
echo.

REM Activate virtual environment
call venv\Scripts\activate

echo [1/2] Starting Mock Server on port 8001...
start "KARMA Mock Server" cmd /k "venv\Scripts\python.exe -m uvicorn backend.connectors.mock_server:mock_app --host 0.0.0.0 --port 8001 --reload"

echo Waiting 2 seconds for mock server to start...
timeout /t 2 /nobreak >nul

echo [2/2] Starting Main API on port 8000...
start "KARMA Main API" cmd /k "venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

echo.
echo ============================================
echo  Both servers starting. Check windows above.
echo  Main API:    http://localhost:8000/health
echo  Mock Server: http://localhost:8001/health
echo  API Docs:    http://localhost:8000/docs
echo ============================================
pause
