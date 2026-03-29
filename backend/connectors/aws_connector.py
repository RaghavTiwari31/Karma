"""
aws_connector.py
Connector for AWS cost and infrastructure data via the KARMA mock server.
"""

from __future__ import annotations

from typing import Any

import httpx

from backend.connectors.base_connector import BaseConnector


class AWSConnector(BaseConnector):
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=10.0)

    async def get_utilization(self, vendor: str) -> dict[str, Any]:
        """For AWS, 'vendor' is ignored — returns full cost-explorer data."""
        r = await self._client.get(f"{self.base_url}/mock/aws/cost-explorer")
        r.raise_for_status()
        return r.json()["data"]

    async def get_rate_card(self, category: str) -> dict[str, Any]:
        """AWS doesn't use rate cards in the same way — returns empty dict."""
        return {}

    async def get_alternatives(self, category: str) -> list[dict[str, Any]]:
        """Returns rightsizing recommendations as 'alternatives'."""
        r = await self._client.get(f"{self.base_url}/mock/aws/cost-explorer")
        r.raise_for_status()
        return r.json()["data"].get("rightsizing_recommendations", [])

    async def execute(self, action: dict[str, Any]) -> dict[str, Any]:
        """Execute an AWS resize action."""
        r = await self._client.post(f"{self.base_url}/mock/aws/resize-instance", json=action)
        r.raise_for_status()
        return r.json()["data"]

    # ------------------------------------------------------------------
    # Extra
    # ------------------------------------------------------------------

    async def get_cost_explorer(self, days: int = 14) -> dict[str, Any]:
        r = await self._client.get(
            f"{self.base_url}/mock/aws/cost-explorer", params={"days": days}
        )
        r.raise_for_status()
        return r.json()["data"]
