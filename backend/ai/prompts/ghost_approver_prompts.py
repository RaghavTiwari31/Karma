"""
ghost_approver_prompts.py
Gemini prompt templates for the Ghost Approver Agent — the star feature.
"""

GHOST_APPROVER_SYSTEM = """You are KARMA's Ghost Approver — an enterprise financial intelligence agent embedded silently inside approval workflows.

When a purchase request arrives, you appear with full analytical context BEFORE the approver clicks approve.
Your job: in under 100 words per option, generate 2–3 clear, ranked approval options based on financial impact.

Rules:
- Be direct. No preamble. No filler words.
- Always quantify savings in INR (format: ₹X,XX,XXX).
- Round savings DOWN to the nearest ₹10,000 (conservative, under-promise).
- Include a confidence score (0–100) based on data completeness.
- If utilisation data shows seats/capacity unused >90 days, always flag the specific count.
- If an alternative vendor is available, always include it as Option 3 with exact savings.
- Include a data_note on the alternative like "based on N past POs" if PO history exists.
- Never say "significant savings" or "substantial reduction" — always give the rupee figure.
- If the request is fully justified (high utilisation, good rate), say so clearly — don't manufacture savings.

Confidence scoring guide:
- 90–100: Full utilisation data + rate card + PO history all present
- 70–89:  2 of 3 data sources present
- 50–69:  Only 1 data source, or data is >90 days old
- <50:    No enrichment data — analysis is indicative only

Urgency tags for the header message:
- "🚨 ACTION NEEDED" if current rate > benchmark by >15%
- "⚠️ REVIEW SUGGESTED" if utilisation < 60% or rate 5–15% above benchmark
- "✅ LOOKS REASONABLE" if utilisation >80% and rate within 5% of benchmark

You must respond ONLY with valid JSON matching the exact schema requested. No markdown, no explanation."""


def build_ghost_prompt(
    vendor: str,
    amount: float,
    category: str,
    requester: str,
    utilization: dict,
    rate_card: dict,
    alt_vendors: list,
    past_pos: list,
) -> str:
    import json

    # Compute key signals for prompt focus
    total_seats = utilization.get("total_seats") or utilization.get("ri_instances")
    active_seats = utilization.get("active_seats") or utilization.get("ri_utilized")
    util_pct = utilization.get("utilization_pct", "unknown")
    seats_idle = utilization.get("seats_unused_90_days", "unknown")

    benchmark = rate_card.get("benchmark_price_per_seat_inr")
    if benchmark and total_seats:
        benchmark_total = benchmark * int(total_seats)
        rate_variance_pct = round((amount - benchmark_total) / benchmark_total * 100, 1) if benchmark_total > 0 else None
    else:
        rate_variance_pct = None

    context_signals = []
    if util_pct != "unknown" and isinstance(util_pct, (int, float)):
        if util_pct < 50:
            context_signals.append(f"LOW utilisation ({util_pct}%) — strong case for reduction")
        elif util_pct < 70:
            context_signals.append(f"MODERATE utilisation ({util_pct}%) — seat reduction possible")
        else:
            context_signals.append(f"HIGH utilisation ({util_pct}%) — request may be justified")

    if rate_variance_pct is not None:
        if rate_variance_pct > 15:
            context_signals.append(f"Rate is {rate_variance_pct}% ABOVE category benchmark — negotiate or switch")
        elif rate_variance_pct > 5:
            context_signals.append(f"Rate is {rate_variance_pct}% above benchmark — room to negotiate")
        else:
            context_signals.append(f"Rate is within {abs(rate_variance_pct)}% of benchmark — competitive")

    if seats_idle not in ("unknown", None, 0):
        context_signals.append(f"{seats_idle} seats unused for 90+ days")

    best_alt = alt_vendors[0] if alt_vendors else None

    return f"""Approval request details:
- Vendor: {vendor}
- Amount requested: ₹{amount:,.0f}
- Category: {category}
- Requested by: {requester}

Key signals (pre-computed for your analysis):
{chr(10).join(f'• {s}' for s in context_signals) if context_signals else '• No pre-computed signals — use enrichment data below'}

Enrichment data:
Utilisation (last 90 days): {json.dumps(utilization, indent=2)}

Rate card for {category}: {json.dumps(rate_card, indent=2)}

Best alternative vendor: {json.dumps(best_alt, indent=2) if best_alt else 'None available'}

Past {len(past_pos)} POs with {vendor}: {json.dumps(past_pos, indent=2) if past_pos else 'No history'}

Generate 2–3 approval options. Return EXACTLY this JSON structure:
{{
  "urgency_tag": "<🚨 ACTION NEEDED | ⚠️ REVIEW SUGGESTED | ✅ LOOKS REASONABLE>",
  "header_insight": "<one punchy sentence, ≤20 words, summarising the key financial risk or opportunity>",
  "options": [
    {{
      "option_id": "approve_full",
      "label": "Approve Full — ₹{amount:,.0f}",
      "action_type": "approve_full",
      "savings_inr": 0,
      "rationale": "<≤2 sentences explaining why someone would choose this>",
      "recommended": false
    }},
    {{
      "option_id": "approve_reduced",
      "label": "✅ Approve Reduced — <seats/size> (saves ₹X,XX,XXX)",
      "action_type": "approve_reduced",
      "savings_inr": <integer, conservative>,
      "recommended_seats_or_size": "<specific recommendation>",
      "rationale": "<≤2 sentences with specific data point>",
      "recommended": true
    }},
    {{
      "option_id": "switch_vendor",
      "label": "🔄 Switch to <alt_vendor> (saves ₹X,XX,XXX)",
      "action_type": "switch_vendor",
      "savings_inr": <integer>,
      "alternative_vendor": "<name>",
      "rationale": "<≤2 sentences>",
      "data_note": "<e.g. 'based on 3 past POs from this vendor' or 'benchmark comparison'>",
      "recommended": false
    }}
  ],
  "max_savings_inr": <highest savings_inr across all options>,
  "confidence": <0-100>,
  "confidence_rationale": "<one sentence on why this confidence level>",
  "execution_payload": {{
    "vendor": "{vendor}",
    "category": "{category}",
    "original_amount_inr": {amount},
    "total_seats": {total_seats if total_seats else 'null'},
    "active_seats": {active_seats if active_seats else 'null'}
  }}
}}

IMPORTANT: If no alternative vendor is available, omit the switch_vendor option entirely.
Return only 2 options in that case."""
