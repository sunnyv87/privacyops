# SOP-003: Data Breach Notification

**Document ID:** SOP-PRIVACYOPS-BN-003
**Version:** 1.0
**Classification:** Internal - Confidential
**Last Review:** 2026-05-10
**Next Review:** 2026-11-10
**Owner:** Data Protection Officer

---

## 1. Purpose

Define the procedure for detecting, assessing, documenting, and notifying stakeholders of personal data breaches originating from or detected by the TechD PrivacyOps platform. This SOP ensures compliance with GDPR 72-hour notification, CERT-In 6-hour reporting, DPDP Act requirements, US state breach notification laws, and contractual obligations to tenants.

## 2. Scope

Covers breaches involving:
- Personal data processed through any of the 43 registered connectors
- Tenant configuration or credential data stored in PostgreSQL
- Data in transit through NATS JetStream event bus
- Data subject records managed by DSAR, consent, or retention modules
- Cross-tenant data exposure due to RLS or tenant isolation failures
- AI co-pilot context leakage (PII redaction failure)
- Connector credential compromise leading to downstream data exposure

## 3. Roles & Responsibilities

| Role | Responsibility |
|------|---------------|
| Data Protection Officer (DPO) | Breach determination, regulatory notification authority |
| Incident Commander | Coordinates technical response (per SOP-001) |
| Privacy Operations Lead | Stakeholder communication, documentation |
| Legal Counsel | Regulatory filing preparation, liability assessment |
| Platform Engineering | Scope assessment, technical containment |
| Tenant Success Manager | Tenant notification and support |
| Communications Lead | External communications, media response |

## 4. Prerequisites

- Incident classified as potential data breach per SOP-001 (P1 or P2)
- IncidentsService operational with breach notification deadline calculation
- Temporal `BREACH` task queue worker running with activities:
  - `assessBreachScope`, `prepareNotification`, `notifyRegulator`, `notifyDataSubjects`, `notifyInternalTeam`
- Regulatory contact registry maintained (DPAs, CERT-In, state AGs)
- Breach notification templates pre-approved by Legal Counsel
- NATS JetStream DLQ monitored for breach-related event failures

## 5. Procedure

### 5.1 Breach Detection & Initial Assessment

1. **Detection Triggers**
   1.1. Security incident escalated to breach investigation (from SOP-001)
   1.2. NATS event `privacyops.security.breach_detected` published by:
        - AuditService detecting `unauthorized_access` + `data_export` sequence
        - ConnectorHealthService reporting unauthorized data access
        - RedactionService fail-closed trigger on data export
   1.3. External notification from tenant, connector vendor, or threat intelligence
   1.4. Compliance scan detecting exposed data (DSPM module finding)

2. **Breach Determination (within 1 hour)**
   2.1. DPO assesses whether incident constitutes a personal data breach:
        - Was personal data involved? (Check classification labels from ClassificationEngine)
        - Was data actually accessed, disclosed, or lost? (Review audit logs)
        - Is confidentiality, integrity, or availability compromised?
   2.2. Create incident record via IncidentsService:
        - Reference number: `INC-YYYY-NNNN`
        - Breach notification deadlines auto-calculated:
          - GDPR: `reportedAt + 72 hours`
          - CERT-In: `reportedAt + 6 hours`
   2.3. If NOT a breach: Document determination rationale, close assessment
   2.4. If breach confirmed: Proceed to scope assessment

### 5.2 Scope Assessment

3. **Temporal Breach Workflow Initiated**
   3.1. `breachNotificationWorkflow` started on `BREACH` task queue:
        ```typescript
        // Input: { incidentId, tenantId, severity, deadlineIso }
        ```
   3.2. `assessBreachScope` activity determines:
        - Number of affected data subjects
        - Categories of personal data involved (names, emails, financial, health, etc.)
        - Categories of data subjects (customers, employees, minors)
        - Geographic scope (EU residents, Indian citizens, US state residents)
        - Whether encryption was in place (check asset encryption status)
        - Whether data was actually accessed vs. merely exposed
        - Likely consequences for data subjects
   3.3. `notifyInternalTeam` activity immediately alerts:
        - DPO, Legal Counsel, Executive Sponsor
        - Via PlatformAlertService: email, Slack, in-app notification

4. **Multi-Tenant Impact Assessment**
   4.1. If breach involves platform infrastructure (not tenant-specific):
        - Query all tenants with data in affected systems
        - Assess per-tenant impact using RLS-filtered queries
        - Create separate breach records per affected tenant
   4.2. For connector credential breach:
        - Identify all tenants using the compromised connector type
        - Check `data_sources` table for active connections
        - Assess data flow through affected connector

### 5.3 Notification Timeline Management

5. **Regulatory Deadline Tracking**

   | Jurisdiction | Authority | Deadline | Trigger |
   |-------------|-----------|----------|---------|
   | EU/EEA (GDPR) | Lead Supervisory Authority | 72 hours from awareness | Risk to rights/freedoms |
   | India (CERT-In) | CERT-In | 6 hours from awareness | Any cyber incident |
   | India (DPDP Act) | Data Protection Board | As prescribed | Personal data breach |
   | California (CCPA) | State AG | Without unreasonable delay | >500 CA residents |
   | New York (SHIELD Act) | State AG | Without unreasonable delay | NY resident data |
   | Texas (TDPSA) | State AG | 60 days | >500 TX residents |
   | Colorado (CPA) | State AG | 30 days | CO resident data |
   | Virginia (VCDPA) | State AG | Without unreasonable delay | VA resident data |
   | Brazil (LGPD) | ANPD | Reasonable timeframe | Risk to data subjects |
   | South Africa (POPIA) | Information Regulator | As soon as reasonably possible | Compromised personal info |

   5.1. System tracks all applicable deadlines based on scope assessment
   5.2. Countdown timers displayed on incident dashboard via Socket.IO WebSocket push
   5.3. Escalation at 50%, 75%, and 90% of each deadline elapsed

