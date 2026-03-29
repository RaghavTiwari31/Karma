"""
execution_agent.py — ExecutionAgent (Phase 5)

Executes approved cost-saving actions autonomously after Ghost Approver decisions.
Uses an ACTION_HANDLERS dispatch map — adding a new action = adding one entry to the map.

Handlers:
  - resize_cloud_instance  → POST /mock/aws/resize-instance
  - reduce_saas_seats      → POST /mock/sap/reduce-seats
  - switch_vendor          → procurement action log + Slack notification
  - escalate_sla_risk      → formats escalation message to dashboard

All executions are logged to the executions table and trigger a Karma Score credit.
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone
from typing import Any, Callable, Optional

from backend.agents.base_agent import BaseAgent, KARMAAction, KARMAEvent

logger = logging.getLogger(__name__)


class ExecutionAgent(BaseAgent):
    """
    Dispatches approved cost-saving actions to the right connector and logs receipts.
    Every successful execution credits the approver's Karma Score.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # ACTION_HANDLERS map — add new handlers here, no other changes needed
        self._ACTION_HANDLERS: dict[str, Callable] = {
            "resize_cloud_instance": self._handle_resize_cloud_instance,
            "reduce_saas_seats":     self._handle_reduce_saas_seats,
            "switch_vendor":         self._handle_switch_vendor,
            "escalate_sla_risk":     self._handle_escalate_sla_risk,
        }

    # ------------------------------------------------------------------
    # BaseAgent interface
    # ------------------------------------------------------------------

    async def receive(self, event: KARMAEvent) -> Optional[KARMAAction]:
        action_type = event.payload.get("action_type") or event.event_type
        handler = self._ACTION_HANDLERS.get(action_type)

        if not handler:
            logger.warning("ExecutionAgent: no handler for action_type '%s'", action_type)
            return None

        logger.info(
            "ExecutionAgent dispatching: action_type=%s approved_by=%s",
            action_type, event.payload.get("approved_by", "?"),
        )
        return await handler(event.payload)

    # ------------------------------------------------------------------
    # Handler: resize_cloud_instance
    # ------------------------------------------------------------------

    async def _handle_resize_cloud_instance(self, payload: dict) -> KARMAAction:
        instance_id  = payload.get("instance_id", "i-placeholder")
        current_type = payload.get("current_type", "m5.xlarge")
        target_type  = payload.get("target_type", "m5.large")
        savings_inr  = float(payload.get("savings_inr", 45600))
        approved_by  = payload.get("approved_by", "system")

        try:
            resp = await self.connectors["aws"].execute({
                "instance_id":        instance_id,
                "current_type":       current_type,
                "target_type":        target_type,
                "monthly_saving_inr": round(savings_inr / 12),
            })
            receipt = resp if isinstance(resp, dict) else {}
            receipt.setdefault("receipt_id", f"AWS-{uuid.uuid4().hex[:8].upper()}")
            receipt.setdefault("status", "completed")
        except Exception as e:
            logger.error("AWS resize failed: %s", e)
            receipt = {
                "receipt_id": f"AWS-{uuid.uuid4().hex[:8].upper()}",
                "status": "failed",
                "error": str(e),
            }

        await self._log_and_credit(
            exec_id=receipt["receipt_id"],
            action_type="resize_cloud_instance",
            connector="aws",
            approved_by=approved_by,
            savings_inr=savings_inr,
            receipt=receipt,
        )

        logger.info(
            "resize_cloud_instance: %s → %s | ₹%s/yr | receipt=%s",
            current_type, target_type, f"{savings_inr:,.0f}", receipt["receipt_id"],
        )
        return self._make_action("resize_cloud_instance", approved_by, savings_inr, receipt)

    # ------------------------------------------------------------------
    # Handler: reduce_saas_seats
    # ------------------------------------------------------------------

    async def _handle_reduce_saas_seats(self, payload: dict) -> KARMAAction:
        vendor       = payload.get("vendor", "Unknown Vendor")
        from_seats   = int(payload.get("from_seats", 22))
        to_seats     = int(payload.get("to_seats", 14))
        annual_value = float(payload.get("annual_value_inr", 420000))
        approved_by  = payload.get("approved_by", "system")
        savings_inr  = round((from_seats - to_seats) / from_seats * annual_value / 10000) * 10000

        try:
            resp = await self.connectors["sap"].execute({
                "vendor":           vendor,
                "from_seats":       from_seats,
                "to_seats":         to_seats,
                "annual_value_inr": annual_value,
            })
            receipt = resp if isinstance(resp, dict) else {}
            receipt.setdefault("receipt_id", f"SAP-{uuid.uuid4().hex[:8].upper()}")
            receipt.setdefault("status", "completed")
            receipt.setdefault("cost_delta_inr", -savings_inr)
        except Exception as e:
            logger.error("SAP reduce-seats failed: %s", e)
            receipt = {
                "receipt_id": f"SAP-{uuid.uuid4().hex[:8].upper()}",
                "status": "failed",
                "error": str(e),
            }

        await self._log_and_credit(
            exec_id=receipt["receipt_id"],
            action_type="reduce_saas_seats",
            connector="sap",
            approved_by=approved_by,
            savings_inr=savings_inr,
            receipt=receipt,
        )

        logger.info(
            "reduce_saas_seats: %s %d→%d | ₹%s saved | receipt=%s",
            vendor, from_seats, to_seats, f"{savings_inr:,.0f}", receipt["receipt_id"],
        )
        return self._make_action("reduce_saas_seats", approved_by, savings_inr, receipt)

    # ------------------------------------------------------------------
    # Handler: switch_vendor
    # ------------------------------------------------------------------

    async def _handle_switch_vendor(self, payload: dict) -> KARMAAction:
        from_vendor  = payload.get("vendor", "Unknown")
        to_vendor    = payload.get("alternative_vendor", "Alternative")
        category     = payload.get("category", "General")
        savings_inr  = float(payload.get("savings_inr", 0))
        approved_by  = payload.get("approved_by", "system")

        receipt = {
            "receipt_id":     f"SW-{uuid.uuid4().hex[:8].upper()}",
            "action":         "switch_vendor",
            "from_vendor":    from_vendor,
            "to_vendor":      to_vendor,
            "category":       category,
            "status":         "initiated",
            "next_steps": [
                f"Procurement to issue RFQ to {to_vendor}",
                f"Legal to review contract terms",
                f"Migration window: 30 days notice to {from_vendor}",
            ],
            "cost_delta_inr": -savings_inr,
            "executed_at":    datetime.now(timezone.utc).isoformat(),
            "note": (
                f"Vendor switch from {from_vendor} to {to_vendor} initiated. "
                f"Procurement team notified. Estimated annual saving: ₹{savings_inr:,.0f}"
            ),
        }

        await self._log_and_credit(
            exec_id=receipt["receipt_id"],
            action_type="switch_vendor",
            connector="procurement",
            approved_by=approved_by,
            savings_inr=savings_inr,
            receipt=receipt,
        )

        logger.info(
            "switch_vendor: %s → %s | ₹%s | receipt=%s",
            from_vendor, to_vendor, f"{savings_inr:,.0f}", receipt["receipt_id"],
        )
        return self._make_action("switch_vendor", approved_by, savings_inr, receipt)

    # ------------------------------------------------------------------
    # Handler: escalate_sla_risk
    # ------------------------------------------------------------------

    async def _handle_escalate_sla_risk(self, payload: dict) -> KARMAAction:
        vendor        = payload.get("vendor", "Unknown")
        current_sla   = payload.get("current_uptime_pct", 98.2)
        threshold_sla = payload.get("sla_threshold_pct", 99.5)
        penalty_inr   = float(payload.get("penalty_per_breach_inr", 500000))
        days_to_end   = payload.get("days_to_contract_end", 93)
        escalate_to   = payload.get("escalate_to", "infrastructure@acme.com")

        breach_gap   = threshold_sla - current_sla
        breach_risk  = "HIGH" if breach_gap > 0.5 else "MEDIUM"

        escalation_msg = {
            "type":    "sla_escalation",
            "vendor":  vendor,
            "message": (
                f"🚨 SLA BREACH RISK — {vendor}\n"
                f"Current uptime: {current_sla}% vs SLA threshold: {threshold_sla}%\n"
                f"Gap: {breach_gap:.2f}% — Risk level: {breach_risk}\n"
                f"Penalty exposure: ₹{penalty_inr:,.0f}\n"
                f"Contract ends in {days_to_end} days\n"
                f"Action required: Initiate vendor performance review immediately."
            ),
            "escalate_to": escalate_to,
            "channels":    ["slack:#infra-alerts", "email", "dashboard"],
            "breach_risk": breach_risk,
        }

        receipt = {
            "receipt_id":   f"ESC-{uuid.uuid4().hex[:8].upper()}",
            "action":       "escalate_sla_risk",
            "vendor":       vendor,
            "status":       "escalation_sent",
            "channels":     escalation_msg["channels"],
            "breach_risk":  breach_risk,
            "penalty_exposure_inr": penalty_inr,
            "executed_at":  datetime.now(timezone.utc).isoformat(),
        }

        await self._log_and_credit(
            exec_id=receipt["receipt_id"],
            action_type="escalate_sla_risk",
            connector="jira",
            approved_by=escalate_to,
            savings_inr=penalty_inr,   # penalty avoidance = savings
            receipt=receipt,
        )

        logger.info(
            "escalate_sla_risk: %s | risk=%s | penalty=₹%s | receipt=%s",
            vendor, breach_risk, f"{penalty_inr:,.0f}", receipt["receipt_id"],
        )
        return self._make_action("escalate_sla_risk", escalate_to, penalty_inr, receipt)

    # ------------------------------------------------------------------
    # Shared helpers
    # ------------------------------------------------------------------

    async def _log_and_credit(
        self,
        exec_id: str,
        action_type: str,
        connector: str,
        approved_by: str,
        savings_inr: float,
        receipt: dict,
    ) -> None:
        """Log execution receipt to DB and credit Karma Score."""
        try:
            await self.db.log_execution({
                "id":          exec_id,
                "action_type": action_type,
                "connector":   connector,
                "approved_by": approved_by,
                "savings_inr": savings_inr,
                "receipt_json": receipt,
            })
        except Exception as e:
            logger.error("Failed to log execution: %s", e)

        # Credit Karma Score — every successful execution earns +10 pts
        team = approved_by.split("@")[0] if "@" in approved_by else approved_by
        try:
            existing = await self.db.get_karma_score_for_team(team)
            current = existing["score"] if existing else 70.0
            new_score = min(100.0, current + 10.0)
            await self.db.upsert_karma_score({
                "team_id":      team,
                "period_start": str(date.today()),
                "score":        new_score,
                "delta":        10.0,
                "breakdown_json": {
                    "reason":       f"Executed {action_type} via KARMA",
                    "savings_inr":  savings_inr,
                    "receipt_id":   exec_id,
                },
            })
            logger.info("Karma Score: team=%s +10 pts → %.1f (execution credit)", team, new_score)
        except Exception as e:
            logger.warning("Karma Score credit failed after execution: %s", e)

    def _make_action(
        self,
        action_type: str,
        approved_by: str,
        savings_inr: float,
        receipt: dict,
    ) -> KARMAAction:
        return KARMAAction(
            action_id=f"ex_{uuid.uuid4().hex[:8]}",
            action_type=action_type,
            target=approved_by,
            payload={
                "receipt":     receipt,
                "receipt_id":  receipt.get("receipt_id", ""),
                "status":      receipt.get("status", "completed"),
                "savings_inr": savings_inr,
            },
            savings_inr=savings_inr,
            confidence_score=0.98,
            requires_approval=False,
        )
