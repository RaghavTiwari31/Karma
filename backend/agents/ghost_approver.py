"""
ghost_approver.py — GhostApproverAgent (Pillar 2 — STAR FEATURE)

Intercepts approval requests, enriches with utilisation + rate card + alt vendor data,
calls Gemini for analysis, returns structured Slack Block Kit JSON with 3 action options.

Flow:
  POST /api/ghost-approver/analyse  → enrichment + Gemini → options JSON
  POST /api/ghost-approver/decide   → logs decision → ExecutionAgent if actionable

Timeline target: <4 seconds end-to-end for demo.
Cache hit (same vendor+amount): <100ms.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import date, datetime, timezone
from typing import Any, Optional

from backend.agents.base_agent import BaseAgent, KARMAAction, KARMAEvent

logger = logging.getLogger(__name__)


class GhostApproverAgent(BaseAgent):
    """
    The Ghost Approver intercepts approval requests BEFORE money is committed.
    Returns 2–3 structured options with savings, confidence, and Slack blocks.
    """

    # ------------------------------------------------------------------
    # BaseAgent interface
    # ------------------------------------------------------------------

    async def receive(self, event: KARMAEvent) -> Optional[KARMAAction]:
        if event.event_type == "approval_request":
            return await self._handle_analyse(event.payload)
        elif event.event_type == "approval_decision":
            return await self._handle_decide(event.payload)
        else:
            logger.warning("GhostApproverAgent: unknown event_type %s", event.event_type)
            return None

    # ------------------------------------------------------------------
    # Analyse: full enrichment + Gemini pipeline
    # ------------------------------------------------------------------

    async def _handle_analyse(self, payload: dict) -> KARMAAction:
        t_start = time.time()

        vendor    = payload.get("vendor", "Unknown Vendor")
        amount    = float(payload.get("amount_inr", 0))
        category  = payload.get("category", "General")
        requester = payload.get("requester", "Unknown")

        # --- Enrichment pipeline (parallel would be ideal; serial for clarity) ---
        try:
            utilization = await self.connectors["sap"].get_utilization(vendor)
        except Exception as e:
            logger.warning("SAP utilization fetch failed for %s: %s", vendor, e)
            utilization = {}

        try:
            rate_card = await self.connectors["sap"].get_rate_card(category)
        except Exception as e:
            logger.warning("Rate card fetch failed for %s: %s", category, e)
            rate_card = {}

        try:
            alt_vendors = await self.connectors["sap"].get_alternatives(category)
        except Exception as e:
            logger.warning("Alternatives fetch failed for %s: %s", category, e)
            alt_vendors = []

        try:
            past_pos = await self.connectors["sap"].get_past_pos(vendor, limit=5)
        except Exception:
            past_pos = []

        # --- Gemini call ---
        analysis = await self._call_gemini(vendor, amount, category, requester,
                                           utilization, rate_card, alt_vendors, past_pos)

        # --- Build Slack blocks ---
        slack_blocks = self._build_slack_blocks(analysis, vendor, amount)

        latency_ms = round((time.time() - t_start) * 1000)
        logger.info(
            "GhostApprover analysed %s ₹%s | max_savings=₹%s | confidence=%s | latency=%sms",
            vendor, f"{amount:,.0f}",
            f"{analysis.get('max_savings_inr', 0):,.0f}",
            analysis.get("confidence", "?"),
            latency_ms,
        )

        # Log to decision trail
        await self._log_to_decision_trail(
            vendor=vendor, amount=amount, category=category,
            requester=requester, analysis=analysis, fired=True,
        )

        return KARMAAction(
            action_id=f"ga_{uuid.uuid4().hex[:8]}",
            action_type="slack_message",
            target=requester,
            payload={
                "analysis": analysis,
                "slack_blocks": slack_blocks,
                "latency_ms": latency_ms,
                "enrichment": {
                    "utilization": utilization,
                    "rate_card": rate_card,
                    "alt_vendors": alt_vendors[:1],
                    "past_pos_count": len(past_pos),
                },
            },
            savings_inr=float(analysis.get("max_savings_inr", 0)),
            confidence_score=float(analysis.get("confidence", 70)) / 100,
            requires_approval=True,
        )

    # ------------------------------------------------------------------
    # Decide: log decision, route to Execution if approved-reduced/switch
    # ------------------------------------------------------------------

    async def _handle_decide(self, payload: dict) -> KARMAAction:
        chosen_option  = payload.get("chosen_option_id", "approve_full")
        vendor         = payload.get("vendor", "Unknown")
        amount         = float(payload.get("original_amount_inr", 0))
        savings_inr    = float(payload.get("savings_inr", 0))
        approver       = payload.get("approver", "Unknown")
        category       = payload.get("category", "General")
        execution_payload = payload.get("execution_payload", {})

        # Log to decision trail
        log_entry = {
            "id": f"dec_{uuid.uuid4().hex[:8]}",
            "event_type": "approval_decision",
            "actor": approver,
            "action": f"ghost_approver:{chosen_option}",
            "context_available": ["utilization", "rate_card", "alt_vendors"],
            "context_missing": [],
            "cost_impact_inr": -savings_inr if savings_inr > 0 else amount,
            "ghost_approver_fired": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        try:
            await self.db.log_decision(log_entry)
        except Exception as e:
            logger.warning("Decision log write failed: %s", e)

        # Karma score impact
        await self._credit_karma_score(chosen_option, savings_inr, vendor, approver)

        # If actionable (not approve_full), return execution payload so main.py can dispatch to ExecutionAgent
        if chosen_option in ("approve_reduced", "switch_vendor"):
            # Construct payload corresponding to ExecutionAgent schema
            if chosen_option == "approve_reduced":
                payload = {
                    "action_type": "reduce_saas_seats",
                    "vendor": vendor,
                    "from_seats": execution_payload.get("total_seats", 22),
                    "to_seats": execution_payload.get("recommended_seats") or execution_payload.get("active_seats", 14),
                    "annual_value_inr": amount,
                    "approved_by": approver,
                    "savings_inr": savings_inr,
                }
            else:
                payload = {
                    "action_type": "switch_vendor",
                    "vendor": vendor,
                    "alternative_vendor": execution_payload.get("alternative_vendor", "Alternative"),
                    "category": category,
                    "approved_by": approver,
                    "savings_inr": savings_inr,
                }

            return KARMAAction(
                action_id=f"ga_dec_{uuid.uuid4().hex[:8]}",
                action_type="trigger_execution",
                target="execution_agent",
                payload={"execution_request": payload, "decision": chosen_option},
                savings_inr=savings_inr,
                confidence_score=0.95,
                requires_approval=False,
            )
        else:
            # approve_full — note loss of savings opportunity
            return KARMAAction(
                action_id=f"ga_dec_{uuid.uuid4().hex[:8]}",
                action_type="score_update",
                target="karma_score",
                payload={
                    "decision": "approve_full",
                    "vendor": vendor,
                    "note": "Approved at full amount despite Ghost Approver flags",
                    "savings_opportunity_missed_inr": payload.get("available_savings_inr", 0),
                },
                savings_inr=0,
                confidence_score=1.0,
                requires_approval=False,
            )

    # ------------------------------------------------------------------
    # Gemini call
    # ------------------------------------------------------------------

    async def _call_gemini(
        self,
        vendor: str, amount: float, category: str, requester: str,
        utilization: dict, rate_card: dict, alt_vendors: list, past_pos: list,
    ) -> dict:
        from backend.ai.prompts.ghost_approver_prompts import (
            GHOST_APPROVER_SYSTEM,
            build_ghost_prompt,
        )

        prompt = build_ghost_prompt(
            vendor=vendor, amount=amount, category=category, requester=requester,
            utilization=utilization, rate_card=rate_card,
            alt_vendors=alt_vendors, past_pos=past_pos,
        )

        try:
            result = await self.ask_gemini(prompt=prompt, system=GHOST_APPROVER_SYSTEM)
            # Validate required fields
            if "options" not in result:
                raise ValueError("Gemini response missing 'options' array")
            return result
        except Exception as exc:
            logger.error("Ghost Approver Gemini call failed: %s — using fallback", exc)
            return self._fallback_analysis(vendor, amount, category, utilization, alt_vendors)

    # ------------------------------------------------------------------
    # Fallback analysis (when Gemini unavailable)
    # ------------------------------------------------------------------

    def _fallback_analysis(
        self, vendor: str, amount: float, category: str,
        utilization: dict, alt_vendors: list,
    ) -> dict:
        util_pct = utilization.get("utilization_pct", 100)
        total    = utilization.get("total_seats") or 1
        active   = utilization.get("active_seats") or total
        unused   = utilization.get("seats_unused_90_days", 0) or (total - active)

        # Reduced option: trim to active seats + 10% buffer
        recommended_seats = max(1, int(active * 1.1))
        reduced_amount = round(amount * recommended_seats / total / 10000) * 10000 if total else amount
        savings_reduced = max(0, int((amount - reduced_amount) / 10000) * 10000)

        options = [
            {
                "option_id": "approve_full",
                "label": f"Approve Full — ₹{amount:,.0f}",
                "action_type": "approve_full",
                "savings_inr": 0,
                "rationale": "Approve at current terms. No changes to existing setup.",
                "recommended": False,
            },
        ]

        if savings_reduced > 0:
            options.append({
                "option_id": "approve_reduced",
                "label": f"✅ Approve Reduced — {recommended_seats} seats (saves ₹{savings_reduced:,})",
                "action_type": "approve_reduced",
                "savings_inr": savings_reduced,
                "recommended_seats_or_size": str(recommended_seats),
                "rationale": f"{unused} seats unused for 90+ days. Reduce to {recommended_seats} seats to match actual usage.",
                "recommended": True,
            })

        if alt_vendors:
            alt = alt_vendors[0]
            alt_savings = int(amount * alt.get("savings_vs_current_pct", 20) / 100 / 10000) * 10000
            options.append({
                "option_id": "switch_vendor",
                "label": f"🔄 Switch to {alt['vendor']} (saves ₹{alt_savings:,})",
                "action_type": "switch_vendor",
                "savings_inr": alt_savings,
                "alternative_vendor": alt["vendor"],
                "rationale": f"{alt['vendor']} offers {alt.get('feature_parity_pct', 80)}% feature parity at lower cost.",
                "data_note": "benchmark comparison",
                "recommended": False,
            })

        max_savings = max(o.get("savings_inr", 0) for o in options)
        urgency = "⚠️ REVIEW SUGGESTED" if util_pct < 70 else "✅ LOOKS REASONABLE"

        return {
            "urgency_tag": urgency,
            "header_insight": f"{vendor} at {util_pct}% utilisation — {unused} seats idle.",
            "options": options,
            "max_savings_inr": max_savings,
            "confidence": 65,
            "confidence_rationale": "Fallback analysis — Gemini unavailable, using local algorithms.",
            "execution_payload": {
                "vendor": vendor,
                "category": category,
                "original_amount_inr": amount,
                "total_seats": total,
                "active_seats": active,
            },
        }

    # ------------------------------------------------------------------
    # Slack Block Kit builder
    # ------------------------------------------------------------------

    def _build_slack_blocks(self, analysis: dict, vendor: str, amount: float) -> list:
        urgency_tag    = analysis.get("urgency_tag", "⚠️ REVIEW SUGGESTED")
        header_insight = analysis.get("header_insight", f"Review {vendor} approval of ₹{amount:,.0f}.")
        options        = analysis.get("options", [])
        confidence     = analysis.get("confidence", 70)

        # Header block
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"👻 KARMA Ghost Approver  {urgency_tag}",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        f"*Before you approve ₹{amount:,.0f} for {vendor}—*\n"
                        f"{header_insight}\n\n"
                        f"_Confidence: {confidence}/100 · Analysis powered by KARMA_"
                    ),
                },
            },
            {"type": "divider"},
        ]

        # Option blocks
        for opt in options:
            label       = opt.get("label", "Option")
            rationale   = opt.get("rationale", "")
            action_type = opt.get("action_type", "approve_full")
            savings     = opt.get("savings_inr", 0)
            data_note   = opt.get("data_note", "")
            recommended = opt.get("recommended", False)

            # Build section text
            section_text = f"*{label}*\n{rationale}"
            if data_note:
                section_text += f"\n_📊 {data_note}_"
            if savings > 0:
                section_text += f"\n💰 *Savings: ₹{savings:,}*"

            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": section_text},
            })

        # Action buttons block
        buttons = []
        for opt in options:
            action_id   = opt.get("option_id", "approve_full")
            label       = opt.get("label", "Option")
            action_type = opt.get("action_type", "approve_full")
            recommended = opt.get("recommended", False)

            # Truncate label to 75 chars (Slack limit)
            btn_text = label[:75]

            button: dict[str, Any] = {
                "type": "button",
                "text": {"type": "plain_text", "text": btn_text, "emoji": True},
                "action_id": action_id,
                "value": action_id,
            }
            if action_type == "approve_full":
                button["style"] = "danger"
            elif recommended:
                button["style"] = "primary"

            buttons.append(button)

        blocks.append({"type": "actions", "elements": buttons})

        # Context footer
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": (
                        f"KARMA Ghost Approver · {date.today()} · "
                        f"₹{analysis.get('max_savings_inr', 0):,} max savings available"
                    ),
                }
            ],
        })

        return blocks

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _log_to_decision_trail(
        self, vendor: str, amount: float, category: str,
        requester: str, analysis: dict, fired: bool,
    ) -> None:
        try:
            await self.db.log_decision({
                "id": f"ga_{uuid.uuid4().hex[:8]}",
                "event_type": "approval_request",
                "actor": requester,
                "action": f"purchase_request:{vendor}",
                "context_available": ["utilization", "rate_card", "alt_vendors"],
                "context_missing": [],
                "cost_impact_inr": amount,
                "ghost_approver_fired": fired,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as e:
            logger.warning("Could not log to decision trail: %s", e)

    async def _credit_karma_score(
        self, chosen_option: str, savings_inr: float,
        vendor: str, approver: str,
    ) -> None:
        """Update Karma Score based on the decision quality."""
        SCORE_MAP = {
            "approve_reduced": +8,
            "switch_vendor":   +10,
            "approve_full":    -12,   # approved off-contract / ignored Ghost Approver flags
        }
        delta = SCORE_MAP.get(chosen_option, 0)
        if delta == 0:
            return

        team = approver.split("@")[0] if "@" in approver else "procurement"
        try:
            existing = await self.db.get_karma_score_for_team(team)
            current  = existing["score"] if existing else 70.0
            new_score = max(0.0, min(100.0, current + delta))
            await self.db.upsert_karma_score({
                "team_id": team,
                "period_start": str(date.today()),
                "score": new_score,
                "delta": float(delta),
                "breakdown_json": {
                    "reason": f"Ghost Approver decision: {chosen_option}",
                    "vendor": vendor,
                    "savings_inr": savings_inr,
                },
            })
            logger.info("Karma Score: team=%s %+d pts → %.1f", team, delta, new_score)
        except Exception as e:
            logger.warning("Karma Score credit failed: %s", e)
