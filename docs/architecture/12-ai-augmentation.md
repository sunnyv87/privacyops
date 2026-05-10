# Section 12 — AI Augmentation Layer

## Design Principles

1. **AI assists, humans decide** — All AI outputs require human review before taking effect
2. **PII never leaves the boundary** — Redact PII before sending to external LLMs
3. **Auditable** — Every AI interaction logged with input hash, output, model, confidence
4. **Graceful degradation** — Platform works fully without AI; AI enhances, never blocks
5. **Model-agnostic** — Abstraction layer supports multiple providers

## AI Functions by Module

### DSPM / Classification
| Function | Input | Output | HITL Required | Risk |
|---|---|---|---|---|
| Suggest classification labels | Column name + sample values (redacted) | Suggested label + confidence | Yes - review queue | Low |
| Explain finding | Finding details | Natural language explanation | No (display only) | Low |
| Recommend remediation | Finding type + context | Remediation steps | Yes - review before action | Medium |
| Anomaly detection | Access pattern data | Anomaly alerts | Yes - confirm before action | Medium |

### Privacy Risk / DPIA
| Function | Input | Output | HITL Required | Risk |
|---|---|---|---|---|
| Summarize DPIA inputs | Assessment form data (redacted) | Executive summary paragraph | Yes - review before save | Low |
| Suggest risks | Processing description | Potential risk items | Yes - review before adding | Medium |
| Recommend controls | Risk items | Control suggestions from library | Yes - select applicable | Low |

### DSAR
| Function | Input | Output | HITL Required | Risk |
|---|---|---|---|---|
| Summarize response package | Collected data metadata | Summary for cover letter | Yes - review before sending | High |
| Suggest redactions | Collected data | Redaction suggestions | Yes - manual review mandatory | High |

### Breach
| Function | Input | Output | HITL Required | Risk |
|---|---|---|---|---|
| Draft notification | Breach details (redacted) | Notification document draft | Yes - legal review mandatory | High |
| Estimate impact | Breach scope + data map | Impact assessment narrative | Yes - manual verification | High |

### Compliance
| Function | Input | Output | HITL Required | Risk |
|---|---|---|---|---|
| Map obligations to controls | Regulation text + control library | Suggested mappings | Yes - compliance team review | Medium |
| Gap analysis narrative | Gap data | Executive summary of gaps | Yes - review | Low |

### Dashboard
| Function | Input | Output | HITL Required | Risk |
|---|---|---|---|---|
| Executive summary | Dashboard metrics | Natural language summary | No (display only) | Low |
| Trend explanation | Metric trends | Explanation of changes | No (display only) | Low |

## Architecture

### Current Implementation

```
┌────────────────────────────────────────────────────────────────┐
│                       CoPilotService                           │
│  ┌────────────────────┐  ┌───────────────────────────────────┐│
│  │QueryInterpreterSvc │  │ ContextAssemblerService           ││
│  └────────────────────┘  └───────────────────────────────────┘│
│  ┌────────────────────┐  ┌───────────────────────────────────┐│
│  │ Template Engine     │  │ LicensingService                 ││
│  │ (deterministic)     │  │ (ai_llm_enrichment gate)         ││
│  └────────────────────┘  └───────────────────────────────────┘│
└────────────┬──────────────────────────────────────────────────┘
             │ enrichResponse() — optional LLM layer
┌────────────▼──────────────────────────────────────────────────┐
│              AI Provider Abstraction (AI_PROVIDER)             │
│                                                                │
│  ┌──────────────────┐  ┌───────────────────────────────────┐  │
│  │ RedactionService  │  │ Circuit Breaker (5 fail / 60s)   │  │
│  │ (12 PII patterns) │  │                                   │  │
│  └──────────────────┘  └───────────────────────────────────┘  │
│  ┌──────────────────┐  ┌───────────────────────────────────┐  │
│  │ AbortSignal       │  │ PrometheusService                │  │
│  │ (per-call timeout)│  │ (ai_call_total, duration, state) │  │
│  └──────────────────┘  └───────────────────────────────────┘  │
└────────────┬──────────────────────────────────────────────────┘
             │
       ┌─────┼──────────────┐
       │     │              │
┌──────┴──┐ ┌┴───────────┐ ┌┴────────────┐
│ Claude  │ │NullProvider│ │ Future      │
│  API    │ │ (fallback) │ │ Provider    │
└─────────┘ └────────────┘ └─────────────┘
```

### Parallel Service: NarrativeService

