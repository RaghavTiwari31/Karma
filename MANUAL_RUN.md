# 🚀 KARMA — Manual Service Startup Guide

If the `start_servers.sh` script is not working on your machine, follow these steps to manually start the backend services and the frontend.

## Prerequisites
Ensure your virtual environment is activated or use the full path to your python executable.

---

### 🟢 Step 0: Seed Gemini Cache
Run this once to pre-warm the database with demo scenarios.  
**In the root directory:**
```bash
python3 seed_gemini_cache.py
```

### 🟠 Step 1: Start the Mock Server
This serves the vendor utilisation data.  
**In the root directory:**
```bash
python3 -m uvicorn backend.connectors.mock_server:mock_app --host 0.0.0.0 --port 8001
```

### 🔵 Step 2: Start the Main API
The core KARMA orchestrator and agents.  
**In a NEW terminal window/tab, in the root directory:**
```bash
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### 🟣 Step 3: Start the Frontend
The React dashboard.  
**In a NEW terminal window/tab:**
```bash
cd frontend
npm run dev
```

---

## 🔗 Local Access
Once all services are running, you can access them at:

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Main API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Mock Server Health:** [http://localhost:8001/health](http://localhost:8001/health)

---

## 🛠️ Troubleshooting
- If a port is already in use (`ERROR: [Errno 48] Address already in use`):
  ```bash
  lsof -i :8000  # Find the process ID (PID)
  kill -9 <PID>    # Kill it manually
  ```
- Ensure your `.env` file has a valid `GEMINI_API_KEY`.
