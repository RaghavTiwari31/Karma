"""
seed_gemini_cache.py  — Run once before the demo to pre-warm the SQLite Gemini cache.

Usage:  python seed_gemini_cache.py

Pre-seeds 3 full Ghost Approver scenarios with deterministic responses so the demo
works 100% offline even if the Gemini API has quota issues.
"""

import asyncio
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from backend.db.database import Database
from backend.ai.prompts.ghost_approver_prompts import GHOST_APPROVER_SYSTEM, build_ghost_prompt

# ─────────────────────────────────────────────────────────────────────────────
# Deterministic Gemini responses for the 3 demo scenarios
# ─────────────────────────────────────────────────────────────────────────────

DEMO_SCENARIOS = [
    {
        "name": "Salesforce CRM Renewal",
        "vendor": "Salesforce",
        "amount": 1800000,
        "category": "CRM",
        "requester": "finance@acme.com",
        "utilization": {
            "vendor": "Salesforce",
            "total_seats": 50,
            "active_seats": 31,
            "utilization_pct": 61,
            "seats_unused_90_days": 14,
        },
        "rate_card": {
            "category": "CRM",
            "benchmark_price_per_seat_inr": 28000,
            "percentile_75_inr": 32000,
        },
        "alt_vendors": [
            {
                "name": "HubSpot CRM",
                "estimated_annual_inr": 1050000,
                "match_pct": 82,
                "migration_effort": "medium",
            }
        ],
        "past_pos": [
            {"amount_inr": 1620000, "date": "2025-04-14", "negotiated": False},
            {"amount_inr": 1530000, "date": "2024-04-14", "negotiated": True},
        ],
        "response": {
            "urgency_tag": "🚨 ACTION NEEDED",
            "header_insight": "14 Salesforce seats idle 90+ days — paying ₹3,92,000 for zero value.",
            "options": [
                {
                    "option_id": "approve_full",
                    "label": "Approve Full — ₹18,00,000",
                    "action_type": "approve_full",
                    "savings_inr": 0,
                    "rationale": "Approve at current rate. No change to 14 idle seats — ₹3,92,000 waste continues.",
                    "recommended": False,
                },
                {
                    "option_id": "approve_reduced",
                    "label": "✅ Approve Reduced — 32 seats (saves ₹5,00,000)",
                    "action_type": "approve_reduced",
                    "savings_inr": 500000,
                    "recommended_seats_or_size": "32 active seats",
                    "rationale": "Drop 18 idle seats at ₹28,000/seat benchmark. Saves ₹5,04,000 annually with zero business impact.",
                    "recommended": True,
                    "action_payload": {
                        "from_seats": 50,
                        "to_seats": 32,
                    }
                },
                {
                    "option_id": "switch_vendor",
                    "label": "🔄 Switch to HubSpot CRM (saves ₹7,50,000)",
                    "action_type": "switch_vendor",
                    "savings_inr": 750000,
                    "alternative_vendor": "HubSpot CRM",
                    "rationale": "HubSpot at ₹10,50,000 for equivalent seats — saves ₹7,50,000 year-1. Migration rated medium effort.",
                    "data_note": "Based on 2 past POs and category benchmark. HubSpot match score: 82%.",
                    "recommended": False,
                },
            ],
            "max_savings_inr": 750000,
            "confidence": 85,
            "confidence_rationale": "Utilisation data and rate card present; PO history confirms pricing pattern.",
            "execution_payload": {
                "vendor": "Salesforce",
                "category": "CRM",
                "original_amount_inr": 1800000,
                "total_seats": 50,
                "active_seats": 31,
            },
        },
    },
    {
        "name": "Zoom SaaS Renewal",
        "vendor": "Zoom",
        "amount": 180000,
        "category": "Comms",
        "requester": "procurement@acme.com",
        "utilization": {
            "vendor": "Zoom",
            "total_seats": 40,
            "active_seats": 15,
            "utilization_pct": 38,
            "seats_unused_90_days": 22,
        },
        "rate_card": {
            "category": "Comms",
            "benchmark_price_per_seat_inr": 3500,
            "percentile_75_inr": 4200,
        },
        "alt_vendors": [
            {
                "name": "Google Meet (Workspace)",
                "estimated_annual_inr": 60000,
                "match_pct": 91,
                "migration_effort": "low",
            }
        ],
        "past_pos": [
            {"amount_inr": 168000, "date": "2025-04-20", "negotiated": False},
        ],
        "response": {
            "urgency_tag": "🚨 ACTION NEEDED",
            "header_insight": "62% of Zoom licences idle — ₹1,26,000 avoidable waste in current renewal.",
            "options": [
                {
                    "option_id": "approve_full",
                    "label": "Approve Full — ₹1,80,000",
                    "action_type": "approve_full",
                    "savings_inr": 0,
                    "rationale": "Approve 40 seats at current rate. 22 idle seats continue to drain budget.",
                    "recommended": False,
                },
                {
                    "option_id": "approve_reduced",
                    "label": "✅ Approve Reduced — 16 seats (saves ₹1,10,000)",
                    "action_type": "approve_reduced",
                    "savings_inr": 110000,
                    "recommended_seats_or_size": "16 active seats",
                    "rationale": "Right-size to 16 seats matching actual usage. Saves ₹1,10,000 at benchmark ₹3,500/seat.",
                    "recommended": True,
                    "action_payload": {
                        "from_seats": 40,
                        "to_seats": 16,
                    }
                },
                {
                    "option_id": "switch_vendor",
                    "label": "🔄 Switch to Google Meet (saves ₹1,20,000)",
                    "action_type": "switch_vendor",
                    "savings_inr": 120000,
                    "alternative_vendor": "Google Meet (Workspace)",
                    "rationale": "Google Meet included in existing Workspace subscription — near-zero marginal cost. Saves ₹1,20,000.",
                    "data_note": "Workspace subscription already active per IT records. Migration effort: low.",
                    "recommended": False,
                },
            ],
            "max_savings_inr": 120000,
            "confidence": 88,
            "confidence_rationale": "Strong utilisation signal with 90-day idle data; Workspace overlap confirmed.",
            "execution_payload": {
                "vendor": "Zoom",
                "category": "Comms",
                "original_amount_inr": 180000,
                "total_seats": 40,
                "active_seats": 15,
            },
        },
    },
    {
        "name": "AWS Reserved Cloud Instance Resize",
        "vendor": "AWS Reserved",
        "amount": 960000,
        "category": "Cloud Infrastructure",
        "requester": "infra@acme.com",
        "utilization": {
            "vendor": "AWS Reserved",
            "ri_instances": 12,
            "ri_utilized": 9,
            "utilization_pct": 78,
            "seats_unused_90_days": 3,
        },
        "rate_card": {
            "category": "Cloud Infrastructure",
            "benchmark_price_per_seat_inr": 68000,
            "percentile_75_inr": 80000,
        },
        "alt_vendors": [],
        "past_pos": [
            {"amount_inr": 900000, "date": "2026-01-15", "negotiated": True},
        ],
        "response": {
            "urgency_tag": "⚠️ REVIEW SUGGESTED",
            "header_insight": "3 AWS Reserved instances underutilised — downsize saves ₹2,00,000 with no capacity risk.",
            "options": [
                {
                    "option_id": "approve_full",
                    "label": "Approve Full — ₹9,60,000",
                    "action_type": "approve_full",
                    "savings_inr": 0,
                    "rationale": "Retain all 12 reserved instances. Safe headroom buffer for traffic spikes.",
                    "recommended": False,
                },
                {
                    "option_id": "approve_reduced",
                    "label": "✅ Resize to 9 instances (saves ₹2,00,000)",
                    "action_type": "approve_reduced",
                    "savings_inr": 200000,
                    "recommended_seats_or_size": "9 RI instances",
                    "rationale": "3 instances show <10% utilisation over 90 days. Resize saves ₹2,04,000 at ₹68,000/instance.",
                    "recommended": True,
                    "action_payload": {
                        "instance_id": "ri-cluster-prod-01",
                        "current_type": "m5.2xlarge",
                        "target_type": "m5.xlarge",
                        "from_seats": 12,
                        "to_seats": 9,
                    }
                },
            ],
            "max_savings_inr": 200000,
            "confidence": 78,
            "confidence_rationale": "Utilisation data strong; no alternative vendor available for direct comparison.",
            "execution_payload": {
                "vendor": "AWS Reserved",
                "category": "Cloud Infrastructure",
                "original_amount_inr": 960000,
                "total_seats": 12,
                "active_seats": 9,
            },
        },
    },
]


def _cache_key(vendor: str, amount: float, category: str) -> str:
    """Matches GhostApproverAgent._demo_cache_key() exactly."""
    payload = f"DEMO|{vendor.strip().lower()}|{int(amount)}|{category.strip().lower()}"
    return hashlib.sha256(payload.encode()).hexdigest()


async def seed():
    db = Database()
    await db.initialize()

    total_seeded = 0
    for scenario in DEMO_SCENARIOS:
        key = _cache_key(scenario["vendor"], scenario["amount"], scenario["category"])
        await db.set_cached_response(key, scenario["response"])
        total_seeded += 1
        print(f"  ✅ Seeded: {scenario['name']} (key: {key[:12]}...)")

    await db.close()
    print(f"\n🎯 KARMA demo cache seeded: {total_seeded} scenarios ready for offline demo.")
    print("   Ghost Approver will now return in <100ms even without Gemini API access.\n")


if __name__ == "__main__":
    asyncio.run(seed())
