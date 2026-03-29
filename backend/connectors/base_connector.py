"""
base_connector.py
Abstract adapter interface that every data-source connector must implement.

At demo time all connectors point to the mock server on port 8001.
Post-hackathon: swap MockSAPConnector → RealSAPConnector in connector_registry.py.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseConnector(ABC):
    """Standard interface for all enterprise data-source adapters."""

    @abstractmethod
    async def get_utilization(self, vendor: str) -> dict[str, Any]:
        """Return licence/resource utilisation data for the given vendor."""

    @abstractmethod
    async def get_rate_card(self, category: str) -> dict[str, Any]:
        """Return benchmark pricing for the given spend category."""

    @abstractmethod
    async def get_alternatives(self, category: str) -> list[dict[str, Any]]:
        """Return a list of alternative vendors for the given spend category."""

    @abstractmethod
    async def execute(self, action: dict[str, Any]) -> dict[str, Any]:
        """Execute an approved action and return a receipt."""