### 5.4 Regulatory Notification

6. **GDPR Notification (72-hour deadline)**
   6.1. `prepareNotification` Temporal activity generates notification containing:
        - Nature of the breach
        - Categories and approximate number of data subjects
        - Categories and approximate number of data records
        - DPO contact details
        - Likely consequences
        - Measures taken or proposed
   6.2. DPO reviews and approves notification content
   6.3. `notifyRegulator` activity files notification with Lead Supervisory Authority
   6.4. If full details unavailable within 72 hours:
        - File preliminary notification with available information
        - Schedule supplementary notification within 30 days

7. **CERT-In Notification (6-hour deadline)**
   7.1. File mandatory incident report within 6 hours of awareness
   7.2. Include: System affected, type of incident, date/time, geographic scope
   7.3. Submit via CERT-In portal (https://www.cert-in.org.in)

8. **US State Notifications**
   8.1. Determine affected states based on data subject residency
   8.2. For each state exceeding notification threshold:
        - Prepare state-specific notification per statutory requirements
        - File with state Attorney General (if required by state law)
        - Prepare consumer notification letters
   8.3. For breaches affecting >500 residents in a single state:
        - Coordinate media notification if required (e.g., California)

### 5.5 Data Subject Notification

9. **Subject Notification Process**
   9.1. `notifyDataSubjects` Temporal activity triggered when:
        - `scope.affectedCount > 0 && scope.requiresSubjectNotification`
   9.2. Notification content (GDPR Art. 34):
        - Nature of the breach in clear, plain language
        - DPO contact information
        - Likely consequences
        - Measures taken to mitigate impact
        - Recommended protective actions
   9.3. Delivery via tenant-configured notification channels:
        - Email (primary)
        - In-app notification
        - SMS (for high-risk breaches)
   9.4. Track delivery status and maintain proof of notification
   9.5. For large-scale breaches (>10,000 subjects): Use public communication if individual notification is disproportionate effort

### 5.6 Tenant Notification

10. **Contractual Notification**
    10.1. Notify affected tenant(s) per Data Processing Agreement terms
    10.2. Provide tenant with:
          - Breach summary and timeline
          - Categories of affected data
          - Containment and remediation actions taken
          - Guidance for their own regulatory obligations
    10.3. Coordinate with tenant on data subject notification (if tenant is controller)
    10.4. Provide evidence package for tenant's own regulatory filing

### 5.7 Documentation & Regulatory Record

11. **Breach Register Entry**
    11.1. Maintain complete breach register in `incidents` table:
          - Facts of the breach (what happened)
          - Effects and consequences
          - Remediation actions taken
          - Notification decisions and rationale
          - Regulatory filing references
    11.2. Audit trail preserved via SHA256 hash chain (AuditService)
    11.3. All breach-related NATS events retained beyond standard 7-day retention
    11.4. Evidence package archived per retention policy (minimum 5 years)

12. **Post-Breach Review**
    12.1. Root cause analysis completed within 14 days
    12.2. Preventive measures identified and scheduled
    12.3. Platform security controls reviewed and updated
    12.4. Breach response process reviewed for improvements

## 6. Verification

- [ ] Breach determination documented with DPO sign-off
- [ ] Scope assessment completed (affected subjects, data categories, geography)
- [ ] All applicable regulatory deadlines identified and tracked
- [ ] CERT-In notification filed within 6 hours (if applicable)
- [ ] GDPR notification filed within 72 hours (if applicable)
- [ ] US state notifications filed per statutory requirements
- [ ] Data subjects notified where required
- [ ] Affected tenants notified per DPA terms
- [ ] Breach register updated with complete record
- [ ] Audit log hash chain verified for incident period
- [ ] Post-breach review scheduled

## 7. Rollback

Breach notifications cannot be retracted once filed. If a breach determination is later revised:
1. File supplementary notification with regulators correcting initial assessment
2. Notify data subjects of updated status
3. Update breach register with corrected information
4. Document rationale for revised determination
5. Retain original notifications as part of the record

## 8. Frequency

- **Breach response**: As triggered by incidents
- **Breach register review**: Monthly by DPO
- **Notification template review**: Quarterly
- **Regulatory contact registry update**: Quarterly
- **Breach simulation exercise**: Semi-annually
- **Deadline tracking system test**: Quarterly

## 9. References

- SOP-001: Incident Response
- SOP-002: DSAR Processing (for breach-triggered DSAR surge)
- SOP-011: Audit Log Review
- Architecture Doc: `docs/architecture/11-security-architecture.md`
- Source: `apps/api/src/modules/incidents/incidents.service.ts`
- Source: `apps/api/src/core/workflow/workflows/breach.workflow.ts`
- Source: `apps/api/src/core/events/event-bus.service.ts`

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | Data Protection Officer | Initial version |
| | | | |
| | | | |
