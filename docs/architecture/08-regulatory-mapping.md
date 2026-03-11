# Section 8 — Regulatory & Control Framework

## Regulation → Obligation → Control → Evidence Hierarchy

```
Regulation (e.g., DPDP Act 2023)
  └── Obligation (e.g., Section 8 - Consent Requirements)
       └── Control (e.g., CTRL-CM-001 - Consent Capture Mechanism)
            └── Evidence (e.g., Consent notice published, consent records, audit log)
```

## DPDP Act (India) — Key Obligation Mapping

**IMPORTANT: This mapping is for platform design purposes. All obligations require legal review before use in production compliance workflows.**

| DPDP Section | Obligation Summary | Platform Module | Controls |
|---|---|---|---|
| Section 4 | Consent for processing personal data | Consent Management | Consent capture, notice, revocation |
| Section 5 | Notice to Data Principal | Consent Management | Notice designer, versioning |
| Section 6 | Lawful purposes | Consent, RoPA | Purpose registry, lawful basis mapping |
| Section 7 | General obligations of Data Fiduciary | Multiple | Data security, accuracy, retention |
| Section 8 | Additional obligations of Significant Data Fiduciary | DPIA, DPO Module | DPIA, DPO appointment, audit |
| Section 9 | Obligations regarding data processor | TPRM | Vendor contracts, DPA management |
| Section 11 | Rights of Data Principal | DSAR | Access, correction, erasure, grievance |
| Section 12 | Right to correction, erasure | DSAR | Correction/deletion workflows |
| Section 15 | Exemptions | Policy Management | Exemption tracking |
| Section 16 | Cross-border transfer restrictions | Cross-border Module | Transfer register, safeguards |
| Section 17 | Consent for children | Consent Management | Age verification, parental consent |

## GDPR — Key Obligation Mapping

| GDPR Article | Obligation | Platform Module | Controls |
|---|---|---|---|
| Art 5 | Processing principles | RoPA, Classification | Purpose limitation, data minimization |
| Art 6 | Lawfulness of processing | Consent, RoPA | Lawful basis documentation |
| Art 7 | Conditions for consent | Consent Management | Consent mechanism, withdrawal |
| Art 12-22 | Data subject rights | DSAR | Access, rectification, erasure, portability |
| Art 25 | Data protection by design | Privacy-by-Design | PbD checklists, review workflow |
| Art 28 | Processor obligations | TPRM | DPA, processor controls |
| Art 30 | Records of processing | RoPA | Processing register |
| Art 32 | Security of processing | DSPM, Policy | Security controls, risk assessment |
| Art 33 | Breach notification (DPA) | Breach Module | 72-hour notification workflow |
| Art 34 | Breach notification (subject) | Breach Module | Subject notification workflow |
| Art 35 | DPIA | DPIA Module | Assessment templates, workflow |
| Art 44-49 | Cross-border transfers | Cross-border Module | Transfer mechanisms, TIA |

## ISO 27701 Alignment

| ISO 27701 Clause | Mapping | Platform Module |
|---|---|---|
| 5.2 | Privacy policy | Policy Management |
| 6.2 | Conditions for collection | Consent Management |
| 6.3 | Accuracy and quality | Data Governance |
| 6.4 | PII minimization | Classification, Retention |
| 6.5 | PII de-identification | Classification |
| 7.2 | Purposes identification | RoPA, Consent |
| 7.3 | Consent management | Consent Management |
| 7.4 | PII processing records | RoPA |
| 7.5 | Privacy impact assessment | DPIA |
| 8.2 | Transfer mechanisms | Cross-border Module |

## ISO 27001 Control Linkage

The platform's control library includes mappings to ISO 27001:2022 Annex A controls where applicable:
- A.5 Organizational controls → Policy Management
- A.6 People controls → RBAC, access reviews
- A.7 Physical controls → Out of scope (document only)
- A.8 Technological controls → DSPM, Encryption posture, Access analysis

## CERT-In Readiness (Assumption: Cyber Security Directions April 2022)

| Requirement | Platform Support |
|---|---|
| 6-hour incident reporting | Breach Module: SLA timer set to 6 hours |
| Maintain logs for 180 days | Audit Trail: configurable retention, OpenSearch |
| Synchronized system clocks | Infrastructure: NTP configuration |
| Designate point of contact | Admin: SPOC configuration |

## Reusable Control Library Structure

```json
{
  "code": "CTRL-CM-001",
  "title": "Consent Capture Mechanism",
  "category": "consent_management",
  "description": "Implement a mechanism to capture explicit, informed, and freely given consent from data subjects before processing personal data.",
  "implementation_guidance": "Deploy consent capture API/widget. Ensure notice is clear, specific to purposes, and records proof.",
  "mapped_obligations": [
    { "regulation": "DPDP", "reference": "Section 4" },
    { "regulation": "GDPR", "reference": "Article 7" },
    { "regulation": "ISO27701", "reference": "7.3.1" }
  ],
  "evidence_types": ["consent_records", "consent_notice", "consent_analytics"],
  "testing_procedure": "Verify consent is captured before processing. Verify withdrawal mechanism works.",
  "frequency": "continuous"
}
```

## India-First Compliance Presets

When a tenant selects "India" as primary jurisdiction:
- Enable DPDP Act regulation with all obligations
- Enable CERT-In incident reporting rules
- Set breach notification SLA to 6 hours (CERT-In) + DPDP Board timeline
- Enable Aadhaar, PAN, GSTIN classification patterns
- Set default data residency to India
- Pre-configure RoPA template for DPDP Act requirements
- Enable consent requirements per DPDP Section 4

## Privacy Maturity Scoring Model

Score the organization across 5 domains, each 0-100:

| Domain | Weight | Inputs |
|---|---|---|
| Data Visibility | 20% | % data sources connected, % assets classified, data map completeness |
| Privacy Operations | 25% | DSAR SLA compliance, consent coverage, RoPA completeness |
| Risk Management | 20% | DPIA coverage, open risk findings, vendor risk assessments |
| Compliance | 20% | Compliance scorecard, gap closure rate, evidence coverage |
| Incident Readiness | 15% | Breach response time, notification compliance, tabletop exercises |

**Overall Maturity Score** = Weighted average across domains

**Maturity Levels**:
- 0-20: Initial (ad hoc)
- 21-40: Developing (some processes)
- 41-60: Defined (documented processes)
- 61-80: Managed (measured and tracked)
- 81-100: Optimizing (continuous improvement)
