"""
mock_server.py — KARMA Mock Enterprise Backend (port 8001)
Simulates SAP, AWS, Jira, and procurement data sources.
All fixture data is loaded from JSON files in ./fixtures/.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Path as FPath
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  mock_server  %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("karma.mock")

# ---------------------------------------------------------------------------
# Load fixtures on module import so endpoint functions have instant access
# ---------------------------------------------------------------------------

_FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _load(filename: str) -> dict | list:
    path = _FIXTURES_DIR / filename
    with open(path, encoding="utf-8") as f:
        return json.load(f)


SAP_DATA         = _load("sap_data.json")
AWS_DATA         = _load("aws_data.json")
PROCUREMENT_DATA = _load("procurement_data.json")
SLA_DATA         = _load("sla_data.json")

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

mock_app = FastAPI(
    title="KARMA Mock Enterprise Backend",
    description="Mock SAP / AWS / Jira / Procurement APIs for hackathon demo.",
    version="0.1.0",
)

mock_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _envelope(data: Any, latency_ms: int = 0) -> dict:
    return {
        "success": True,
        "data": data,
        "meta": {"mock": True, "latency_ms": latency_ms, "timestamp": time.time()},
        "error": None,
    }


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@mock_app.get("/health")
async def mock_health():
    return {"status": "ok", "service": "KARMA Mock Server"}


# ---------------------------------------------------------------------------
# SAP endpoints
# ---------------------------------------------------------------------------

@mock_app.get("/mock/sap/utilization/{vendor}")
async def sap_utilization(vendor: str = FPath(..., description="Vendor name")):
    vendors = SAP_DATA.get("vendors", {})
    normalized = {k.lower(): v for k, v in vendors.items()}
    data = normalized.get(vendor.lower())
    if not data:
        # Return a generic low-utilisation record rather than 404 so agents don't crash
        data = {
            "vendor": vendor,
            "utilization_pct": 60,
            "total_seats": 20,
            "active_seats": 12,
            "seats_unused_90_days": 8,
            "note": "No specific data — returning category average",
        }
    return _envelope(data)


@mock_app.get("/mock/sap/past-pos/{vendor}")
async def sap_past_pos(vendor: str, limit: int = 5):
    pos = SAP_DATA.get("past_purchase_orders", [])
    vendor_pos = [p for p in pos if p["vendor"].lower() == vendor.lower()][:limit]
    return _envelope(vendor_pos)


# ---------------------------------------------------------------------------
# Procurement endpoints
# ---------------------------------------------------------------------------

@mock_app.get("/mock/procurement/rate-card/{category}")
async def procurement_rate_card(category: str):
    cards = PROCUREMENT_DATA.get("rate_cards", {})
    normalized = {k.lower(): v for k, v in cards.items()}
    card = normalized.get(category.lower())
    if not card:
        raise HTTPException(status_code=404, detail=f"No rate card for category: {category}")
    return _envelope(card)


@mock_app.get("/mock/procurement/alternatives/{category}")
async def procurement_alternatives(category: str):
    alts = PROCUREMENT_DATA.get("alternative_vendors", {})
    normalized = {k.lower(): v for k, v in alts.items()}
    vendors = normalized.get(category.lower(), [])
    return _envelope(vendors)


# ---------------------------------------------------------------------------
# AWS endpoints
# ---------------------------------------------------------------------------

@mock_app.get("/mock/aws/cost-explorer")
async def aws_cost_explorer(days: int = 14):
    spend = AWS_DATA.get("daily_spend_by_service", [])
    ris   = AWS_DATA.get("reserved_instances", [])
    anomalies = AWS_DATA.get("cost_anomalies", [])
    rightsizing = AWS_DATA.get("rightsizing_recommendations", [])
    return _envelope({
        "daily_spend": spend[:days * 5],  # rough slice
        "reserved_instances": ris,
        "anomalies": anomalies,
        "rightsizing_recommendations": rightsizing,
    })


@mock_app.post("/mock/aws/resize-instance")
async def aws_resize_instance(body: dict):
    instance_id   = body.get("instance_id", "i-unknown")
    current_type  = body.get("current_type", "m5.xlarge")
    target_type   = body.get("target_type", "m5.large")
    monthly_saving = body.get("monthly_saving_inr", 3800)

    receipt = {
        "receipt_id": f"AWS-{uuid.uuid4().hex[:8].upper()}",
        "instance_id": instance_id,
        "action": "resize",
        "from_type": current_type,
        "to_type": target_type,
        "status": "completed",
        "cost_delta_inr": -(monthly_saving * 12),
        "effective_immediately": True,
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "note": f"Instance resized from {current_type} to {target_type}. Annual saving: ₹{monthly_saving * 12:,}",
    }
    logger.info("EXEC aws/resize-instance: %s → %s | saving ₹%s/mo", current_type, target_type, monthly_saving)
    return _envelope(receipt)


# ---------------------------------------------------------------------------
# SAP reduce-seats (execution)
# ---------------------------------------------------------------------------

@mock_app.post("/mock/sap/reduce-seats")
async def sap_reduce_seats(body: dict):
    vendor       = body.get("vendor", "Unknown")
    from_seats   = body.get("from_seats", 22)
    to_seats     = body.get("to_seats", 14)
    annual_value = body.get("annual_value_inr", 420000)
    seats_removed = from_seats - to_seats
    saving_inr = round((seats_removed / from_seats) * annual_value)

    receipt = {
        "receipt_id": f"SAP-{uuid.uuid4().hex[:8].upper()}",
        "vendor": vendor,
        "action": "reduce_seats",
        "from_seats": from_seats,
        "to_seats": to_seats,
        "seats_removed": seats_removed,
        "cost_delta_inr": -saving_inr,
        "status": "completed",
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "note": f"Reduced {vendor} from {from_seats} to {to_seats} seats. Annual saving: ₹{saving_inr:,}",
    }
    logger.info("EXEC sap/reduce-seats: %s %s→%s | saving ₹%s", vendor, from_seats, to_seats, saving_inr)
    return _envelope(receipt)


# ---------------------------------------------------------------------------
# Jira / SLA endpoints
# ---------------------------------------------------------------------------

@mock_app.get("/mock/jira/sla-metrics")
async def jira_sla_metrics():
    return _envelope(SLA_DATA)


@mock_app.get("/mock/jira/tickets")
async def jira_tickets():
    return _envelope(SLA_DATA.get("jira_tickets", []))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.connectors.mock_server:mock_app", host="0.0.0.0", port=8001, reload=True)
