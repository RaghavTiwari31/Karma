"""
waste_calendar.py — WasteCalendarAgent (Pillar 1)

Ingests contract/renewal data from CSV + connectors, scores every event
by urgency × waste_potential × actionability, then calls Gemini to enrich
each event with specific actions, savings estimates, and recommended owners.

Output is persisted to the waste_events table and served via:
  GET  /api/waste-calendar
  POST /api/waste-calendar/refresh
  POST /api/waste-calendar/assign
  POST /api/waste-calendar/complete
"""

from __future__ import annotations

import csv
import logging
import math
import os
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional

from backend.agents.base_agent import BaseAgent, KARMAAction, KARMAEvent

logger = logging.getLogger(__name__)

_FIXTURES_DIR = Path(__file__).parent.parent / "connectors" / "fixtures"
_CONTRACTS_CSV   = _FIXTURES_DIR / "contracts.csv"
_SLA_CSV         = _FIXTURES_DIR / "sla_contracts.csv"

# Role mapping by category
_ROLE_MAP = {
    "CRM":    "Procurement Manager",
    "Design": "IT Manager",
    "Comms":  "Procurement Manager",
    "Infra":  "Infrastructure Team",
    "SLA":    "Infrastructure Team",
    "Analytics": "Finance",
    "Security":  "CISO",
}


# ---------------------------------------------------------------------------
# Scoring algorithm (pure math — no LLM)
# ---------------------------------------------------------------------------

def score_event(event: dict, today: date) -> float:
    """
    Score = urgency_decay × waste_potential × actionability_multiplier

    urgency_decay    — exponential decay, peaks inside 30 days
    waste_potential  — INR value of unused licences/capacity
    actionability    — deprioritise events already past the intervention window
    """
    renewal_date = _parse_date(event.get("renewal_date") or event.get("contract_end", ""))
    if not renewal_date:
        return 0.0

    days_to_event = (renewal_date - today).days

    # Don't score already-expired events
    if days_to_event < 0:
        return 0.0

    # Urgency: exponential decay, t½ ≈ 30 days
    urgency = math.exp(-days_to_event / 30)

    # Waste potential in INR
    annual_value = float(event.get("annual_value_inr") or event.get("penalty_per_breach_inr", 0))
    util_pct = float(event.get("utilization_pct") or event.get("current_uptime_pct", 100))
    # For SLA events, waste = penalty × (1 - uptime/threshold)
    if event.get("event_type") == "sla_risk":
        threshold = float(event.get("sla_threshold_pct", 99.5))
        breach_probability = max(0.0, (threshold - util_pct) / threshold)
        waste_potential = breach_probability * annual_value * 10  # scale up so SLA ranks alongside contracts
    else:
        waste_potential = (1 - util_pct / 100) * annual_value

    # Actionability: plenty of time = full score; too close = deprioritise
    if days_to_event > 14:
        actionability = 1.0
    elif days_to_event > 7:
        actionability = 0.6
    else:
        actionability = 0.3  # still flag, but too late for full action

    return urgency * waste_potential * actionability


def _parse_date(d: str) -> Optional[date]:
    """Parse ISO date string to date object."""
    if not d:
        return None
    try:
        return date.fromisoformat(str(d).strip())
    except ValueError:
        return None


