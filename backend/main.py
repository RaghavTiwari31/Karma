"""
main.py — KARMA Backend API (port 8000)
FastAPI application with lifespan startup/teardown, health check, and
all agent API routes.
"""

from __future__ import annotations

import logging
import os
import sys
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("karma.main")

# ---------------------------------------------------------------------------
# App state container
# ---------------------------------------------------------------------------

class AppState:
    db = None
    gemini = None
    connector_registry: dict = {}
    orchestrator = None


state = AppState()


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------

import asyncio
import json as _json
from datetime import datetime as _dt


class ConnectionManager:
    """
    Thread-safe WebSocket connection pool.
    Maintains a set of active WebSocket clients and broadcasts
    JSON alert payloads to all of them concurrently.
    """

    def __init__(self):
        self._active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._active.append(ws)
        logger.info("WS client connected — pool size: %d", len(self._active))

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._active:
            self._active.remove(ws)
        logger.info("WS client disconnected — pool size: %d", len(self._active))

    async def broadcast(self, payload: dict) -> None:
        """Send payload to all connected clients; silently drop dead connections."""
        if not self._active:
            return
        message = _json.dumps(payload, default=str)
        dead = []
        for ws in list(self._active):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    @property
    def client_count(self) -> int:
        return len(self._active)


# Singleton shared across all routes
ws_manager = ConnectionManager()


async def broadcast_alert(
    event_type: str,
    agent: str,
    title: str,
    body: dict,
    severity: str = "info",      # "info" | "warning" | "critical" | "success"
) -> None:
    """
    Convenience wrapper — stamps the alert and broadcasts to all WS clients.
    Call this from any API route after a significant event fires.
    """
    await ws_manager.broadcast({
        "event_type":  event_type,
        "agent":       agent,
        "title":       title,
        "severity":    severity,
        "timestamp":   _dt.utcnow().isoformat() + "Z",
        "data":        body,
    })



# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("KARMA backend starting up…")

    from backend.db.database import Database
    state.db = Database()
    await state.db.initialize()

    from backend.ai.gemini_client import GeminiClient
    state.gemini = GeminiClient()
    state.gemini.set_db(state.db)

    from backend.connectors.connector_registry import build_registry
    state.connector_registry = await build_registry()

    from backend.orchestrator import Orchestrator
    state.orchestrator = Orchestrator(
        gemini_client=state.gemini,
        connector_registry=state.connector_registry,
        db=state.db,
    )

    # Auto-refresh waste calendar on startup so data is ready immediately
    logger.info("Auto-refreshing waste calendar on startup…")
    try:
        from backend.agents.base_agent import KARMAEvent
        refresh_event = KARMAEvent(
            event_id=f"startup_{uuid.uuid4().hex[:8]}",
            event_type="refresh",
            source="csv",
            payload={},
            context={},
            timestamp=str(time.time()),
        )
        await state.orchestrator.dispatch(refresh_event)
        logger.info("Waste calendar seeded successfully.")
    except Exception as e:
        logger.warning("Startup waste calendar refresh failed (non-fatal): %s", e)

    logger.info("All systems initialised. KARMA is live.")  # base ready

    # SLA Monitor: scan all contracts on startup
    try:
        from backend.agents.base_agent import KARMAEvent as _KE
        sla_event = _KE(
            event_id=f"startup_sla_{uuid.uuid4().hex[:8]}",
            event_type="sla_scan",
            source="sla_monitor",
            payload={},
            context={},
            timestamp=str(time.time()),
        )
        await state.orchestrator.dispatch(sla_event)
        logger.info("SLA contract scan complete.")
    except Exception as e:
        logger.warning("Startup SLA scan failed (non-fatal): %s", e)

    # Karma Score Engine: seed teams if first run
    try:
        from backend.agents.base_agent import KARMAEvent as _KE2
        seed_event = _KE2(
            event_id=f"startup_seed_{uuid.uuid4().hex[:8]}",
            event_type="seed_scores",
            source="karma_score",
            payload={},
            context={},
            timestamp=str(time.time()),
        )
        await state.orchestrator.dispatch(seed_event)
        logger.info("Karma Score teams seeded.")
    except Exception as e:
        logger.warning("Startup karma seed failed (non-fatal): %s", e)

    logger.info("All systems fully initialised. KARMA is live.")
    yield

    await state.db.close()
    logger.info("KARMA backend shut down cleanly.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="KARMA — Cost Accountability & Real-time Micro-Action Engine",
    description=(
        "Multi-agent AI system that intercepts financial waste at the moment of decision. "
        "Built for the ET Gen AI Hackathon 2026 (Problem Statement 3)."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# WebSocket — Live Alerts  (Phase 9)
# ---------------------------------------------------------------------------

@app.websocket("/ws/live-alerts")
async def live_alerts(websocket: WebSocket):
    """
    Persistent WebSocket channel for real-time KARMA event alerts.

    Clients receive JSON payloads whenever:
      • Ghost Approver analyses or decides on an approval request
      • SLA Monitor detects a CRITICAL / HIGH breach risk
      • Execution Agent completes an action
      • Karma Score changes significantly

    Payload schema:
    {
      "event_type": str,      // e.g. "ghost_approver.analyse"
      "agent":      str,      // e.g. "GhostApproverAgent"
      "title":      str,      // human-readable headline
      "severity":   str,      // "info" | "warning" | "critical" | "success"
      "timestamp":  str,      // ISO-8601 UTC
      "data":       object    // event-specific payload
    }

    The server sends a welcome ping on connect, then stays open
    until the client disconnects or the server restarts.
    """
    await ws_manager.connect(websocket)
    try:
        # Welcome handshake
        await websocket.send_text(_json.dumps({
            "event_type": "connection.established",
            "agent":      "KARMA",
            "title":      "Live alerts channel open",
            "severity":   "info",
            "timestamp":  _dt.utcnow().isoformat() + "Z",
            "data":       {"clients": ws_manager.client_count},
        }, default=str))
        # Keep alive — echo any client pings back as pongs
        while True:
            msg = await websocket.receive_text()
            if msg.strip().lower() in ("ping", "heartbeat"):
                await websocket.send_text(_json.dumps({
                    "event_type": "pong",
                    "agent":      "KARMA",
                    "title":      "Heartbeat OK",
                    "severity":   "info",
                    "timestamp":  _dt.utcnow().isoformat() + "Z",
                    "data":       {"clients": ws_manager.client_count},
                }, default=str))
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning("WS error: %s", e)
        ws_manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class AssignRequest(BaseModel):
    event_id: str
    assigned_to: str

class CompleteRequest(BaseModel):
    event_id: str
    team: str = "general"

class AnalyseRequest(BaseModel):
    vendor: str
    amount_inr: float
    category: str
    requester: str = "procurement@acme.com"

class DecideRequest(BaseModel):
    vendor: str
    chosen_option_id: str          # "approve_full" | "approve_reduced" | "switch_vendor"
    original_amount_inr: float
    savings_inr: float = 0.0
    available_savings_inr: float = 0.0
    approver: str = "procurement@acme.com"
    category: str = "General"
    recommended_seats: Optional[int] = None
    execution_payload: dict = {}


# ---------------------------------------------------------------------------
# Helper: standard response envelope
# ---------------------------------------------------------------------------

def envelope(data: Any, agent: str = "System", latency_ms: int = 0, confidence: float = 1.0) -> dict:
    return {
        "success": True,
        "data": data,
        "meta": {
            "agent": agent,
            "latency_ms": latency_ms,
            "confidence_score": confidence,
        },
        "error": None,
    }


# ---------------------------------------------------------------------------
# System routes
# ---------------------------------------------------------------------------

@app.get("/health", tags=["System"])
async def health_check() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "KARMA Backend",
        "version": "0.2.0",
        "timestamp": time.time(),
        "db_connected": state.db is not None,
        "gemini_ready": state.gemini is not None,
        "orchestrator_ready": state.orchestrator is not None,
    }


@app.get("/api/test-gemini", tags=["System"])
async def test_gemini() -> dict[str, Any]:
    """Smoke test — calls Gemini live and returns the parsed JSON response."""
    start = time.time()
    result = await state.gemini.generate_json(
        prompt="Return a JSON object with two keys: 'status' (value: 'ok') and 'message' (a one-sentence description of what KARMA does).",
        system_instruction="You are a helpful assistant. Always respond in valid JSON.",
        use_cache=False,
    )
    return envelope(result, agent="System", latency_ms=round((time.time() - start) * 1000))


# ---------------------------------------------------------------------------
# Waste Calendar routes  (Pillar 1)
# ---------------------------------------------------------------------------

@app.get("/api/waste-calendar", tags=["Waste Calendar"])
async def get_waste_calendar() -> dict[str, Any]:
    """
    Returns the ranked 90-day waste prevention calendar.
    Events are sorted by estimated_savings_inr descending.
    """
    start = time.time()
    agent = state.orchestrator.get_agent("waste_calendar")
    if not agent:
        raise HTTPException(status_code=503, detail="WasteCalendarAgent not available")
    data = await agent.get_calendar()
    return envelope(data, agent="WasteCalendarAgent", latency_ms=round((time.time() - start) * 1000))


@app.post("/api/waste-calendar/refresh", tags=["Waste Calendar"])
async def refresh_waste_calendar() -> dict[str, Any]:
    """
    Re-ingests CSV and connector data, re-scores all events, calls Gemini
    for enrichment, and updates the waste_events table.
    """
    from backend.agents.base_agent import KARMAEvent
    start = time.time()
    event = KARMAEvent(
        event_id=f"refresh_{uuid.uuid4().hex[:8]}",
        event_type="refresh",
        source="csv",
        payload={},
        context={},
        timestamp=str(time.time()),
    )
    action = await state.orchestrator.dispatch(event)
    if not action:
        raise HTTPException(status_code=500, detail="Refresh failed — no action returned")

    return envelope(
        {
            "events_processed": action.payload.get("events_processed", 0),
            "total_preventable_inr": action.savings_inr,
            "message": "Waste calendar refreshed successfully",
        },
        agent="WasteCalendarAgent",
        latency_ms=round((time.time() - start) * 1000),
        confidence=action.confidence_score,
    )


@app.post("/api/waste-calendar/assign", tags=["Waste Calendar"])
async def assign_waste_event(req: AssignRequest) -> dict[str, Any]:
    """
    Assigns a waste event to a specific person/role and sets escalation timer.
    Marks the event status as 'assigned'.
    """
    from backend.agents.base_agent import KARMAEvent
    start = time.time()
    event = KARMAEvent(
        event_id=f"assign_{uuid.uuid4().hex[:8]}",
        event_type="assign",
        source="slack",
        payload={"event_id": req.event_id, "assigned_to": req.assigned_to},
        context={},
        timestamp=str(time.time()),
    )
    action = await state.orchestrator.dispatch(event)
    if not action:
        raise HTTPException(status_code=404, detail=f"Event {req.event_id} not found or assign failed")

    return envelope(
        {"event_id": req.event_id, "assigned_to": req.assigned_to, "status": "assigned"},
        agent="WasteCalendarAgent",
        latency_ms=round((time.time() - start) * 1000),
    )


@app.post("/api/waste-calendar/complete", tags=["Waste Calendar"])
async def complete_waste_event(req: CompleteRequest) -> dict[str, Any]:
    """
    Marks a waste event as handled.
    Triggers a +5 Karma Score credit for the team that completed it.
    """
    from backend.agents.base_agent import KARMAEvent
    start = time.time()
    event = KARMAEvent(
        event_id=f"complete_{uuid.uuid4().hex[:8]}",
        event_type="complete",
        source="slack",
        payload={"event_id": req.event_id, "team": req.team},
        context={},
        timestamp=str(time.time()),
    )
    action = await state.orchestrator.dispatch(event)
    if not action:
        raise HTTPException(status_code=404, detail=f"Event {req.event_id} not found or complete failed")

    return envelope(
        {
            "event_id": req.event_id,
            "status": "done",
            "karma_points_credited": action.payload.get("points_credited", 5),
            "message": "Event marked complete. Karma Score credited.",
        },
        agent="WasteCalendarAgent",
        latency_ms=round((time.time() - start) * 1000),
    )


# ---------------------------------------------------------------------------
# Ghost Approver routes  (Pillar 2 — STAR FEATURE)
# ---------------------------------------------------------------------------

@app.post("/api/ghost-approver/analyse", tags=["Ghost Approver"])
async def ghost_approver_analyse(req: AnalyseRequest) -> dict[str, Any]:
    """
    THE STAR FEATURE.
    Intercepts an approval request, enriches with utilisation + rate card + alt vendor data,
    calls Gemini for structured analysis, returns 2–3 options with INR savings.
    Target latency: <4 seconds. Cache hit: <100ms.
    """
    from backend.agents.base_agent import KARMAEvent
    start = time.time()

    event = KARMAEvent(
        event_id=f"ga_{uuid.uuid4().hex[:8]}",
        event_type="approval_request",
        source="slack",
        payload={
            "vendor":      req.vendor,
            "amount_inr":  req.amount_inr,
            "category":    req.category,
            "requester":   req.requester,
        },
        context={},
        timestamp=str(time.time()),
    )
    action = await state.orchestrator.dispatch(event)
    if not action:
        raise HTTPException(status_code=500, detail="Ghost Approver analysis failed")

    latency_ms = round((time.time() - start) * 1000)

    # --- Live alert ---
    asyncio.create_task(broadcast_alert(
        event_type="ghost_approver.analyse",
        agent="GhostApproverAgent",
        title=f"⚠️ Ghost Approver flagged {req.vendor} — ₹{action.savings_inr:,.0f} at risk",
        severity="warning",
        body={
            "vendor":       req.vendor,
            "amount_inr":   req.amount_inr,
            "category":     req.category,
            "requester":    req.requester,
            "max_savings":  action.savings_inr,
            "latency_ms":   latency_ms,
        },
    ))

    return envelope(
        {
            "analysis":           action.payload.get("analysis", {}),
            "slack_blocks":       action.payload.get("slack_blocks", []),
            "enrichment_summary": action.payload.get("enrichment", {}),
            "max_savings_inr":    action.savings_inr,
            "latency_ms":         latency_ms,
        },
        agent="GhostApproverAgent",
        latency_ms=latency_ms,
        confidence=action.confidence_score,
    )


@app.post("/api/ghost-approver/decide", tags=["Ghost Approver"])
async def ghost_approver_decide(req: DecideRequest) -> dict[str, Any]:
    """
    Logs the approval decision, routes to ExecutionAgent if actionable
    (approve_reduced or switch_vendor), and credits Karma Score.
    """
    from backend.agents.base_agent import KARMAEvent
    start = time.time()

    exec_payload = dict(req.execution_payload)
    exec_payload["original_amount_inr"] = req.original_amount_inr
    if req.recommended_seats:
        exec_payload["recommended_seats"] = req.recommended_seats

    event = KARMAEvent(
        event_id=f"dec_{uuid.uuid4().hex[:8]}",
        event_type="approval_decision",
        source="slack",
        payload={
            "vendor":                  req.vendor,
            "chosen_option_id":        req.chosen_option_id,
            "original_amount_inr":     req.original_amount_inr,
            "savings_inr":             req.savings_inr,
            "available_savings_inr":   req.available_savings_inr,
            "approver":                req.approver,
            "category":                req.category,
            "execution_payload":       exec_payload,
        },
        context={},
        timestamp=str(time.time()),
    )
    action = await state.orchestrator.dispatch(event)
    if not action:
        raise HTTPException(status_code=500, detail="Ghost Approver decision processing failed")

    receipt = {}
    if action.action_type == "trigger_execution":
        # Chain dispatch to ExecutionAgent
        exec_req = action.payload.get("execution_request", {})
        exec_event = KARMAEvent(
            event_id=f"req_{uuid.uuid4().hex[:8]}",
            event_type=exec_req.get("action_type"),
            source="ghost_approver",
            payload=exec_req,
            context={},
            timestamp=str(time.time()),
        )
        exec_action = await state.orchestrator.dispatch(exec_event)
        if exec_action and exec_action.payload:
            receipt = exec_action.payload.get("receipt", {})
            action.payload["status"] = exec_action.payload.get("status", "executed")
    else:
        receipt = action.payload.get("execution_receipt", {})

    latency_ms = round((time.time() - start) * 1000)

    # --- Live alert ---
    _dmap = {
        "approve_full":    ("✅", "Approved full amount",                              "info"),
        "approve_reduced": ("💰", f"Approved reduced — ₹{req.savings_inr:,.0f} saved", "success"),
        "switch_vendor":   ("🔄", f"Vendor switch — ₹{req.savings_inr:,.0f} saved",   "success"),
    }
    _ic, _lbl, _sev = _dmap.get(req.chosen_option_id, ("📋", "Decision logged", "info"))
    asyncio.create_task(broadcast_alert(
        event_type="ghost_approver.decide",
        agent="GhostApproverAgent",
        title=f"{_ic} {req.vendor}: {_lbl}",
        severity=_sev,
        body={
            "vendor":      req.vendor,
            "decision":    req.chosen_option_id,
            "savings_inr": req.savings_inr,
            "status":      action.payload.get("status", "logged"),
            "receipt_id":  receipt.get("receipt_id") if receipt else None,
        },
    ))

    return envelope(
        {
            "decision":         req.chosen_option_id,
            "vendor":           req.vendor,
            "savings_inr":      req.savings_inr,
            "status":           action.payload.get("status", "logged"),
            "execution_receipt": receipt,
            "receipt_id":       receipt.get("receipt_id") if receipt else None,
            "message":          (
                f"Decision logged. Receipt #{receipt.get('receipt_id', 'N/A')} — "
                f"₹{req.savings_inr:,.0f} saved."
                if req.chosen_option_id != "approve_full"
                else "Full approval logged."
            ),
        },
        agent="GhostApproverAgent",
        latency_ms=latency_ms,
        confidence=action.confidence_score,
    )


# ---------------------------------------------------------------------------
# Execution routes  (Phase 5)
# ---------------------------------------------------------------------------

class ExecuteRequest(BaseModel):
    action_type: str                   # resize_cloud_instance | reduce_saas_seats | switch_vendor | escalate_sla_risk
    approved_by: str = "system"
    vendor: Optional[str] = None
    # resize_cloud_instance fields
    instance_id:  Optional[str] = None
    current_type: Optional[str] = None
    target_type:  Optional[str] = None
    savings_inr:  float = 0.0
    # reduce_saas_seats fields
    from_seats:       Optional[int] = None
    to_seats:         Optional[int] = None
    annual_value_inr: Optional[float] = None
    # switch_vendor fields
    alternative_vendor: Optional[str] = None
    category:           Optional[str] = None
    # escalate_sla_risk fields
    current_uptime_pct:    Optional[float] = None
    sla_threshold_pct:     Optional[float] = None
    penalty_per_breach_inr: Optional[float] = None
    days_to_contract_end:  Optional[int] = None
    escalate_to:           Optional[str] = None


@app.post("/api/execution/run", tags=["Execution"])
async def run_execution(req: ExecuteRequest) -> dict[str, Any]:
    """
    Directly triggers an execution action (bypass Ghost Approver for manual/test use).
    In production flow: Ghost Approver → decide(approve_reduced) → this endpoint.
    """
    from backend.agents.base_agent import KARMAEvent
    start = time.time()

    payload = req.model_dump(exclude_none=True)

    event = KARMAEvent(
        event_id=f"ex_{uuid.uuid4().hex[:8]}",
        event_type=req.action_type,
        source="api",
        payload=payload,
        context={},
        timestamp=str(time.time()),
    )
    action = await state.orchestrator.dispatch(event)
    if not action:
        raise HTTPException(status_code=500, detail=f"Execution failed for action_type={req.action_type}")

    latency_ms = round((time.time() - start) * 1000)
    receipt = action.payload.get("receipt", {})

    return envelope(
        {
            "receipt":     receipt,
            "receipt_id":  action.payload.get("receipt_id", ""),
            "action_type": req.action_type,
            "savings_inr": action.savings_inr,
            "status":      action.payload.get("status", "completed"),
        },
        agent="ExecutionAgent",
        latency_ms=latency_ms,
        confidence=action.confidence_score,
    )


@app.get("/api/executions", tags=["Execution"])
async def get_executions(limit: int = 50) -> dict[str, Any]:
    """
    Returns the full execution log — all receipts, savings credited, approvers.
    Sorted by executed_at DESC.
    """
    start = time.time()
    rows = await state.db.get_executions(limit=limit)
    total_savings = sum(r.get("savings_inr", 0) for r in rows)

    return envelope(
        {
            "executions": rows,
            "count": len(rows),
            "total_savings_inr": total_savings,
            "summary": f"{len(rows)} executions logged, ₹{total_savings/100000:.1f}L saved",
        },
        agent="ExecutionAgent",
        latency_ms=round((time.time() - start) * 1000),
    )


# ---------------------------------------------------------------------------
# Decision DNA routes  (Phase 6)
# ---------------------------------------------------------------------------

class DecisionDNARequest(BaseModel):
    scenario_id:       Optional[str] = None   # use fixture scenario
    event_log:         Optional[list] = None  # or pass raw events
    total_overrun_inr: float = 0.0
    team:              str = "Procurement & Engineering"
    period:            str = "Q1 2026"


@app.post("/api/decision-dna/analyse", tags=["Decision DNA"])
async def decision_dna_analyse(req: DecisionDNARequest) -> dict[str, Any]:
    """
    Reconstructs the causal decision chain behind a cost overrun.
    Pass either a scenario_id (uses fixture event log) or a raw event_log array.
    Returns decision_chain, structural_gaps, and recommended KARMA rules.
    """
    from backend.agents.base_agent import KARMAEvent
    start = time.time()

    if not req.scenario_id and not req.event_log:
        raise HTTPException(
            status_code=400,
            detail="Must provide either 'scenario_id' (fixture) or 'event_log' (raw events)"
        )

    event = KARMAEvent(
        event_id=f"dna_{uuid.uuid4().hex[:8]}",
        event_type="analyse_decision",
        source="api",
        payload={
            "scenario_id":       req.scenario_id,
            "event_log":         req.event_log or [],
            "total_overrun_inr": req.total_overrun_inr,
            "team":              req.team,
            "period":            req.period,
        },
        context={},
        timestamp=str(time.time()),
    )
    action = await state.orchestrator.dispatch(event)
    if not action:
        raise HTTPException(status_code=500, detail="Decision DNA analysis failed")

    latency_ms = round((time.time() - start) * 1000)
    analysis   = action.payload.get("analysis", {})

    return envelope(
        {
            "analysis":         analysis,
            "scenario_id":      req.scenario_id,
            "events_analysed":  action.payload.get("events_analysed", 0),
            "preventable_inr":  action.savings_inr,
            "confidence":       analysis.get("confidence", 0),
        },
        agent="DecisionDNAAgent",
        latency_ms=latency_ms,
        confidence=action.confidence_score,
    )


@app.get("/api/decision-dna", tags=["Decision DNA"])
async def get_decision_dna() -> dict[str, Any]:
    """
    Convenience GET — returns pre-built decision DNA reconstructions from all fixture scenarios.
    Used by the frontend Decision DNA page to render the timeline without a POST payload.
    """
    import json
    from pathlib import Path
    from backend.agents.base_agent import KARMAEvent

    start = time.time()
    path = Path("backend/connectors/fixtures/event_logs.json")
    if not path.exists():
        # Return empty result-set gracefully
        return envelope({"results": [], "total_overrun_preventable_inr": 0}, agent="DecisionDNAAgent")

    with open(path, encoding="utf-8") as f:
        scenarios = json.load(f)

    results = []
    for s in scenarios:
        event = KARMAEvent(
            event_id=f"dna_get_{uuid.uuid4().hex[:8]}",
            event_type="analyse_decision",
            source="api",
            payload={
                "scenario_id": s["scenario_id"],
                "event_log": s.get("events", []),
                "total_overrun_inr": s.get("total_overrun_inr", 0),
                "team": s.get("team", "Engineering"),
                "period": s.get("period", "Q1 2026"),
            },
            context={},
            timestamp=str(time.time()),
        )
        action = await state.orchestrator.dispatch(event)
        if action:
            chain = action.payload.get("analysis", {}).get("decision_chain", [])
            results.extend(chain)

    total_inr = sum(r.get("money_leaked_inr", 0) for r in results)
    return envelope(
        {"results": results, "total_overrun_preventable_inr": total_inr},
        agent="DecisionDNAAgent",
        latency_ms=round((time.time() - start) * 1000),
    )


@app.get("/api/decision-dna/scenarios", tags=["Decision DNA"])
async def list_dna_scenarios() -> dict[str, Any]:
    """Returns the available fixture scenarios for Decision DNA analysis."""
    import json
    from pathlib import Path
    path = Path("backend/connectors/fixtures/event_logs.json")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Fixture not found")
    with open(path, encoding="utf-8") as f:
        scenarios = json.load(f)
    return envelope(
        [{"scenario_id": s["scenario_id"], "name": s["name"], "total_overrun_inr": s["total_overrun_inr"]} for s in scenarios],
        agent="DecisionDNAAgent",
    )


# ---------------------------------------------------------------------------
# SLA Monitor routes  (Phase 7)
# ---------------------------------------------------------------------------

@app.get("/api/sla-monitor", tags=["SLA Monitor"])
async def get_sla_risks() -> dict[str, Any]:
    """
    Returns all active SLA risks sorted by severity (CRITICAL first),
    then by penalty exposure descending.
    """
    start = time.time()
    agent = state.orchestrator.get_agent("sla_monitor")
    if not agent:
        raise HTTPException(status_code=503, detail="SLA Monitor agent not initialised")

    risks = agent.get_risk_cache()
    total_exposure = sum(r.get("penalty_exposure_inr", 0) for r in risks)
    critical = [r for r in risks if r.get("risk_level") == "CRITICAL"]
    high     = [r for r in risks if r.get("risk_level") == "HIGH"]

    return envelope(
        {
            "risks":                risks,
            "count":                len(risks),
            "critical_count":       len(critical),
            "high_count":           len(high),
            "total_exposure_inr":   total_exposure,
            "summary": (
                f"{len(critical)} CRITICAL, {len(high)} HIGH SLA risks. "
                f"Total penalty exposure: ₹{total_exposure/100000:.1f}L"
            ),
        },
        agent="SLAMonitorAgent",
        latency_ms=round((time.time() - start) * 1000),
    )


@app.post("/api/sla-monitor/refresh", tags=["SLA Monitor"])
async def refresh_sla_scan() -> dict[str, Any]:
    """
    Re-reads sla_contracts.csv, re-projects uptime, re-scores all risks.
    Injects new CRITICAL/HIGH events into Waste Calendar.
    """
    from backend.agents.base_agent import KARMAEvent
    start = time.time()

    event = KARMAEvent(
        event_id=f"sla_refresh_{uuid.uuid4().hex[:8]}",
        event_type="sla_scan",
        source="sla_monitor",
        payload={"manual_refresh": True},
        context={},
        timestamp=str(time.time()),
    )
    action = await state.orchestrator.dispatch(event)
    if not action:
        raise HTTPException(status_code=500, detail="SLA scan failed")

    # --- Live alert ---
    _p = action.payload
    _cc = _p.get("critical_count", 0)
    asyncio.create_task(broadcast_alert(
        event_type="sla_monitor.scan_complete",
        agent="SLAMonitorAgent",
        title=(
            f"🚨 SLA Scan: {_cc} CRITICAL — ₹{_p.get('total_exposure_inr', 0)/100000:.1f}L exposure"
        ),
        severity="critical" if _cc > 0 else "info",
        body={
            "total_contracts":    _p.get("total_contracts", 0),
            "critical_count":     _cc,
            "high_count":         _p.get("high_count", 0),
            "total_exposure_inr": _p.get("total_exposure_inr", 0),
        },
    ))

    return envelope(
        action.payload,
        agent="SLAMonitorAgent",
        latency_ms=round((time.time() - start) * 1000),
    )


# ---------------------------------------------------------------------------
# Karma Score routes  (Phase 8)
# ---------------------------------------------------------------------------

@app.get("/api/karma-scores", tags=["Karma Score"])
async def get_karma_scores() -> dict[str, Any]:
    """
    Returns all teams sorted by score (highest first).
    Includes delta, streak, and breakdown from latest score entry.
    """
    start  = time.time()
    scores = await state.db.get_all_team_scores()
    today  = str(__import__("datetime").date.today())

    leaderboard = []
    for i, row in enumerate(scores, 1):
        bd = row.get("breakdown_json", {})
        leaderboard.append({
            "rank":        i,
            "team_id":     row["team_id"],
            "team_name":   bd.get("team_name", row["team_id"].title()),
            "score":       round(row["score"], 1),
            "delta":       round(row.get("delta", 0), 1),
            "streak":      bd.get("streak", 0),
            "period_start": row.get("period_start"),
            "last_action": bd.get("last_action") or bd.get("reason", "—"),
        })

    return envelope(
        {
            "leaderboard": leaderboard,
            "total_teams": len(leaderboard),
            "top_team":    leaderboard[0]["team_name"] if leaderboard else None,
        },
        agent="KarmaScoreEngine",
        latency_ms=round((time.time() - start) * 1000),
    )


@app.get("/api/karma-scores/{team_id}", tags=["Karma Score"])
async def get_team_karma(team_id: str) -> dict[str, Any]:
    """
    Returns team detail with:
    - Current score and delta
    - Event-by-event score history
    - Breakdown from DB snapshot
    """
    start   = time.time()
    current = await state.db.get_karma_score_for_team(team_id)
    if not current:
        raise HTTPException(status_code=404, detail=f"Team '{team_id}' not found in karma_scores")

    history = await state.db.get_karma_score_history(team_id, limit=30)
    events  = await state.db.get_karma_events(team_id, limit=50)
    bd      = current.get("breakdown_json", {})

    return envelope(
        {
            "team_id":     team_id,
            "team_name":   bd.get("team_name", team_id.title()),
            "score":       round(current["score"], 1),
            "delta":       round(current.get("delta", 0), 1),
            "streak":      bd.get("streak", 0),
            "period_start": current.get("period_start"),
            "breakdown":   bd,
            "history":     history,
            "events":      events,
        },
        agent="KarmaScoreEngine",
        latency_ms=round((time.time() - start) * 1000),
    )


class KarmaScoreAdjustRequest(BaseModel):
    team_id:  str
    points:   float
    reason:   str
    meta:     Optional[dict] = None


@app.post("/api/karma-scores/credit", tags=["Karma Score"])
async def karma_credit(req: KarmaScoreAdjustRequest) -> dict[str, Any]:
    """Manually credits karma points to a team. Useful for testing and admin."""
    from backend.agents.base_agent import KARMAEvent
    start = time.time()

    event = KARMAEvent(
        event_id=f"kc_{uuid.uuid4().hex[:8]}",
        event_type="score_credit",
        source="api",
        payload={"team_id": req.team_id, "points": req.points, "reason": req.reason, "meta": req.meta or {}},
        context={},
        timestamp=str(time.time()),
    )
    action = await state.orchestrator.dispatch(event)
    if not action:
        raise HTTPException(status_code=500, detail="Score credit failed")

    return envelope(
        action.payload,
        agent="KarmaScoreEngine",
        latency_ms=round((time.time() - start) * 1000),
    )


@app.post("/api/karma-scores/debit", tags=["Karma Score"])
async def karma_debit(req: KarmaScoreAdjustRequest) -> dict[str, Any]:
    """Manually debits karma points from a team."""
    from backend.agents.base_agent import KARMAEvent
    start = time.time()

    event = KARMAEvent(
        event_id=f"kd_{uuid.uuid4().hex[:8]}",
        event_type="score_debit",
        source="api",
        payload={"team_id": req.team_id, "points": req.points, "reason": req.reason, "meta": req.meta or {}},
        context={},
        timestamp=str(time.time()),
    )
    action = await state.orchestrator.dispatch(event)
    if not action:
        raise HTTPException(status_code=500, detail="Score debit failed")

    return envelope(
        action.payload,
        agent="KarmaScoreEngine",
        latency_ms=round((time.time() - start) * 1000),
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["backend"],
    )
