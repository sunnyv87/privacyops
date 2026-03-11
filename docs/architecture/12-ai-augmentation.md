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

```
┌──────────────────────────────────────────┐
│           AI Orchestration Service        │
│                                          │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │ PII Redactor │  │ Prompt Templates │  │
│  └─────────────┘  └──────────────────┘  │
│                                          │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │ Model Router │  │ Response Cache   │  │
│  └─────────────┘  └──────────────────┘  │
│                                          │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │ Audit Logger │  │ Rate Limiter     │  │
│  └─────────────┘  └──────────────────┘  │
└──────────┬───────────────────────────────┘
           │
     ┌─────┼─────────────┐
     │     │             │
┌────┴──┐ ┌┴─────────┐ ┌┴─────────┐
│Claude │ │Self-hosted│ │ Future   │
│  API  │ │  Model    │ │ Provider │
└───────┘ └──────────┘ └──────────┘
```

## PII Redaction Pipeline

Before any data is sent to external LLM:
1. **Detect PII** using classification patterns (regex, dictionary)
2. **Replace with placeholders**: `[EMAIL_1]`, `[NAME_1]`, `[AADHAAR_1]`
3. **Maintain mapping** for post-processing (in-memory only, never logged)
4. **Send redacted text** to LLM
5. **Re-substitute** placeholders in response if needed
6. **Discard mapping** after use

```typescript
interface RedactionResult {
  redactedText: string;
  placeholderMap: Map<string, string>; // [EMAIL_1] → actual email (in-memory only)
  piiTypesDetected: string[];
}

// Example
// Input: "Rahul Kumar (rahul@example.com, Aadhaar: 9876 5432 1098) accessed the system"
// Output: "[NAME_1] ([EMAIL_1], Aadhaar: [AADHAAR_1]) accessed the system"
```

## Model Routing Strategy

| Use Case | Model | Reason |
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

Every AI interaction is logged:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "type": "classification_suggestion",
  "model_id": "claude-haiku-4-5-20251001",
  "prompt_template": "CLASSIFICATION_SUGGESTION",
  "input_hash": "sha256_of_redacted_input",
  "output": { "suggested_label": "email_address", "confidence": 0.95 },
  "pii_types_redacted": ["email", "name"],
  "tokens_used": { "input": 150, "output": 45 },
  "latency_ms": 320,
  "status": "pending",
  "reviewed_by": null,
  "reviewed_at": null,
  "timestamp": "2025-03-10T10:00:00Z"
}
```

## Where AI Should NOT Be Trusted Automatically

1. **Legal determinations** — Whether a breach requires notification (legal review required)
2. **Data deletion decisions** — AI can suggest, but human must approve deletion
3. **Regulatory mappings** — AI suggestions must be reviewed by compliance team
4. **DSAR response content** — AI can draft, but human must review every response
5. **Risk scoring overrides** — AI can recommend, but scores need human validation
6. **Evidence sufficiency** — AI cannot determine if evidence is legally sufficient

## Cost Management

- Cache identical queries (Redis, 24-hour TTL)
- Use smaller models (Haiku) for high-volume, simple tasks
- Batch requests where possible
- Per-tenant AI usage tracking and limits
- AI features are an opt-in add-on, not mandatory
