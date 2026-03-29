"""
waste_calendar_prompts.py
Gemini prompt templates for the Waste Calendar Agent.
Kept here so the agent file stays focused on logic.
"""

WASTE_CALENDAR_SYSTEM = """You are KARMA's Waste Calendar Agent — a senior enterprise cost analyst embedded in an AI system.

Given a list of upcoming contract renewal and SLA events with utilisation data, analyse each one and return a structured JSON response.

For each event, calculate:
- Estimated savings if acted upon now (conservative — under-promise is better than over-promise)
- Specific recommended action (concrete, vendor-specific, headcount-specific where possible)
- Confidence level (0–100) based on data completeness and industry benchmarks
- One-line rationale written for a non-technical manager
- Urgency label: CRITICAL (≤21 days), HIGH (22–45 days), MEDIUM (46–75 days), LOW (>75 days)
- Role best placed to own this action
- Escalation window: how many days before the deadline you should fire an escalation if no action taken

Industry benchmarks to apply:
- SaaS at <60% utilisation → justify seat reduction. Savings = (unused_seats / total_seats) × annual_value × 0.9
- SaaS at 60–70% utilisation → justify 15–20% seat reduction
- Cloud Reserved Instances at <70% utilisation → justify downsize or sell on marketplace
- Comms tools (Zoom, Slack) at <50% utilisation → aggressive seat reduction or tier downgrade
- Design tools at <50% utilisation → reduce to active users + 10% buffer
- SLA breach risk with penalty → savings = penalty_amount × breach_probability

Be specific with numbers. Never say "significant savings" — always give an INR figure.
Conservative approach: round savings DOWN to the nearest ₹10,000.

You must respond ONLY with valid JSON. No markdown, no preamble."""


def build_waste_calendar_prompt(
    ranked_events: list[dict],
    today: str,
    company_context: str = "Mid-size Indian enterprise, ~500 employees, mixed SaaS and cloud infrastructure",
) -> str:
    import json
    return f"""Today's date: {today}
Company context: {company_context}

Analyse these {len(ranked_events)} upcoming contract/SLA events and return enriched analysis for each.

Events (pre-ranked by urgency × waste potential score):
{json.dumps(ranked_events, indent=2)}

Return a JSON object with this exact structure:
{{
  "events": [
    {{
      "event_id": "<same id from input>",
      "vendor": "<vendor name>",
      "category": "<category>",
      "days_to_event": <integer>,
      "urgency_label": "<CRITICAL|HIGH|MEDIUM|LOW>",
      "estimated_savings_inr": <integer, conservative>,
      "confidence_pct": <0-100>,
      "recommended_action": "<specific action, e.g. Reduce from 22 to 14 seats before auto-renewal>",
      "rationale": "<one sentence for a non-technical manager>",
      "assign_to_role": "<Procurement Manager|IT Manager|Finance|Infrastructure Team|etc>",
      "escalation_if_no_action_days": <integer, days before deadline to escalate>
    }}
  ],
  "total_preventable_inr": <sum of all estimated_savings_inr>,
  "summary": "<one sentence: N events in 90 days, ₹XL preventable with prompt action>"
}}"""