```
┌────────────────────────────────────────────────────────────────┐
│                    NarrativeService                             │
│                                                                │
│  explainRisk()  ──►  AI explain({kind:'risk_finding'})         │
│  explainRemediation()  ──►  AI explain({kind:'remediation'})   │
│  explainAttackPath()  ──►  AI explain({kind:'attack_path'})    │
│                                                                │
│  Each method: try AI provider → fallback to deterministic      │
│  template. Callers ALWAYS receive a non-empty string.          │
└────────────────────────────────────────────────────────────────┘
```

## PII Redaction Pipeline

### Implementation: `RedactionService`

The `RedactionService` (`modules/redaction-engine/redaction.service.ts`) provides deterministic PII redaction for both the AI layer (pre-send scrubbing) and DSAR response packages (third-party PII removal).

Before any data is sent to an external LLM, the `ClaudeAIProvider` passes every outbound string through `redactionService.redactText()`:

1. **Detect PII** using 12 regex patterns: `email`, `phone`, `ssn`, `credit_card` (with Luhn validation), `ipv4`, `ipv6`, `iban`, `aadhaar`, `pan`, `passport`, `mac_address`, `date_of_birth`
2. **Replace with `[REDACTED:TYPE]`** format — e.g., `[REDACTED:EMAIL]`, `[REDACTED:AADHAAR]`
3. **Send redacted text** to LLM
4. **Fail closed** — if redaction itself throws, the provider sends `[REDACTED:ENGINE_ERROR]` instead of raw text

```typescript
interface RedactionResult {
  redactedText: string;
  matches: RedactionMatch[];
  categoriesFound: Record<string, number>;
}

interface RedactionMatch {
  type: string;       // e.g., 'email', 'aadhaar', 'credit_card'
  start: number;
  end: number;
  original: string;
  replacement: string; // e.g., '[REDACTED:EMAIL]'
}

// Example
// Input:  "rahul@example.com, Aadhaar: 9876 5432 1098, card 4111111111111111"
// Output: "[REDACTED:EMAIL], Aadhaar: [REDACTED:AADHAAR], card [REDACTED:CREDIT_CARD]"
```

Additional capabilities:
- `redactJson()` — recursively walks arbitrary JSON structures, redacting string values while preserving keys
- `preserve` option — allows DSAR callers to pass the subject's own identifiers so they are not masked in their own data export
- `categories` filter — selectively redact only specific PII types
- 5 MB text input cap with truncation warning

## Model Configuration

### Current Implementation

The `ClaudeAIProvider` uses a **single configurable model** for all AI calls, set via environment variable:

