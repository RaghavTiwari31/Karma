"""
karma_score.py — KarmaScoreEngine (Phase 8)

Tracks behavioural cost-accountability scores for each team.
Scores are on a 0–100 scale, updated in real time on every KARMA action:
  +pts for fast approvals, executing savings actions, completing waste tasks
  -pts for ignoring Ghost Approver flags, SLA breaches, stale waste events

Score decay: teams with no activity for 7+ days lose 1 pt/day.

DB schema: karma_scores(team_id, period_start, score, delta, breakdown_json)
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta
from typing import Any, Optional

from backend.agents.base_agent import BaseAgent, KARMAAction, KARMAEvent

logger = logging.getLogger(__name__)

# Seed data — realistic baseline for immediate leaderboard display
SEED_TEAMS = [
    {
        "team_id": "procurement",
        "team_name": "Procurement",
        "score": 82.0,
        "delta": +8.0,
        "streak": 5,
        "breakdown_json": {
            "last_action": "Executed reduce_saas_seats for Adobe CC",
            "savings_inr": 200000,
            "events_resolved": 3,
        },
    },
    {
        "team_id": "engineering",
        "team_name": "Engineering",
        "score": 71.0,
        "delta": -3.0,
        "streak": 0,
        "breakdown_json": {
            "last_action": "Ignored Ghost Approver flag on AWS Reserved Instances",
            "savings_missed_inr": 547200,
            "events_resolved": 1,
        },
    },
    {
        "team_id": "finance",
        "team_name": "Finance",
        "score": 91.0,
        "delta": +12.0,
        "streak": 9,
        "breakdown_json": {
            "last_action": "Resolved 4 waste events in 24h",
            "savings_inr": 890000,
            "events_resolved": 4,
        },
    },
    {
        "team_id": "infra",
        "team_name": "Infrastructure",
        "score": 64.0,
        "delta": -6.0,
        "streak": 0,
        "breakdown_json": {
            "last_action": "SLA breach risk unresolved for 14 days",
            "penalty_exposure_inr": 500000,
            "events_resolved": 0,
        },
    },
    {
        "team_id": "product",
        "team_name": "Product",
        "score": 77.0,
        "delta": +4.0,
        "streak": 2,
        "breakdown_json": {
            "last_action": "Completed ghost_approver:approve_reduced for Zoom",
            "savings_inr": 142000,
            "events_resolved": 2,
        },
    },
]


class KarmaScoreEngine(BaseAgent):
    """
    Rolling karma score tracker.
    Handles credit, debit, decay, and leaderboard serving.
    """

    # Points configuration — single place to tune
    POINTS = {
        "ghost_approve_reduced":  +8,
        "ghost_switch_vendor":    +10,
        "ghost_approve_full":     -12,
        "execution_complete":     +10,
        "waste_task_resolved":    +6,
        "sla_breach_unresolved":  -8,
        "decision_dna_analysed":  +4,
        "decay_per_day":          -1,
    }

    # ------------------------------------------------------------------
    # BaseAgent interface
    # ------------------------------------------------------------------

    async def receive(self, event: KARMAEvent) -> Optional[KARMAAction]:
        if event.event_type == "score_credit":
            return await self._handle_credit(event.payload)
        if event.event_type == "score_debit":
            return await self._handle_debit(event.payload)
        if event.event_type == "score_decay":
            return await self._handle_decay(event.payload)
        if event.event_type == "seed_scores":
            return await self._handle_seed(event.payload)
        logger.warning("KarmaScoreEngine: unknown event_type %s", event.event_type)
        return None

    # ------------------------------------------------------------------
    # Credit
    # ------------------------------------------------------------------

    async def _handle_credit(self, payload: dict) -> KARMAAction:
        team_id = payload.get("team_id", "unknown")
        points  = float(payload.get("points", 5))
        reason  = payload.get("reason", "KARMA action")
        meta    = payload.get("meta", {})

        new_score, delta = await self._apply_delta(team_id, points, reason, meta)

        logger.info("Karma credit: team=%s +%.1f pts → %.1f (%s)", team_id, points, new_score, reason)
        return self._score_action(team_id, new_score, delta, reason)

    # ------------------------------------------------------------------
    # Debit
    # ------------------------------------------------------------------

    async def _handle_debit(self, payload: dict) -> KARMAAction:
        team_id = payload.get("team_id", "unknown")
        points  = float(payload.get("points", 5))
        reason  = payload.get("reason", "KARMA penalty")
        meta    = payload.get("meta", {})

        new_score, delta = await self._apply_delta(team_id, -points, reason, meta)

        logger.info("Karma debit: team=%s −%.1f pts → %.1f (%s)", team_id, points, new_score, reason)
        return self._score_action(team_id, new_score, delta, reason)

    # ------------------------------------------------------------------
    # Decay — runs on a schedule (triggered by startup / cron event)
    # ------------------------------------------------------------------

    async def _handle_decay(self, payload: dict) -> KARMAAction:
        """
        Apply −1 pt/day to any team with no activity in the past 7 days.
        Decays to a floor of 20.0 (very low but not zero — teams can recover).
        """
        all_scores = await self.db.get_karma_scores()
        decayed   = []
        today     = date.today()

        for row in all_scores:
            team_id      = row["team_id"]
            period_str   = row.get("period_start", str(today))
            last_activity = date.fromisoformat(period_str)
            idle_days     = (today - last_activity).days

            if idle_days >= 7:
                decay_pts  = min(idle_days - 6, 10)  # cap at −10/day batch
                new_score  = max(20.0, row["score"] - decay_pts)
                await self.db.upsert_karma_score({
                    "team_id":      team_id,
                    "period_start": str(today),
                    "score":        new_score,
                    "delta":        -float(decay_pts),
                    "breakdown_json": {
                        "reason":    f"Decay: {idle_days} days inactive",
                        "idle_days": idle_days,
                    },
                })
                decayed.append({"team_id": team_id, "decay": decay_pts, "new_score": new_score})
                logger.info("Karma decay: team=%s −%d pts → %.1f", team_id, decay_pts, new_score)

        return KARMAAction(
            action_id=f"kd_{uuid.uuid4().hex[:8]}",
            action_type="score_decay",
            target="leaderboard",
            payload={"decayed_teams": decayed, "total_decayed": len(decayed)},
            savings_inr=0,
            confidence_score=1.0,
            requires_approval=False,
        )

    # ------------------------------------------------------------------
    # Seed
    # ------------------------------------------------------------------

    async def _handle_seed(self, payload: dict) -> KARMAAction:
        """Insert baseline team scores if they don't exist yet."""
        seeded = []
        today  = str(date.today())
        for team in SEED_TEAMS:
            existing = await self.db.get_karma_score_for_team(team["team_id"])
            if not existing:
                await self.db.upsert_karma_score({
                    "team_id":      team["team_id"],
                    "period_start": today,
                    "score":        team["score"],
                    "delta":        team["delta"],
                    "breakdown_json": {
                        **team["breakdown_json"],
                        "team_name": team["team_name"],
                        "streak":    team["streak"],
                    },
                })
                seeded.append(team["team_id"])
                logger.info("Karma seed: team=%s score=%.1f", team["team_id"], team["score"])

        logger.info("Karma seed complete: %d teams seeded", len(seeded))
        return KARMAAction(
            action_id=f"ks_{uuid.uuid4().hex[:8]}",
            action_type="score_update",
            target="leaderboard",
            payload={"seeded": seeded, "total": len(SEED_TEAMS)},
            savings_inr=0,
            confidence_score=1.0,
            requires_approval=False,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _apply_delta(
        self,
        team_id: str,
        delta: float,
        reason: str,
        meta: dict,
    ) -> tuple[float, float]:
        existing  = await self.db.get_karma_score_for_team(team_id)
        current   = existing["score"] if existing else 70.0
        new_score = max(0.0, min(100.0, current + delta))

        await self.db.upsert_karma_score({
            "team_id":      team_id,
            "period_start": str(date.today()),
            "score":        new_score,
            "delta":        delta,
            "breakdown_json": {"reason": reason, **meta},
        })
        return new_score, delta

    def _score_action(self, team_id: str, score: float, delta: float, reason: str) -> KARMAAction:
        return KARMAAction(
            action_id=f"ks_{uuid.uuid4().hex[:8]}",
            action_type="score_update",
            target=team_id,
            payload={"team_id": team_id, "score": score, "delta": delta, "reason": reason},
            savings_inr=0,
            confidence_score=1.0,
            requires_approval=False,
        )
