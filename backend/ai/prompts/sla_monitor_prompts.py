"""
sla_monitor_prompts.py
Gemini prompts for the SLA Monitor Agent — breach risk analysis.
"""

SLA_MONITOR_SYSTEM = """You are KARMA's SLA Monitor — a contract risk specialist who identifies impending SLA breaches BEFORE they trigger penalty clauses.

Your role: given current uptime metrics and contract terms, project whether an SLA breach will occur before the contract renewal date and prescribe specific remediation actions.

Analysis framework:
1. Calculate the gap: threshold_pct − current_uptime_pct
2. Project forward: if trend continues linearly, will breach occur before contract_end?
3. Classify risk:
   - CRITICAL: already breaching OR projected breach within 30 days
   - HIGH: projected breach within 60 days
   - MEDIUM: below threshold but not projected to breach within 60 days
   - LOW: comfortably above threshold
4. Quantify total penalty exposure (not just one breach — estimate frequency)
5. Prescribe 2–3 specific remediation steps the vendor must take

Focus on business impact, not just technical metrics. Penalty exposure in INR is what drives executive attention.

Respond ONLY with valid JSON. No markdown fences, no explanation outside the JSON."""


def build_sla_prompt(contract: dict, days_remaining: int, projected_uptime: float) -> str:
    import json

    threshold = float(contract.get("sla_threshold_pct", 99.5))
    current   = float(contract.get("current_uptime_pct", 99.0))
    gap = threshold - current
    breach_already = gap > 0
    penalty = float(contract.get("penalty_per_breach_inr", 500000))

    return f"""Analyse this SLA contract for breach risk and financial exposure.

Contract:
{json.dumps(contract, indent=2)}

Computed metrics:
- Days remaining on contract: {days_remaining}
- Current gap to threshold: {gap:.2f}% ({"ALREADY BREACHING" if breach_already else "below threshold"})
- Projected uptime at contract end (linear extrapolation): {projected_uptime:.3f}%
- Penalty per breach: ₹{penalty:,.0f}
- Estimated breaches at current trajectory: {max(1, round(days_remaining / 30)) if breach_already else 0}
- Total exposure: ₹{max(1, round(days_remaining / 30)) * penalty if breach_already else 0:,.0f}

Return EXACTLY this JSON:
{{
  "vendor": "{contract.get('vendor', '')}",
  "risk_level": "<CRITICAL | HIGH | MEDIUM | LOW>",
  "summary": "<1 sentence: what is happening and financial impact>",
  "current_uptime_pct": {contract.get("current_uptime_pct", 99.0)},
  "threshold_pct": {contract.get("sla_threshold_pct", 99.5)},
  "gap_pct": {gap:.4f},
  "projected_uptime_at_end": {projected_uptime:.4f},
  "days_to_potential_breach": <integer, -1 if already breaching>,
  "penalty_exposure_inr": <integer>,
  "remediation_steps": [
    "<specific action 1>",
    "<specific action 2>",
    "<specific action 3>"
  ],
  "escalate_to": "{contract.get('account_manager', 'ops@acme.com')}",
  "confidence": <50-95>
}}"""
