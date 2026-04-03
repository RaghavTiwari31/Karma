# KARMA (Cost Accountability & Real-time Micro-Action Engine)

> **ET GenAI Hackathon Submission**
> **Theme:** Enterprise Efficiency & Autonomous Operations

KARMA is a multi-agent AI system designed to eliminate enterprise waste autonomously. By plugging into your existing ERP, CRM, and communication tools (SAP, Salesforce, Slack, AWS), KARMA monitors software utilization, vendor contracts, and SLA metrics in real-time. When it detects waste or risk, it doesn't just send a dashboard alert—it intercepts the purchasing workflow, proposes renegotiated contracts, resizes cloud instances, and routes actionable savings directly to decision-makers.

![KARMA Dashboard](./frontend/public/favicon.ico) *A completely functional web app demonstrating the engine!*

## Features 🚀

- **Ghost Approver (Interception Agent):** Intervenes before money is spent. It reads an incoming approval request, enriches it with utilization and alternatives, and presents the approver with Gemini-powered cost-saving alternatives directly via Slack-style blocks.
- **Waste Calendar (Proactive Agent):** Prioritizes expiring contracts and idle software, mapped on a timeline. Teams can assign action owners and track the resolution of zero-value tooling.
- **Decision DNA (Forensic Agent):** Deconstructs past cost-overruns to identify *why* a poor purchasing decision was made (e.g., missing utilization data) and proposes systemic KARMA rules to prevent recurrence.
- **SLA Monitor (Risk Agent):** Autonomously monitors supplier uptime strings against SLA contracts, immediately injecting CRITICAL risks into the Waste Calendar before penalties are lost.
- **Karma Score (Gamification):** Departments are scored on their cost accountability. Approving reduced seats adds points; ignoring Ghost Approver recommendations deducts points.

---

## 📺 Video Demo

<!-- 
REPLACE THE LINK BELOW WITH YOUR ACTUAL VIDEO LINK 
The syntax below uses a clickable image to simulate a video embed.
You can also use a direct video tag if you prefer:
<video src="video_url.mp4" controls width="100%"></video>
-->

[![KARMA Demo Video](https://img.placeholder.com/800x450/2563eb/ffffff?text=Click+to+Watch+KARMA+Demo)](https://your-video-link-here.com)

*Watch how KARMA autonomously identifies and eliminates enterprise waste.*

---

## Technical Stack

- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, Recharts, Lucide Icons
- **Backend:** Python 3.10+, FastAPI, SQLite, WebSockets
- **AI Core:** Google Gemini 2.0 Flash Lite via `google-genai` SDK
- **Data Integrations (Mocked):** SAP (ERP/Procurement), JIRA (ITSM), AWS (Cloud)

---

## 🛠 Setup & Installation

### Prerequisites
- Python 3.10 or higher
- Node.js 18+
- A Google Gemini API Key

### 1. Clone & Configure
```bash
git clone <repository>
cd karma

# Create the environment file
cp .env.example .env
```

Open `.env` and add your Gemini API Key:
```env
GEMINI_API_KEY=AIzaSy...
```

### 2. Backend Setup
```bash
# Create a virtual environment and install dependencies
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

---

## 🚀 How to Run

KARMA includes a batch script to start all services simultaneously for a live demonstration.

### Windows (One-Click Start)
Run the automated startup script from the root directory:
```cmd
.\start_servers.bat
```

**What this does:**
1. Seeds the SQLite database with stable Gemini demo responses (for <100ms offline resilience).
2. Starts the **Mock Connector Server** (Port 8001).
3. Starts the **FastAPI Main Backend** (Port 8000).
4. Starts the **React Frontend** (Port 5173).

### Manual Startup (Cross-Platform)
If you prefer to run services manually:

**1. Seed the Cache (Required for Demo Reliability):**
```bash
python seed_gemini_cache.py
```

**2. Start Backend APIs (Run in separate terminal windows):**
```bash
# Terminal 1: Mock Server
python -m uvicorn backend.connectors.mock_server:mock_app --port 8001

# Terminal 2: Main API
python -m uvicorn backend.main:app --port 8000
```

**3. Start Frontend:**
```bash
cd frontend
npm run dev
```

---

## 🎬 Demo Walkthrough

1. **Dashboard Overview (`http://localhost:5173`):**
   - View the aggregate exposure (e.g., ₹50L+ preventable waste).
   - See the real-time leaderboard gamifying cost-savings across departments.

2. **Ghost Approver Simulation:**
   - Navigate to **Ghost Approver**.
   - Click the "Salesforce CRM" preset.
   - Click "Intercept & Analyze". Watch KARMA evaluate utilization and propose "Approve Reduced" to save ₹5,00,000 instantly.
   - Click the recommended option to see the execution receipt.

3. **Waste Calendar Tracking:**
   - Navigate to **Waste Calendar**.
   - Identify a `CRITICAL` SLA risk injected autonomously by the background SLA monitor.
   - Click `Fix` to simulate resolving the waste, automatically crediting your team's Karma Score!

4. **Decision DNA:**
   - Navigate to **Decision DNA**.
   - Review a "Cloud Compute Overrun" to see a visual nodes timeline explaining how a lack of context led to a ₹28,00,000 loss, and how KARMA would intercept it today.

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API credentials | **Yes** |
| `SAP_API_URL` | Mock connector URL (default: `http://localhost:8001`) | No |
| `JIRA_API_URL` | Mock connector URL (default: `http://localhost:8001`) | No |
| `DB_PATH` | Path to SQLite DB (default: `backend/karma.db`) | No |

---
**Crafted for ET GenAI Hackathon 2026**
