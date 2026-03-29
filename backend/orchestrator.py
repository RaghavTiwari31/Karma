"""
orchestrator.py — KARMA Agent Router & Coordinator

The orchestrator is the ONLY place where events are dispatched to agents.
Agents never call each other directly — all routing goes through here.

Usage:
    orchestrator = Orchestrator(gemini, connectors, db)
    action = await orchestrator.dispatch(event)
"""

from __future__ import annotations

import logging
from typing import Optional

from backend.agents.base_agent import KARMAAction, KARMAEvent

logger = logging.getLogger(__name__)


class Orchestrator:
    def __init__(self, gemini_client, connector_registry: dict, db):
        self.gemini = gemini_client
        self.connectors = connector_registry
        self.db = db
        self._agents: dict = {}
        self._build_agents()

    def _build_agents(self) -> None:
        """Instantiate all agents and register them by their event domain."""
        from backend.agents.waste_calendar import WasteCalendarAgent
        from backend.agents.ghost_approver import GhostApproverAgent
        from backend.agents.execution_agent import ExecutionAgent
        from backend.agents.decision_dna import DecisionDNAAgent
        from backend.agents.sla_monitor import SLAMonitorAgent
        from backend.agents.karma_score import KarmaScoreEngine

        self._agents["waste_calendar"] = WasteCalendarAgent(
            gemini_client=self.gemini,
            connector_registry=self.connectors,
            db=self.db,
        )
        self._agents["ghost_approver"] = GhostApproverAgent(
            gemini_client=self.gemini,
            connector_registry=self.connectors,
            db=self.db,
        )
        self._agents["execution"] = ExecutionAgent(
            gemini_client=self.gemini,
            connector_registry=self.connectors,
            db=self.db,
        )
        self._agents["decision_dna"] = DecisionDNAAgent(
            gemini_client=self.gemini,
            connector_registry=self.connectors,
            db=self.db,
        )
        self._agents["sla_monitor"] = SLAMonitorAgent(
            gemini_client=self.gemini,
            connector_registry=self.connectors,
            db=self.db,
        )
        self._agents["karma_score"] = KarmaScoreEngine(
            gemini_client=self.gemini,
            connector_registry=self.connectors,
            db=self.db,
        )

        logger.info("Orchestrator: registered agents: %s", list(self._agents.keys()))

    async def dispatch(self, event: KARMAEvent) -> Optional[KARMAAction]:
        """
        Route an event to the appropriate agent.
        Returns the action produced, or None if no agent handled it.
        """
        agent_key = self._resolve_agent(event)
        agent = self._agents.get(agent_key)

        if not agent:
            logger.warning("No agent registered for source=%s type=%s", event.source, event.event_type)
            return None

        logger.info(
            "Dispatching event_id=%s (type=%s) → %s",
            event.event_id, event.event_type, agent_key,
        )
        try:
            action = await agent.receive(event)
            if action:
                logger.info(
                    "Agent %s produced action_type=%s savings=₹%s",
                    agent_key,
                    action.action_type,
                    f"{action.savings_inr:,.0f}" if action.savings_inr else "n/a",
                )
            return action
        except Exception as exc:
            logger.error("Agent %s raised exception: %s", agent_key, exc, exc_info=True)
            return None

    def get_agent(self, key: str):
        """Direct agent access — used by API routes for read operations."""
        return self._agents.get(key)

    def _resolve_agent(self, event: KARMAEvent) -> str:
        """Map event → agent key. Extend as new agents are added."""
        if event.source in ("csv", "sap", "jira", "slack") and event.event_type in (
            "renewal_due", "refresh", "assign", "complete"
        ):
            return "waste_calendar"
        # Ghost Approver (Phase 4)
        if event.event_type in ("approval_request", "approval_decision"):
            return "ghost_approver"
        # Execution Agent (Phase 5)
        if event.event_type in (
            "execute", "resize_cloud_instance", "reduce_saas_seats",
            "switch_vendor", "escalate_sla_risk",
        ):
            return "execution"
        # Decision DNA (Phase 6)
        if event.event_type in ("analyse_decision", "spend_alert"):
            return "decision_dna"
        # SLA Monitor (Phase 7)
        if event.event_type in ("sla_scan", "startup") and event.source == "sla_monitor":
            return "sla_monitor"
        if event.event_type == "sla_risk":
            return "sla_monitor"
        # Karma Score Engine (Phase 8)
        if event.event_type in ("score_credit", "score_debit", "score_decay", "seed_scores"):
            return "karma_score"
        # Fallback
        return event.source

