"""
database.py
SQLite persistence layer for KARMA (swappable to PostgreSQL post-hackathon).

On startup, call: await Database.initialize()
Inject the singleton instance into agents via the connector registry.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

import aiosqlite

logger = logging.getLogger(__name__)

_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "karma.db")

_DDL_WASTE_EVENTS = """
CREATE TABLE IF NOT EXISTS waste_events (
    id              TEXT PRIMARY KEY,
    vendor          TEXT,
    category        TEXT,
    renewal_date    DATE,
    urgency_label   TEXT,
    estimated_savings_inr REAL,
    assigned_to     TEXT,
    status          TEXT DEFAULT 'open',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

_DDL_DECISION_LOG = """
CREATE TABLE IF NOT EXISTS decision_log (
    id                  TEXT PRIMARY KEY,
    event_type          TEXT,
    actor               TEXT,
    action              TEXT,
    context_available   TEXT,   -- JSON array
    context_missing     TEXT,   -- JSON array
    cost_impact_inr     REAL,
    ghost_approver_fired BOOLEAN,
    timestamp           TIMESTAMP
);
"""

_DDL_EXECUTIONS = """
CREATE TABLE IF NOT EXISTS executions (
    id           TEXT PRIMARY KEY,
    action_type  TEXT,
    connector    TEXT,
    approved_by  TEXT,
    savings_inr  REAL,
    receipt_json TEXT,
    executed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

_DDL_KARMA_SCORES = """
CREATE TABLE IF NOT EXISTS karma_scores (
    team_id        TEXT,
    period_start   DATE,
    score          REAL,
    delta          REAL,
    breakdown_json TEXT,
    PRIMARY KEY (team_id, period_start)
);
"""

_DDL_RESPONSE_CACHE = """
CREATE TABLE IF NOT EXISTS response_cache (
    cache_key  TEXT PRIMARY KEY,
    response   TEXT,   -- JSON string
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

_DDL_KARMA_SCORE_EVENTS = """
CREATE TABLE IF NOT EXISTS karma_score_events (
    id          TEXT PRIMARY KEY,
    team_id     TEXT,
    delta       REAL,
    reason      TEXT,
    meta_json   TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

_DDL_SLA_RISKS = """
CREATE TABLE IF NOT EXISTS sla_risks (
    id              TEXT PRIMARY KEY,
    vendor          TEXT,
    risk_level      TEXT,
    gap_pct         REAL,
    penalty_exposure_inr REAL,
    days_remaining  INTEGER,
    summary         TEXT,
    last_scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


class Database:
    def __init__(self, db_path: str = _DB_PATH):
        self.db_path = db_path
        self._conn: Optional[aiosqlite.Connection] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        self._conn = await aiosqlite.connect(self.db_path)
        self._conn.row_factory = aiosqlite.Row
        await self._run_ddl()
        logger.info(f"SQLite database initialised at {self.db_path}")

    async def close(self) -> None:
        if self._conn:
            await self._conn.close()
            logger.info("SQLite connection closed.")

    async def _run_ddl(self) -> None:
        for ddl in [
            _DDL_WASTE_EVENTS,
            _DDL_DECISION_LOG,
            _DDL_EXECUTIONS,
            _DDL_KARMA_SCORES,
            _DDL_RESPONSE_CACHE,
            _DDL_KARMA_SCORE_EVENTS,
            _DDL_SLA_RISKS,
        ]:
            await self._conn.execute(ddl)
        await self._conn.commit()

    # ------------------------------------------------------------------
    # Response cache (used by GeminiClient)
    # ------------------------------------------------------------------

    async def get_cached_response(self, cache_key: str) -> Optional[dict]:
        async with self._conn.execute(
            "SELECT response FROM response_cache WHERE cache_key = ?", (cache_key,)
        ) as cursor:
            row = await cursor.fetchone()
            return json.loads(row["response"]) if row else None

    async def set_cached_response(self, cache_key: str, response: dict) -> None:
        await self._conn.execute(
            "INSERT OR REPLACE INTO response_cache (cache_key, response) VALUES (?, ?)",
            (cache_key, json.dumps(response)),
        )
        await self._conn.commit()

    # ------------------------------------------------------------------
    # Waste events
    # ------------------------------------------------------------------

    async def upsert_waste_event(self, event: dict[str, Any]) -> None:
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO waste_events
              (id, vendor, category, renewal_date, urgency_label,
               estimated_savings_inr, assigned_to, status)
            VALUES (:id, :vendor, :category, :renewal_date, :urgency_label,
                    :estimated_savings_inr, :assigned_to, :status)
            """,
            event,
        )
        await self._conn.commit()

    async def get_waste_events(self, status: str = "open") -> list[dict]:
        async with self._conn.execute(
            "SELECT * FROM waste_events WHERE status = ? ORDER BY estimated_savings_inr DESC",
            (status,),
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def update_waste_event_status(self, event_id: str, status: str) -> None:
        await self._conn.execute(
            "UPDATE waste_events SET status = ? WHERE id = ?", (status, event_id)
        )
        await self._conn.commit()

    # ------------------------------------------------------------------
    # Decision log
    # ------------------------------------------------------------------

    async def log_decision(self, entry: dict[str, Any]) -> None:
        entry = dict(entry)
        entry["context_available"] = json.dumps(entry.get("context_available", []))
        entry["context_missing"] = json.dumps(entry.get("context_missing", []))
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO decision_log
              (id, event_type, actor, action, context_available, context_missing,
               cost_impact_inr, ghost_approver_fired, timestamp)
            VALUES (:id, :event_type, :actor, :action, :context_available, :context_missing,
                    :cost_impact_inr, :ghost_approver_fired, :timestamp)
            """,
            entry,
        )
        await self._conn.commit()

    async def get_decision_log(self, limit: int = 50) -> list[dict]:
        async with self._conn.execute(
            "SELECT * FROM decision_log ORDER BY timestamp DESC LIMIT ?", (limit,)
        ) as cursor:
            rows = await cursor.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["context_available"] = json.loads(d["context_available"] or "[]")
                d["context_missing"] = json.loads(d["context_missing"] or "[]")
                result.append(d)
            return result

    # ------------------------------------------------------------------
    # Executions
    # ------------------------------------------------------------------

    async def log_execution(self, entry: dict[str, Any]) -> None:
        entry = dict(entry)
        entry["receipt_json"] = json.dumps(entry.get("receipt_json", {}))
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO executions
              (id, action_type, connector, approved_by, savings_inr, receipt_json)
            VALUES (:id, :action_type, :connector, :approved_by, :savings_inr, :receipt_json)
            """,
            entry,
        )
        await self._conn.commit()

    async def get_executions(self, limit: int = 50) -> list[dict]:
        async with self._conn.execute(
            "SELECT * FROM executions ORDER BY executed_at DESC LIMIT ?", (limit,)
        ) as cursor:
            rows = await cursor.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["receipt_json"] = json.loads(d["receipt_json"] or "{}")
                result.append(d)
            return result

    # ------------------------------------------------------------------
    # Karma scores
    # ------------------------------------------------------------------

    async def upsert_karma_score(self, entry: dict[str, Any]) -> None:
        entry = dict(entry)
        entry["breakdown_json"] = json.dumps(entry.get("breakdown_json", {}))
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO karma_scores
              (team_id, period_start, score, delta, breakdown_json)
            VALUES (:team_id, :period_start, :score, :delta, :breakdown_json)
            """,
            entry,
        )
        await self._conn.commit()

    async def get_karma_scores(self) -> list[dict]:
        async with self._conn.execute(
            "SELECT * FROM karma_scores ORDER BY score DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["breakdown_json"] = json.loads(d["breakdown_json"] or "{}")
                result.append(d)
            return result

    async def get_karma_score_for_team(self, team_id: str) -> Optional[dict]:
        async with self._conn.execute(
            "SELECT * FROM karma_scores WHERE team_id = ? ORDER BY period_start DESC LIMIT 1",
            (team_id,),
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                return None
            d = dict(row)
            d["breakdown_json"] = json.loads(d["breakdown_json"] or "{}")
            return d

    async def get_all_team_scores(self) -> list[dict]:
        """Latest score per team, sorted by score descending."""
        async with self._conn.execute(
            """
            SELECT k1.*
            FROM karma_scores k1
            INNER JOIN (
                SELECT team_id, MAX(period_start) AS max_period
                FROM karma_scores
                GROUP BY team_id
            ) k2 ON k1.team_id = k2.team_id AND k1.period_start = k2.max_period
            ORDER BY k1.score DESC
            """
        ) as cursor:
            rows = await cursor.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["breakdown_json"] = json.loads(d["breakdown_json"] or "{}")
                result.append(d)
            return result

    async def get_karma_score_history(self, team_id: str, limit: int = 30) -> list[dict]:
        """All historical score snapshots for a team, newest first."""
        async with self._conn.execute(
            "SELECT * FROM karma_scores WHERE team_id = ? ORDER BY period_start DESC LIMIT ?",
            (team_id, limit),
        ) as cursor:
            rows = await cursor.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["breakdown_json"] = json.loads(d["breakdown_json"] or "{}")
                result.append(d)
            return result

    async def log_karma_event(self, entry: dict[str, Any]) -> None:
        """Append a granular karma event for event-by-event breakdown."""
        entry = dict(entry)
        entry["meta_json"] = json.dumps(entry.get("meta_json", {}))
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO karma_score_events
              (id, team_id, delta, reason, meta_json)
            VALUES (:id, :team_id, :delta, :reason, :meta_json)
            """,
            entry,
        )
        await self._conn.commit()

    async def get_karma_events(self, team_id: str, limit: int = 50) -> list[dict]:
        async with self._conn.execute(
            "SELECT * FROM karma_score_events WHERE team_id = ? ORDER BY created_at DESC LIMIT ?",
            (team_id, limit),
        ) as cursor:
            rows = await cursor.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["meta_json"] = json.loads(d["meta_json"] or "{}")
                result.append(d)
            return result

    # ------------------------------------------------------------------
    # SLA risks
    # ------------------------------------------------------------------

    async def upsert_sla_risk(self, risk: dict[str, Any]) -> None:
        await self._conn.execute(
            """
            INSERT OR REPLACE INTO sla_risks
              (id, vendor, risk_level, gap_pct, penalty_exposure_inr,
               days_remaining, summary, last_scanned_at)
            VALUES (:id, :vendor, :risk_level, :gap_pct, :penalty_exposure_inr,
                    :days_remaining, :summary, CURRENT_TIMESTAMP)
            """,
            risk,
        )
        await self._conn.commit()

    async def get_sla_risks(self) -> list[dict]:
        async with self._conn.execute(
            "SELECT * FROM sla_risks ORDER BY penalty_exposure_inr DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]