def _urgency_label(days: int) -> str:
    if days <= 21:
        return "CRITICAL"
    if days <= 45:
        return "HIGH"
    if days <= 75:
        return "MEDIUM"
    return "LOW"


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class WasteCalendarAgent(BaseAgent):
    """
    Ingests contracts + SLA data, scores events, calls Gemini for enrichment,
    and persists ranked events to waste_events table.
    """

    # ------------------------------------------------------------------
    # BaseAgent interface
    # ------------------------------------------------------------------

    async def receive(self, event: KARMAEvent) -> Optional[KARMAAction]:
        """
        Handles:
          - event_type == "refresh"  → re-ingest from CSV + connectors
          - event_type == "assign"   → assign owner to a waste event
          - event_type == "complete" → mark event done, credit karma score
        """
        if event.event_type == "refresh":
            return await self._handle_refresh()
        elif event.event_type == "assign":
            return await self._handle_assign(event.payload)
        elif event.event_type == "complete":
            return await self._handle_complete(event.payload)
        else:
            logger.warning("WasteCalendarAgent: unknown event_type %s", event.event_type)
            return None

    # ------------------------------------------------------------------
    # Refresh: full ingest + score + Gemini enrich + DB write
    # ------------------------------------------------------------------

    async def _handle_refresh(self) -> KARMAAction:
        today = date.today()
        raw_events = self._load_contracts_csv(today)
        raw_events += self._load_sla_csv(today)

        # Score and sort descending
        for ev in raw_events:
            ev["score"] = score_event(ev, today)
        ranked = sorted(raw_events, key=lambda x: x["score"], reverse=True)

        # Filter to only events in the next 90 days
        ranked_90 = [e for e in ranked if 0 <= ((_parse_date(e.get("renewal_date") or e.get("contract_end", ""))) - today).days <= 90]

        if not ranked_90:
            logger.warning("No events in the next 90 days — nothing to analyse.")
            return KARMAAction(
                action_id=f"act_{uuid.uuid4().hex[:8]}",
                action_type="score_update",
                target="waste_calendar",
                payload={"message": "No events in 90-day window"},
                savings_inr=0.0,
                confidence_score=1.0,
                requires_approval=False,
            )

        # Call Gemini for enrichment
        enriched = await self._enrich_with_gemini(ranked_90, today)

        # Persist to DB
        await self._persist_events(enriched, today)

        total_inr = sum(e.get("estimated_savings_inr", 0) for e in enriched)
        logger.info(
            "WasteCalendar refreshed: %d events, ₹%s total preventable",
            len(enriched), f"{total_inr:,.0f}"
        )

        return KARMAAction(
            action_id=f"act_{uuid.uuid4().hex[:8]}",
            action_type="score_update",
            target="waste_calendar",
            payload={
                "events_processed": len(enriched),
                "total_preventable_inr": total_inr,
            },
            savings_inr=total_inr,
            confidence_score=0.85,
            requires_approval=False,
        )

    # ------------------------------------------------------------------
    # Assign
    # ------------------------------------------------------------------

    async def _handle_assign(self, payload: dict) -> KARMAAction:
        event_id = payload.get("event_id")
        assigned_to = payload.get("assigned_to")
        await self.db.update_waste_event_status(event_id, "assigned")
        # Store assignee — patch the record
        await self.db._conn.execute(
            "UPDATE waste_events SET assigned_to = ? WHERE id = ?",
            (assigned_to, event_id),
        )
        await self.db._conn.commit()
        logger.info("Waste event %s assigned to %s", event_id, assigned_to)
        return KARMAAction(
            action_id=f"act_{uuid.uuid4().hex[:8]}",
            action_type="slack_message",
            target=assigned_to,
            payload={"message": f"Waste event {event_id} assigned to you"},
            requires_approval=False,
            confidence_score=1.0,
        )

    # ------------------------------------------------------------------
    # Complete
    # ------------------------------------------------------------------

    async def _handle_complete(self, payload: dict) -> KARMAAction:
        event_id = payload.get("event_id")
        await self.db.update_waste_event_status(event_id, "done")

        # Credit Karma Score for completing the calendar task on time (+5 pts)
        try:
            team = payload.get("team", "general")
            existing = await self.db.get_karma_score_for_team(team)
            current_score = existing["score"] if existing else 70.0
            new_score = min(100.0, current_score + 5.0)
            await self.db.upsert_karma_score({
                "team_id": team,
                "period_start": str(date.today()),
                "score": new_score,
                "delta": 5.0,
                "breakdown_json": {"reason": "Completed waste calendar task on time", "event_id": event_id},
            })
        except Exception as e:
            logger.warning("Failed to credit Karma Score: %s", e)

        return KARMAAction(
            action_id=f"act_{uuid.uuid4().hex[:8]}",
            action_type="score_update",
            target="karma_score",
            payload={"event_id": event_id, "points_credited": 5},
            requires_approval=False,
            confidence_score=1.0,
        )

    # ------------------------------------------------------------------
    # Data loading
    # ------------------------------------------------------------------

    def _load_contracts_csv(self, today: date) -> list[dict]:
        events = []
        if not _CONTRACTS_CSV.exists():
            logger.error("contracts.csv not found at %s", _CONTRACTS_CSV)
            return events
        with open(_CONTRACTS_CSV, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                renewal_date = _parse_date(row.get("renewal_date", ""))
                if not renewal_date:
                    continue
                days_to = (renewal_date - today).days
                events.append({
                    "event_id": f"evt_{row['vendor'].lower().replace(' ', '_')}",
                    "event_type": "renewal_due",
                    "vendor": row["vendor"],
                    "category": row.get("category", "General"),
                    "renewal_date": row["renewal_date"],
                    "annual_value_inr": float(row.get("annual_value_inr", 0)),
                    "utilization_pct": float(row.get("utilization_pct", 100)),
                    "last_renegotiated": row.get("last_renegotiated", ""),
                    "days_to_event": days_to,
                    "urgency_label": _urgency_label(days_to),
                })
        return events

    def _load_sla_csv(self, today: date) -> list[dict]:
        events = []
        if not _SLA_CSV.exists():
            logger.warning("sla_contracts.csv not found at %s", _SLA_CSV)
            return events
        with open(_SLA_CSV, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                contract_end = _parse_date(row.get("contract_end", ""))
                if not contract_end:
                    continue
                days_to = (contract_end - today).days
                events.append({
                    "event_id": f"evt_sla_{row['vendor'].lower().replace(' ', '_')}",
                    "event_type": "sla_risk",
                    "vendor": row["vendor"],
                    "category": "SLA",
                    "contract_end": row["contract_end"],
                    "renewal_date": row["contract_end"],   # alias for scoring
                    "sla_threshold_pct": float(row.get("sla_threshold_pct", 99.5)),
                    "current_uptime_pct": float(row.get("current_uptime_pct", 99.0)),
                    "penalty_per_breach_inr": float(row.get("penalty_per_breach_inr", 0)),
                    "annual_value_inr": float(row.get("penalty_per_breach_inr", 0)),
                    "utilization_pct": float(row.get("current_uptime_pct", 99.0)),
                    "days_to_event": days_to,
                    "urgency_label": _urgency_label(days_to),
                })
        return events

    # ------------------------------------------------------------------
    # Gemini enrichment
    # ------------------------------------------------------------------

    async def _enrich_with_gemini(self, ranked_events: list[dict], today: date) -> list[dict]:
        from backend.ai.prompts.waste_calendar_prompts import (
            WASTE_CALENDAR_SYSTEM,
            build_waste_calendar_prompt,
        )

        prompt = build_waste_calendar_prompt(
            ranked_events=ranked_events,
            today=str(today),
        )

        try:
            gemini_response = await self.ask_gemini(prompt=prompt, system=WASTE_CALENDAR_SYSTEM)
            enriched_events = gemini_response.get("events", [])
            # Merge Gemini enrichment back onto the scored events
            id_map = {e["event_id"]: e for e in ranked_events}
            merged = []
            for ge in enriched_events:
                base = id_map.get(ge.get("event_id"), {})
                merged.append({**base, **ge})
            return merged
        except Exception as exc:
            logger.error("Gemini enrichment failed: %s — falling back to scored-only events", exc)
            # Return scored events with estimated savings calculated locally
            return self._fallback_enrich(ranked_events, today)

    def _fallback_enrich(self, events: list[dict], today: date) -> list[dict]:
        """Conservative local enrichment if Gemini is unavailable."""
        result = []
        for ev in events:
            annual_value = ev.get("annual_value_inr", 0)
            util = ev.get("utilization_pct", 100)
            if ev.get("event_type") == "sla_risk":
                threshold = ev.get("sla_threshold_pct", 99.5)
                # Breach probability: how much margin is left vs how much has been consumed
                margin_remaining = threshold - util           # e.g. 99.5 - 98.2 = 1.3
                margin_total     = 100.0 - threshold         # e.g. 100 - 99.5 = 0.5
                # Probability of breaching = how far past the safe zone we already are
                breach_prob = min(1.0, max(0.0, (margin_total - margin_remaining) / margin_total + 0.5))
                penalty = ev.get("penalty_per_breach_inr", annual_value)
                savings = int(round(penalty * breach_prob * 0.9 / 10000) * 10000)
            else:
                unused_ratio = max(0, (100 - util) / 100)
                savings = int(round(annual_value * unused_ratio * 0.9 / 10000) * 10000)

            result.append({
                **ev,
                "estimated_savings_inr": savings,
                "confidence_pct": 70,
                "recommended_action": f"Review {ev['vendor']} utilisation and reduce unused capacity before renewal",
                "rationale": f"{ev['vendor']} at {util}% utilisation — action recommended before {ev.get('renewal_date', 'deadline')}",
                "assign_to_role": _ROLE_MAP.get(ev.get("category", ""), "Procurement Manager"),
                "escalation_if_no_action_days": 7,
            })
        return result

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    async def _persist_events(self, events: list[dict], today: date) -> None:
        for ev in events:
            db_record = {
                "id": ev.get("event_id", f"evt_{uuid.uuid4().hex[:8]}"),
                "vendor": ev.get("vendor", "Unknown"),
                "category": ev.get("category", "General"),
                "renewal_date": ev.get("renewal_date") or ev.get("contract_end", str(today)),
                "urgency_label": ev.get("urgency_label", "MEDIUM"),
                "estimated_savings_inr": ev.get("estimated_savings_inr", 0),
                "assigned_to": ev.get("assign_to_role", ""),
                "status": "open",
            }
            await self.db.upsert_waste_event(db_record)

    # ------------------------------------------------------------------
    # Public helper: get all events from DB (used by API routes)
    # ------------------------------------------------------------------

    async def get_calendar(self) -> dict[str, Any]:
        events = await self.db.get_waste_events(status="open")
        # Also fetch assigned
        assigned = await self.db.get_waste_events(status="assigned")
        all_events = events + assigned
        total = sum(e.get("estimated_savings_inr", 0) for e in all_events)
        count = len(all_events)
        return {
            "events": sorted(all_events, key=lambda x: x.get("estimated_savings_inr", 0), reverse=True),
            "total_preventable_inr": total,
            "summary": f"{count} events in calendar, ₹{total/100000:.1f}L preventable with prompt action",
        }
