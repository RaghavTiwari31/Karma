"""
connector_registry.py
Builds and returns the central dictionary of connector instances
used by all agents. Swap mock connectors → real ones here post-hackathon.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_MOCK_BASE_URL = "http://localhost:8001"


async def build_registry() -> dict:
    from backend.connectors.sap_connector import SAPConnector
    from backend.connectors.aws_connector import AWSConnector
    from backend.connectors.jira_connector import JiraConnector

    registry = {
        "sap":           SAPConnector(base_url=_MOCK_BASE_URL),
        "aws":           AWSConnector(base_url=_MOCK_BASE_URL),
        "jira":          JiraConnector(base_url=_MOCK_BASE_URL),
        "procurement":   SAPConnector(base_url=_MOCK_BASE_URL),  # procurement data via SAP mock
    }
    logger.info("Connector registry built: %s", list(registry.keys()))
    return registry
