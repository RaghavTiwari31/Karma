"""
decision_dna_prompts.py
Gemini prompts for the Decision DNA Agent — causal chain reconstruction.
"""

DECISION_DNA_SYSTEM = """You are KARMA's Decision DNA Agent — a forensic financial analyst that reconstructs the causal chain behind enterprise cost overruns.

Your job: given a sequence of timestamped business events, identify EXACTLY where a human decision was made without adequate context, and what structural fix would prevent recurrence.

Rules:
- Trace every cost event back to a specific decision or lack of decision
- Always identify: WHO could have acted, WHEN was the last intervention point, WHAT information was missing
- Never blame individuals — always point to structural gaps (missing policies, absent dashboards, no approval gates)
- Quantify the "information gap cost" — how much would have been saved if the right data was available at decision time
- Classify each decision node as:
  * "informed" — actor had all relevant data when deciding
  * "partial"  — actor had some data but key signals were absent
  * "blind"    — actor made decision with no cost visibility
- Output a decision_chain linking cause → effect → cost impact
- Always end with 3 specific structural recommendations that KARMA could enforce

Confidence scoring:
- 90+: Complete event log with timestamps, actors, and amounts for every step
- 70-89: Missing 1-2 events but chain is reconstructable
- 50-69: Significant gaps — analysis is inferential
- <50: Insufficient data — flag and ask for more

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON."""


def build_decision_dna_prompt(
    event_log: list[dict],
    total_overrun_inr: float,
    team: str = "Procurement & Engineering",
    period: str = "Q1 2026",
) -> str:
    import json

    # Pre-compute timeline summary
    first_evt = event_log[0] if event_log else {}
    last_evt  = event_log[-1] if event_log else {}

    # Find blind spots — events where no_context is flagged
    blind_events = [e for e in event_log if e.get("context_visibility") == "blind"]
    partial_events = [e for e in event_log if e.get("context_visibility") == "partial"]

    return f"""Analyse this cost overrun event log and reconstruct the causal decision chain.

Context:
- Team: {team}
- Period: {period}
- Total overrun / preventable cost: ₹{total_overrun_inr:,.0f}
- Events in log: {len(event_log)}
- Blind decision points detected: {len(blind_events)}
- Partial-context decision points: {len(partial_events)}
- Timeline: {first_evt.get('timestamp', 'unknown')} → {last_evt.get('timestamp', 'unknown')}

Event log (chronological):
{json.dumps(event_log, indent=2)}

Return EXACTLY this JSON structure:
{{
  "summary": "<2 sentences: what happened and why it was preventable>",
  "root_cause": "<one sentence: the single earliest decision that set off the chain>",
  "total_preventable_inr": <integer, conservative>,
  "decision_chain": [
    {{
      "step": 1,
      "timestamp": "<ISO datetime>",
      "actor": "<role, not name>",
      "action": "<what was decided or not decided>",
      "context_visibility": "<informed | partial | blind>",
      "missing_context": ["<specific data point that was absent>"],
      "cost_impact_inr": <integer, negative = spending, positive = saving>,
      "karma_intervention": "<what KARMA would have shown at this moment>",
      "intervention_timing": "<when would KARMA have fired the alert>"
    }}
  ],
  "structural_gaps": [
    {{
      "gap": "<specific process or system missing>",
      "fix": "<concrete KARMA feature or policy that addresses it>",
      "prevents_inr": <integer>
    }}
  ],
  "karma_coverage_score": <0-100, how much of this chain KARMA already covers>,
  "confidence": <0-100>,
  "confidence_rationale": "<why>",
  "recommended_karma_rules": [
    "<rule 1: specific threshold or trigger>",
    "<rule 2>",
    "<rule 3>"
  ]
}}

CRITICAL: decision_chain must have exactly one entry per event in the input log.
cost_impact_inr must be non-zero for every step."""
