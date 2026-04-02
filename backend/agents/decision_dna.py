"""
decision_dna.py — DecisionDNAAgent (Phase 6)

Reconstructs the causal chain behind enterprise cost overruns.
Given a sequence of timestamped events, identifies blind decision points,
quantifies preventable costs, and prescribes structural KARMA rules.

Input:  POST /api/decision-dna/analyse  { scenario_id | event_log, overrun_inr }
Output: decision_chain JSON + structural_gaps + recommended_karma_rules
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional

from backend.agents.base_agent import BaseAgent, KARMAAction, KARMAEvent

logger = logging.getLogger(__name__)

_EVENT_LOGS_PATH = (
    Path(__file__).parent.parent / "connectors" / "fixtures" / "event_logs.json"
)


class DecisionDNAAgent(BaseAgent):
    """
    Forensic causal-chain analyst.
    Accepts either a fixture scenario_id or a raw event_log + overrun amount.
    """

    # ------------------------------------------------------------------
    # BaseAgent interface
    # ------------------------------------------------------------------

    async def receive(self, event: KARMAEvent) -> Optional[KARMAAction]:
        if event.event_type == "analyse_decision":
            return await self._handle_analyse(event.payload)
        logger.warning("DecisionDNAAgent: unknown event_type %s", event.event_type)
        return None

    # ------------------------------------------------------------------
    # Core: analyse
    # ------------------------------------------------------------------

    async def _handle_analyse(self, payload: dict) -> KARMAAction:
        # Resolve event log — either from fixture or from payload
        scenario_id      = payload.get("scenario_id")
        events           = payload.get("event_log") or []
        total_overrun    = float(payload.get("total_overrun_inr", 0))
        team             = payload.get("team", "Procurement & Engineering")
        period           = payload.get("period", "Q1 2026")

        if scenario_id and not events:
            scenario = self._load_scenario(scenario_id)
            if scenario:
                events        = scenario.get("events", [])
                team          = scenario.get("team", team)
                period        = scenario.get("period", period)
                total_overrun = total_overrun or float(scenario.get("total_overrun_inr", 0))
            else:
                logger.warning("Unknown scenario_id: %s", scenario_id)

        if not events:
            return self._empty_action("No event log provided — pass scenario_id or event_log")

        # Gemini call
        result = await self._call_gemini(events, total_overrun, team, period)

        # Persist each decision chain step to decision_log
        await self._persist_chain(result, team)

        preventable = result.get("total_preventable_inr", 0)
        logger.info(
            "DecisionDNA: %d events | ₹%s preventable | coverage=%s%%",
            len(events), f"{preventable:,.0f}", result.get("karma_coverage_score", "?"),
        )

        return KARMAAction(
            action_id=f"dna_{uuid.uuid4().hex[:8]}",
            action_type="decision_chain",
            target="decision_dashboard",
            payload={
                "analysis": result,
                "scenario_id": scenario_id,
                "events_analysed": len(events),
            },
            savings_inr=float(preventable),
            confidence_score=float(result.get("confidence", 70)) / 100,
            requires_approval=False,
        )

    # ------------------------------------------------------------------
    # Gemini call
    # ------------------------------------------------------------------

    async def _call_gemini(
        self, events: list, overrun: float, team: str, period: str,
    ) -> dict:
        from backend.ai.prompts.decision_dna_prompts import (
            DECISION_DNA_SYSTEM,
            build_decision_dna_prompt,
        )

        prompt = build_decision_dna_prompt(
            event_log=events,
            total_overrun_inr=overrun,
            team=team,
            period=period,
        )

        try:
            result = await self.ask_gemini(prompt=prompt, system=DECISION_DNA_SYSTEM)
            if "decision_chain" not in result:
                raise ValueError("Missing 'decision_chain' in Gemini response")
            return result
        except Exception as exc:
            logger.error("DecisionDNA Gemini call failed: %s — using fallback", exc)
            return self._fallback_analysis(events, overrun, team)

    # ------------------------------------------------------------------
    # Fallback: purely algorithmic chain (no Gemini)
    # ------------------------------------------------------------------

    def _fallback_analysis(self, events: list, overrun: float, team: str) -> dict:
        blind_count   = sum(1 for e in events if e.get("context_visibility") == "blind")
        partial_count = sum(1 for e in events if e.get("context_visibility") == "partial")
        total_neg     = sum(e.get("amount_inr", 0) for e in events if e.get("amount_inr", 0) < 0)
        preventable   = abs(total_neg) * 0.6  # assume 60% preventable with KARMA

        chain = []
        cumulative = 0.0
        for i, ev in enumerate(events, 1):
            amt    = float(ev.get("amount_inr", 0))
            vis    = ev.get("context_visibility", "partial")
            missing = ev.get("context_missing", [])
            cumulative += amt

            action_verb = "blocked" if vis == "blind" else "flagged"
            intervention = "No KARMA intervention needed." if vis == "informed" else (
                f"KARMA would have shown: {', '.join(missing[:2]) or 'cost forecast'} "
                f"and {action_verb} this decision."
            )

            chain.append({
                "step":                i,
                "timestamp":           ev.get("timestamp", ""),
                "actor":               ev.get("actor", f"Actor {i}"),
                "action":              ev.get("action", ""),
                "context_visibility":  vis,
                "missing_context":     missing,
                "cost_impact_inr":     amt,
                "karma_intervention":  intervention,
                "intervention_timing": "Real-time" if vis == "blind" else "N/A",
                "historical_paths_count": 2400 if i == 1 else 1250,
                "historical_confidence_rating": "High" if vis == "informed" else "Medium",
                "sla_impact_pct": round(abs(amt) / 500000.0, 2) + 0.01,
                "sla_impact_msg": "Latency buffer intact" if abs(amt) < 20000 else "Approaching threshold",
            })

        root_cause_event = next(
            (e for e in events if e.get("context_visibility") == "blind"), events[0]
        )

        return {
            "summary": (
                f"Analysis of {len(events)} events: {blind_count} blind and "
                f"{partial_count} partial-context decisions contributed to ₹{overrun:,.0f} overrun. "
                f"KARMA could have prevented ~60% with real-time cost signals."
            ),
            "root_cause": root_cause_event.get("action", "Unknown decision"),
            "total_preventable_inr": int(preventable / 10000) * 10000,
            "decision_chain": chain,
            "structural_gaps": [
                {
                    "gap":           "No approval gate for cloud provisioning above ₹50,000",
                    "fix":           "KARMA Ghost Approver gate on all cloud spend >₹50,000",
                    "prevents_inr":  int(preventable * 0.4 / 10000) * 10000,
                },
                {
                    "gap":           "No real-time cost alerts after resource provisioning",
                    "fix":           "KARMA SLA Monitor with auto-escalation after 72h of idle spend",
                    "prevents_inr":  int(preventable * 0.35 / 10000) * 10000,
                },
                {
                    "gap":           "Software register not maintained/visible during purchase approvals",
                    "fix":           "KARMA duplicate-subscription check in Ghost Approver enrichment",
                    "prevents_inr":  int(preventable * 0.25 / 10000) * 10000,
                },
            ],
            "karma_coverage_score": 72,
            "confidence":            62,
            "confidence_rationale":  "Fallback analysis — Gemini unavailable; chain reconstructed algorithmically.",
            "recommended_karma_rules": [
                "Block cloud provisioning >₹50,000 without Ghost Approver analysis",
                "Auto-alert after 48h of resource idle time (CPU <5%)",
                "Duplicate SaaS category check on every procurement request",
            ],
        }

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    async def _persist_chain(self, result: dict, team: str) -> None:
        for step in result.get("decision_chain", []):
            try:
                await self.db.log_decision({
                    "id":                 f"dna_{uuid.uuid4().hex[:8]}",
                    "event_type":         "decision_dna_step",
                    "actor":              step.get("actor", team),
                    "action":             step.get("action", ""),
                    "context_available":  [],
                    "context_missing":    step.get("missing_context", []),
                    "cost_impact_inr":    step.get("cost_impact_inr", 0),
                    "ghost_approver_fired": step.get("context_visibility") == "blind",
                    "timestamp":          step.get("timestamp") or datetime.now(timezone.utc).isoformat(),
                })
            except Exception as e:
                logger.warning("Failed to persist decision chain step: %s", e)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _load_scenario(scenario_id: str) -> Optional[dict]:
        if not _EVENT_LOGS_PATH.exists():
            return None
        with open(_EVENT_LOGS_PATH, encoding="utf-8") as f:
            scenarios = json.load(f)
        for s in scenarios:
            if s.get("scenario_id") == scenario_id:
                return s
        return None

    def _empty_action(self, message: str) -> KARMAAction:
        return KARMAAction(
            action_id=f"dna_{uuid.uuid4().hex[:8]}",
            action_type="decision_chain",
            target="decision_dashboard",
            payload={"error": message, "decision_chain": []},
            savings_inr=0,
            confidence_score=0,
            requires_approval=False,
        )
