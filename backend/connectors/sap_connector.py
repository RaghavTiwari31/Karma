"""
sap_connector.py
Connector for SAP (and procurement) data via the KARMA mock server.
Also serves as the procurement connector — both route to the same mock.
"""

from __future__ import annotations

from typing import Any

import httpx

from backend.connectors.base_connector import BaseConnector


class SAPConnector(BaseConnector):
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=10.0)

    # ------------------------------------------------------------------
    # BaseConnector interface
    # ------------------------------------------------------------------

    async def get_utilization(self, vendor: str) -> dict[str, Any]:
        r = await self._client.get(f"{self.base_url}/mock/sap/utilization/{vendor}")
        r.raise_for_status()
        return r.json()["data"]

    async def get_rate_card(self, category: str) -> dict[str, Any]:
        r = await self._client.get(f"{self.base_url}/mock/procurement/rate-card/{category}")
        r.raise_for_status()
        return r.json()["data"]

    async def get_alternatives(self, category: str) -> list[dict[str, Any]]:
        r = await self._client.get(f"{self.base_url}/mock/procurement/alternatives/{category}")
        r.raise_for_status()
        return r.json()["data"]

    async def execute(self, action: dict[str, Any]) -> dict[str, Any]:
        r = await self._client.post(f"{self.base_url}/mock/sap/reduce-seats", json=action)
        r.raise_for_status()
        return r.json()["data"]

    # ------------------------------------------------------------------
    # Extra methods (not on BaseConnector but used by agents)
    # ------------------------------------------------------------------

    async def get_past_pos(self, vendor: str, limit: int = 5) -> list[dict[str, Any]]:
        r = await self._client.get(
            f"{self.base_url}/mock/sap/past-pos/{vendor}", params={"limit": limit}
        )
        r.raise_for_status()
        return r.json()["data"]