| Env Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | (required) | API key — provider is inert without it |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` | Model ID for all calls |
| `ANTHROPIC_MAX_TOKENS` | `512` | Max output tokens per call |
| `CLAUDE_TIMEOUT_MS` | `10000` | Per-call AbortSignal timeout (ms) |

### Planned: Per-Use-Case Model Routing

| Use Case | Target Model | Reason |
|---|---|---|
| Classification suggestions | Claude Haiku 4.5 | Fast, cost-effective, high volume |
| Finding explanations | Claude Haiku 4.5 | Simple text generation |
| DPIA summaries | Claude Sonnet 4.6 | Balanced quality/cost |
| Breach notification drafts | Claude Sonnet 4.6 | Quality matters, legal context |
| Compliance mapping | Claude Sonnet 4.6 | Reasoning-heavy |
| Executive summaries | Claude Haiku 4.5 | Simple aggregation |

For self-hosted/air-gapped: Support open-source models via Ollama or vLLM.

## Prompt Safety

1. **System prompts** define strict boundaries:
   - "You are a privacy compliance assistant. Only provide suggestions related to data privacy and security."
   - "Never include real personal data in your responses."
   - "Always indicate uncertainty and recommend human review."
2. **Input validation**: Reject prompts that exceed length limits or contain injection patterns
3. **Output validation**: Check responses for PII leakage before displaying
4. **No user-facing free-form prompt**: All AI interactions use pre-defined templates with variable substitution

## Prompt Template Example

```typescript
const CLASSIFICATION_SUGGESTION_PROMPT = `
You are a data classification assistant for a privacy compliance platform.

Given the following column metadata from a database table, suggest the most appropriate
classification label from the provided taxonomy.

Table: {{tableName}}
Column: {{columnName}}
Data Type: {{dataType}}
Sample Values (redacted): {{redactedSamples}}
Existing Labels in Use: {{taxonomyLabels}}

Respond with a JSON object:
{
  "suggested_label": "label_name",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

If uncertain, set confidence below 0.5 and explain why.
`;
```

## Auditability

### CoPilot Conversation Records

Every Co-Pilot query is persisted in the `co_pilot_conversations` table:

```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "userId": "uuid",
  "sessionId": "session-uuid",
  "query": "What are my top risks?",
  "intent": "risk_query",
  "entities": { ... },
  "filters": { ... },
  "context": { ... },
  "response": "Found 23 risk findings across 4 severity levels...",
  "latencyMs": 320,
  "feedback": null,
  "createdAt": "2025-03-10T10:00:00Z"
}
```

An `audit.log` entry (`copilot.query` action) is emitted for every query with intent and latency.

### Prometheus Metrics (AI-specific)

| Metric | Type | Labels | Description |
|---|---|---|---|
| `ai_call_total` | Counter | `tenant_id`, `provider`, `method`, `status` | Total AI provider calls (success/error/empty) |
| `ai_call_duration_seconds` | Histogram | `tenant_id`, `provider`, `method` | Call latency distribution |
| `ai_circuit_state` | Gauge | `provider` | Circuit breaker state (1=open, 0=closed) |

## Circuit Breaker

The `ClaudeAIProvider` implements a fail-fast circuit breaker to prevent cascading failures when the upstream LLM is unavailable:

| Parameter | Value | Description |
|---|---|---|
| Failure Threshold | 5 consecutive failures | Opens the circuit |
| Cooldown Window | 60 seconds | Duration the circuit stays open |
| Recovery | Automatic | `isAvailable()` returns `false` while open; first call after cooldown attempts reset |

Behavior when circuit is open:
- `isAvailable()` returns `false`
- `summarize()` and `explain()` return `null` immediately (no network call)
- `CoPilotService.enrichResponse()` falls back to deterministic template
- `NarrativeService` falls back to deterministic template
- Circuit state is emitted to Prometheus (`ai_circuit_state` gauge)

## Licensing Gate

LLM enrichment is gated per-tenant via the `LicensingService`:

1. `CoPilotService.enrichResponse()` checks `licensing.hasAnyFeature(tenantId, ['ai_llm_enrichment'])`
2. If the tenant does **not** have `ai_llm_enrichment` enabled, the template response is returned — no data is sent externally
3. If the licensing check itself **throws**, the service fails closed and returns the template response
4. This is separate from the `ai_copilot` feature flag that gates the entire Co-Pilot endpoint

```
Request flow:
  ai_copilot feature? ──No──► 403 Forbidden
       │Yes
  ai_llm_enrichment? ──No──► Template response (no LLM call)
       │Yes
  Circuit open? ──Yes──► Template response (no LLM call)
       │No
  Call LLM ──Error──► Template response (fallback)
       │Success
  Return enriched response
```

## NarrativeService

The `NarrativeService` (`modules/co-pilot/narrative.service.ts`) generates human-readable explanations independently of the Co-Pilot query flow:

| Method | AI Kind | Deterministic Fallback |
|---|---|---|
| `explainRisk(finding)` | `risk_finding` | Template with title, entity, severity, score, category |
| `explainRemediation(plan)` | `remediation_plan` | Template with action count, approval status, confidence |
| `explainAttackPath(path)` | `attack_path` | Template with severity, score, entry/target, step count |

- Each method tries the AI provider first; if unavailable or returns `null`, the deterministic template fires
- Callers **always** receive a non-empty string — no error propagation
- Injected via `@Optional()` — modules that use it degrade gracefully if it's not in the DI container

## Where AI Should NOT Be Trusted Automatically

1. **Legal determinations** — Whether a breach requires notification (legal review required)
2. **Data deletion decisions** — AI can suggest, but human must approve deletion
3. **Regulatory mappings** — AI suggestions must be reviewed by compliance team
4. **DSAR response content** — AI can draft, but human must review every response
5. **Risk scoring overrides** — AI can recommend, but scores need human validation
6. **Evidence sufficiency** — AI cannot determine if evidence is legally sufficient

## Cost Management

- Cache identical queries (Redis, 24-hour TTL)
- Use smaller models (Haiku) for high-volume, simple tasks — default model is `claude-haiku-4-5-20251001`
- Batch requests where possible
- Per-tenant AI usage tracking via Prometheus metrics (`ai_call_total` counter with `tenant_id` label)
- AI features are an opt-in add-on, not mandatory — gated by `ai_llm_enrichment` feature flag per tenant
- `ANTHROPIC_MAX_TOKENS` capped at 512 by default to limit cost per call
- Circuit breaker prevents runaway retries against a failing upstream
