"""
jira_connector.py
Connector for Jira Service Management and SLA metric data via the mock server.
"""

from __future__ import annotations

from typing import Any

import httpx

from backend.connectors.base_connector import BaseConnector


class JiraConnector(BaseConnector):
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=10.0)

    async def get_utilization(self, vendor: str) -> dict[str, Any]:
        """Returns SLA metrics for the given vendor contract."""
        r = await self._client.get(f"{self.base_url}/mock/jira/sla-metrics")
        r.raise_for_status()
        all_slas = r.json()["data"].get("sla_contracts", [])
        match = next(
            (s for s in all_slas if s["vendor"].lower() == vendor.lower()),
            None,
        )
        return match or {}

    async def get_rate_card(self, category: str) -> dict[str, Any]:
        """Not applicable for Jira — returns empty."""
        return {}

    async def get_alternatives(self, category: str) -> list[dict[str, Any]]:
        """Not applicable for Jira — returns empty."""
        return []

    async def execute(self, action: dict[str, Any]) -> dict[str, Any]:
        """Jira actions (escalation tickets) are fire-and-forget for demo."""
        return {
            "status": "ticket_created",
            "ticket_id": f"OPS-{action.get('ref', 'KARMA')}",
            "note": "Escalation ticket created in Jira SM",
        }

    # ------------------------------------------------------------------
    # Extra
    # ------------------------------------------------------------------

    async def get_sla_metrics(self) -> dict[str, Any]:
        r = await self._client.get(f"{self.base_url}/mock/jira/sla-metrics")
        r.raise_for_status()
        return r.json()["data"]

    async def get_tickets(self) -> list[dict[str, Any]]:
        r = await self._client.get(f"{self.base_url}/mock/jira/tickets")
        r.raise_for_status()
        return r.json()["data"]
