"""
sla_monitor.py — SLAMonitorAgent (Phase 7)

Reads sla_contracts.csv on startup (and on /api/sla-monitor/refresh).
For each contract, projects uptime linearly over remaining contract days.
If breach risk detected, calls Gemini for analysis and injects a CRITICAL
event into the waste_events table so it surfaces in the Waste Calendar.

Breach risk levels:
  CRITICAL — already breaching OR projected within 30 days
  HIGH     — projected within 60 days
  MEDIUM   — below threshold but >60 days to breach
  LOW      — comfortably above threshold (skipped)
"""

from __future__ import annotations

import asyncio
import csv
import logging
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from backend.agents.base_agent import BaseAgent, KARMAAction, KARMAEvent
from backend.ai.prompts.sla_monitor_prompts import SLA_MONITOR_SYSTEM, build_sla_prompt

logger = logging.getLogger(__name__)

_SLA_CSV = Path(__file__).parent.parent / "connectors" / "fixtures" / "sla_contracts.csv"


class SLAMonitorAgent(BaseAgent):
    """
    Ingests SLA contract data, projects breach risk, and surfaces CRITICAL
    events into the Waste Calendar for immediate human action.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._risk_cache: list[dict] = []   # in-memory, refreshed on receive()

    # ------------------------------------------------------------------
    # BaseAgent interface
    # ------------------------------------------------------------------

    async def receive(self, event: KARMAEvent) -> Optional[KARMAAction]:
        if event.event_type in ("sla_scan", "refresh", "startup"):
            return await self._scan_all_contracts()
        logger.warning("SLAMonitorAgent: unknown event_type %s", event.event_type)
        return None

    # ------------------------------------------------------------------
    # Core: scan all contracts
    # ------------------------------------------------------------------

    async def _scan_all_contracts(self) -> KARMAAction:
        contracts = self._load_csv()
        results = []
        total_exposure = 0

        # Run analyses in parallel to avoid serial Gemini latencies
        tasks = [self._analyse_contract(contract) for contract in contracts]
        risk_results = await asyncio.gather(*tasks)

        for risk in risk_results:
            if risk:
                results.append(risk)
                total_exposure += risk.get("penalty_exposure_inr", 0)

                # Inject into Waste Calendar if HIGH or CRITICAL
                if risk["risk_level"] in ("CRITICAL", "HIGH"):
                    await self._inject_waste_event(risk)

        self._risk_cache = results
        critical_count = sum(1 for r in results if r["risk_level"] == "CRITICAL")
        high_count = sum(1 for r in results if r["risk_level"] == "HIGH")

        logger.info(
            "SLA scan complete: %d contracts | %d CRITICAL | %d HIGH | ₹%s exposure",
            len(contracts), critical_count, high_count, f"{total_exposure:,.0f}",
        )

        return KARMAAction(
            action_id=f"sla_{uuid.uuid4().hex[:8]}",
            action_type="sla_scan_complete",
            target="waste_calendar",
            payload={
                "risks": results,
                "total_contracts": len(contracts),
                "critical_count": critical_count,
                "high_count": high_count,
                "total_exposure_inr": total_exposure,
            },
            savings_inr=float(total_exposure),
            confidence_score=0.90,
            requires_approval=False,
        )

    # ------------------------------------------------------------------
    # Per-contract analysis
    # ------------------------------------------------------------------

    async def _analyse_contract(self, contract: dict) -> Optional[dict]:
        vendor            = contract.get("vendor", "Unknown")
        threshold         = float(contract.get("sla_threshold_pct", 99.5))
        current_uptime    = float(contract.get("current_uptime_pct", 99.9))
        penalty_per_breach = float(contract.get("penalty_per_breach_inr", 500000))
        contract_end_str  = contract.get("contract_end", "")

        # Days remaining
        try:
            contract_end  = date.fromisoformat(contract_end_str)
            days_remaining = (contract_end - date.today()).days
        except ValueError:
            logger.warning("Invalid contract_end for %s: %s", vendor, contract_end_str)
            return None

        if days_remaining <= 0:
            logger.info("Contract for %s already expired — skipping", vendor)
            return None

        # Linear uptime projection: assume current rate continues
        projected_uptime = self._project_uptime(current_uptime, threshold, days_remaining)

        # Quick risk classification (before Gemini)
        gap = threshold - current_uptime
        if gap <= 0 and projected_uptime >= threshold:
            # Already above — LOW risk, skip Gemini
            return {
                "vendor": vendor,
                "risk_level": "LOW",
                "current_uptime_pct": current_uptime,
                "threshold_pct": threshold,
                "gap_pct": gap,
                "projected_uptime_at_end": projected_uptime,
                "days_remaining": days_remaining,
                "penalty_exposure_inr": 0,
                "summary": f"{vendor} is comfortably above SLA threshold.",
                "category": contract.get("category", "General"),
                "escalate_to": contract.get("account_manager", "ops@acme.com"),
            }

        # Call Gemini for CRITICAL/HIGH/MEDIUM
        try:
            result = await self.ask_gemini(
                prompt=build_sla_prompt(contract, days_remaining, projected_uptime),
                system=SLA_MONITOR_SYSTEM,
            )
            if "risk_level" not in result:
                raise ValueError("Missing risk_level in Gemini response")
            result["days_remaining"] = days_remaining
            result["category"]       = contract.get("category", "General")
            return result
        except Exception as exc:
            logger.warning("Gemini unavailable for SLA %s: %s — using local analysis", vendor, exc)
            return self._fallback_risk(contract, days_remaining, projected_uptime)

    # ------------------------------------------------------------------
    # Uptime projection
    # ------------------------------------------------------------------

    @staticmethod
    def _project_uptime(
        current_uptime: float,
        threshold: float,
        days_remaining: int,
    ) -> float:
        """
        Simple linear projection: assume the current SLA deviation
        remains constant for the rest of the contract period.
        Returns projected average uptime at end of contract.
        """
        # If current < threshold, assume the shortfall widens at 0.001%/day
        if current_uptime < threshold:
            drift_rate = 0.001  # 0.001% per day degradation
            projected = current_uptime - (drift_rate * days_remaining)
            return max(0.0, round(projected, 4))
        # Above threshold — assume slight monthly improvement
        return round(min(100.0, current_uptime + 0.01), 4)

    # ------------------------------------------------------------------
    # Fallback risk classification
    # ------------------------------------------------------------------

    def _fallback_risk(
        self, contract: dict, days_remaining: int, projected_uptime: float
    ) -> dict:
        vendor         = contract.get("vendor", "Unknown")
        threshold      = float(contract.get("sla_threshold_pct", 99.5))
        current_uptime = float(contract.get("current_uptime_pct", 99.0))
        penalty        = float(contract.get("penalty_per_breach_inr", 500000))
        gap            = threshold - current_uptime

        breach_already = gap > 0
        # Estimate months of breach * penalty
        if breach_already:
            months_remaining  = max(1, round(days_remaining / 30))
            exposure          = int(months_remaining * penalty)
            days_to_breach    = -1
        else:
            exposure          = 0
            days_to_breach    = int(abs(gap) / 0.001) if gap < 0 else 999

        if breach_already:
            risk_level = "CRITICAL"
        elif projected_uptime < threshold and days_remaining <= 60:
            risk_level = "HIGH"
            exposure   = int(penalty * 0.5)
        elif current_uptime < threshold:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return {
            "vendor":                 vendor,
            "risk_level":             risk_level,
            "summary": (
                f"{vendor} at {current_uptime}% vs {threshold}% threshold — "
                f"{'CURRENTLY BREACHING' if breach_already else 'approaching breach'}. "
                f"Penalty exposure: ₹{exposure:,.0f}."
            ),
            "current_uptime_pct":     current_uptime,
            "threshold_pct":          threshold,
            "gap_pct":                round(gap, 4),
            "projected_uptime_at_end": projected_uptime,
            "days_to_potential_breach": days_to_breach,
            "penalty_exposure_inr":   exposure,
            "remediation_steps": [
                f"Schedule immediate performance review meeting with {vendor}",
                "Issue formal SLA improvement notice (triggers contract clock)",
                "Evaluate failover / alternative vendor options",
            ],
            "escalate_to":   contract.get("account_manager", "ops@acme.com"),
            "category":      contract.get("category", "General"),
            "days_remaining": days_remaining,
            "confidence":    72,
        }

    # ------------------------------------------------------------------
    # Inject into Waste Calendar
    # ------------------------------------------------------------------

    async def _inject_waste_event(self, risk: dict) -> None:
        vendor      = risk.get("vendor", "Unknown")
        exposure    = risk.get("penalty_exposure_inr", 0)
        risk_level  = risk.get("risk_level", "HIGH")
        days_remain = risk.get("days_remaining", 90)

        event_id = f"sla_{vendor.lower().replace(' ', '_')}_{uuid.uuid4().hex[:6]}"

        try:
            await self.db.upsert_waste_event({
                "id":                    event_id,
                "vendor":                vendor,
                "category":              risk.get("category", "SLA Risk"),
                "renewal_date":          str(date.today() + timedelta(days=days_remain)),
                "urgency_label":         f"SLA {risk_level} — {vendor}",
                "estimated_savings_inr": float(exposure),
                "assigned_to":           risk.get("escalate_to"),
                "status":                "open",
            })
            logger.info(
                "SLA risk '%s' injected into Waste Calendar: %s | ₹%s",
                vendor, risk_level, f"{exposure:,.0f}",
            )
        except Exception as e:
            logger.error("Failed to inject SLA event for %s: %s", vendor, e)

    # ------------------------------------------------------------------
    # CSV loader
    # ------------------------------------------------------------------

    @staticmethod
    def _load_csv() -> list[dict]:
        if not _SLA_CSV.exists():
            logger.warning("sla_contracts.csv not found at %s", _SLA_CSV)
            return []
        with open(_SLA_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            return [row for row in reader if row.get("vendor")]

    # ------------------------------------------------------------------
    # Public accessor (used by API route)
    # ------------------------------------------------------------------

    def get_risk_cache(self) -> list[dict]:
        return sorted(
            self._risk_cache,
            key=lambda r: {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}.get(
                r.get("risk_level", "LOW"), 4
            ),
        )
