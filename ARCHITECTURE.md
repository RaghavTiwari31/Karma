# System Architecture & Design

The KARMA system is designed to seamlessly integrate with a company's existing IT, procurement, and billing systems via asynchronous agents that trigger interventions before a financial transaction is committed.

---

## 🏗 High-Level Communication Flow

KARMA operates on an **event-driven architecture**, ensuring low latency and high scalability across different enterprise layers.

1. **System Monitors (Webhooks / Time-Loops):** Internal connectors ping vendor APIs (mocked here on port `8001`) to assess current software utilization (via SSO logs in SAP) and active SLA contract health.
2. **Orchestrator Node:** Whenever a monitor creates a `KARMAEvent`, it's pushed to `orchestrator.py`, which is in charge of dispatching the event payloads to the appropriate specialized AI Agents based on the telemetry category.
3. **Agent execution:** Agents call `GeminiClient`, which constructs a highly-specific prompt utilizing `google-genai`. Gemini 2.0 Flash Lite acts as our sub-second analytical brain, structuring instructions via strict typed dictionaries or JSON responses.
4. **Execution Layer:** After the AI concludes a remediation (e.g., resizing an instance or reducing a SaaS cohort length), an execution payload is sent to `execution_agent.py`, which simulates hitting external `POST` endpoints to log a vendor receipt.

---

## 🤖 The Multi-Agent Network Roles

KARMA distributes its intelligence across five distinct agents, each constrained to a narrow domain for optimal accuracy.

### 1. 👻 Ghost Approver Agent
The interceptor. Sits directly inside the Slack/Teams integration layer for purchase requests. Before a manager can click "Approve", the Ghost Approver intercepts the ID, queries the backend for the vendor's utilization, checks the rate card, evaluates benchmark alternatives, and injects actionable "Approve Reduced" options wrapped dynamically in UI blocks.

### 2. 📅 Waste Calendar Agent
The planner. Analyzes rolling contract datasets and correlates them with historical value. If a contract is yielding less than 70% ROI, it places a prioritized ticket mapped onto a timeline, giving teams specific windows of opportunity to challenge or drop a subscription *before* auto-renewals trigger.

### 3. 🛡️ SLA Monitor Agent
The risk assessor. Background service that polls the theoretical "Status APIs" against promised SLA contracts defined in JIRA. It projects downtime limits linearly. If a vendor reaches critical threshold limits, the monitor raises an immediate alert and creates a high-priority Waste Calendar issue.

### 4. 🧬 Decision DNA Agent
The forensic auditor. When a cost overrun occurs, this agent uses Gemini to rebuild the sequence of decisions that caused it. It evaluates the "context gap"—what information was missing from the person who approved it—and writes a dynamic policy recommending how a future Ghost Approver prompt should intercept it.

### 5. 🏆 Karma Score Engine
The accountability ledger. Tracks department decisions. Approving a Ghost Approver's recommendation creates a positive point delta. Bypassing an AI's advice for full-spend reduces points. Features a 7-day inactivity decay to keep users engaged.

---

## 🔌 Connector Pattern

Rather than tight-coupling logic, KARMA uses a unified **Connector Registry**. 
- The `SAPConnector` abstracts utilization, benchmarking, and historical PoOs.
- The `JIRAConnector` tracks organizational structures, incidents, and SLAs.
- The `AWSConnector` resolves cloud execution hooks.

The `MockServer` dynamically hosts datasets resembling these tools, providing dynamic HTTP routes that mimic realistic latencies and payloads. In an enterprise, only the Connector mapping layer must be swapped out—the Orchestrator and Agents remain untouched.

---

## ⚠️ Resilience & Error Handling

KARMA implements multiple fallback layers designed for mission-critical enterprise deployment:

1. **Deterministic Fallbacks:** If the Gemini API hits a rate limit or times out, the Ghost Approver rolls back to `_fallback_analysis()`. This local heuristic trims 10% from the requested usage and proposes an automated 'Reduced Option' based entirely on math—ensuring the purchasing pipeline never blocks a user completely.
2. **Local Cache Pre-Seeding:** Important execution endpoints (e.g., Demo Scenarios) operate against a predetermined SQLite SHA-256 hash. If network disruptions prevent external LLM calls, the interface will automatically retrieve the nearest matching analysis payload in under `100ms`, verifying enterprise-offline resilience.
3. **Graceful UI Latency Parsing:** Rather than blocking an application thread, all generation endpoints are asynchronous `async/await`. While waiting, a WebSocket or structured UI progress-tracker reports intermediate proxy stages (ex: *"Pulling rate cards... Scanning JIRA..."*) to set intentional latency expectations for end users.
