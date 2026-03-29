"""
base_agent.py
Core data models and abstract base class shared by all KARMA agents.

KARMAEvent  — inbound event from any source (Slack, SAP, AWS, CSV)
KARMAAction — outbound action emitted by an agent
BaseAgent   — abstract interface every agent must implement
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared Pydantic models
# ---------------------------------------------------------------------------

class KARMAEvent(BaseModel):
    """Inbound event passed to agents via the Orchestrator."""
    event_id: str
    event_type: str          # "approval_request" | "spend_alert" | "sla_risk" | "renewal_due"
    source: str              # "slack" | "aws" | "sap" | "jira" | "csv"
    payload: Dict[str, Any]
    context: Dict[str, Any] = Field(default_factory=dict)   # enrichment data from connectors
    timestamp: str


class KARMAAction(BaseModel):
    """Outbound action produced by an agent."""
    action_id: str
    action_type: str         # "slack_message" | "api_call" | "escalation" | "score_update"
    target: str              # destination: team_id, Slack channel, connector name, etc.
    payload: Dict[str, Any] = Field(default_factory=dict)
    savings_inr: Optional[float] = None
    confidence_score: float = Field(ge=0.0, le=1.0, default=0.0)
    requires_approval: bool = True


# ---------------------------------------------------------------------------
# Abstract base agent
# ---------------------------------------------------------------------------

class BaseAgent(ABC):
    """
    Every KARMA agent inherits from this class.

    Contract:
      • receive(event) is the only public method agents expose.
      • Agents NEVER call each other directly — routing is the Orchestrator's job.
      • ask_gemini() is the single path to the Gemini API; never call the client directly.
    """

    def __init__(self, gemini_client, connector_registry: dict, db):
        self.gemini = gemini_client
        self.connectors = connector_registry
        self.db = db

    @abstractmethod
    async def receive(self, event: KARMAEvent) -> Optional[KARMAAction]:
        """
        Process an incoming KARMAEvent and return a KARMAAction, or None
        if no action is warranted.
        """

    async def ask_gemini(self, prompt: str, system: str) -> dict[str, Any]:
        """
        Convenience wrapper so agents don't have to know about retries/caching.
        Delegates everything to GeminiClient.generate_json().
        """
        return await self.gemini.generate_json(prompt=prompt, system_instruction=system)
