# Section 9 — API Design

## Design Standards

### Base URL
```
https://api.privacyops.techd.com/api/v1
```

### Authentication
- Bearer token (JWT) for user sessions
- API key for machine-to-machine
- HMAC signature for webhooks

### Headers
```
Authorization: Bearer <jwt_token>
X-Tenant-Id: <tenant_id>           # Required for API key auth; derived from JWT for user auth
X-Request-Id: <uuid>                # Client-generated, used for idempotency
Content-Type: application/json
Accept: application/json
```

### Pagination
```json
// Request
GET /api/v1/findings?page=1&page_size=20&sort=created_at&order=desc

// Response envelope
{
  "data": [...],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 342,
    "total_pages": 18,
    "has_next": true,
    "has_previous": false
  }
}
```

### Filtering
```
GET /api/v1/findings?severity=critical,high&status=open&category=exposure&created_after=2025-01-01
```

### Error Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ],
    "request_id": "uuid-request-id"
  }
}
```

### Error Codes
| HTTP Status | Code | Description |
|---|---|---|
| 400 | VALIDATION_ERROR | Request validation failed |
| 401 | UNAUTHORIZED | Missing or invalid auth |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Conflict (duplicate, state conflict) |
| 422 | UNPROCESSABLE | Business rule violation |
| 429 | RATE_LIMITED | Rate limit exceeded |
| 500 | INTERNAL_ERROR | Server error |

### Rate Limiting
- Default: 100 requests/minute per API key
- Bulk endpoints: 10 requests/minute
- Consent validation: 1000 requests/minute (high-frequency)
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Versioning
- URL-based: `/api/v1/`, `/api/v2/`
- Breaking changes require version bump
- Deprecation: 6-month notice with `Sunset` header

### Idempotency
- POST requests support `X-Request-Id` header
- Same request ID within 24 hours returns cached response
- Stored in Redis with 24-hour TTL

## Service Boundaries

| Service | URL Prefix | Responsibility |
|---|---|---|
| Auth | /api/v1/auth | Authentication, session management |
| Tenants | /api/v1/tenants | Tenant management |
| Users | /api/v1/users | User CRUD, roles |
| Connectors | /api/v1/connectors | Data source management |
| Scans | /api/v1/scans | Scan job management |
| Assets | /api/v1/assets | Asset/data catalog |
| Classifications | /api/v1/classifications | Classification management |
| Findings | /api/v1/findings | Risk findings |
| Consent | /api/v1/consent | Consent management |
| DSAR | /api/v1/dsar | Data subject requests |
| Assessments | /api/v1/assessments | DPIA/PIA |
| Incidents | /api/v1/incidents | Breach/incident management |
| Retention | /api/v1/retention | Retention policies |
| Vendors | /api/v1/vendors | Vendor management |
| Compliance | /api/v1/compliance | Compliance automation |
| Controls | /api/v1/controls | Control library |
| RoPA | /api/v1/ropa | Processing activities |
| Evidence | /api/v1/evidence | Evidence artifacts |
| AI | /api/v1/ai | AI recommendations |
| Dashboard | /api/v1/dashboard | Dashboard data |
| Audit | /api/v1/audit | Audit logs |

## Webhook Design

### Outbound Webhooks
Tenants configure webhook endpoints to receive platform events.

```json
// Webhook registration
POST /api/v1/webhooks
{
  "url": "https://customer.example.com/webhooks/privacyops",
  "events": ["finding.created", "breach.confirmed", "dsar.submitted"],
  "secret": "whsec_customer_provided_secret"
}

// Webhook payload
{
  "id": "evt_uuid",
  "type": "finding.created",
  "timestamp": "2025-03-10T14:30:00Z",
  "tenant_id": "uuid",
  "data": {
    "finding_id": "uuid",
    "severity": "critical",
    "title": "Publicly accessible S3 bucket with PII"
  }
}
```

Webhook delivery:
- HMAC-SHA256 signature in `X-Webhook-Signature` header
- Retry on failure: 3 attempts with exponential backoff (30s, 5m, 30m)
- Delivery log accessible via API

### Internal Events (NATS Subjects)

```
privacyops.connector.created
privacyops.connector.tested
privacyops.scan.started
privacyops.scan.completed
privacyops.scan.failed
privacyops.asset.discovered
privacyops.asset.updated
privacyops.classification.completed
privacyops.classification.label.assigned
privacyops.finding.created
privacyops.finding.updated
privacyops.finding.resolved
privacyops.risk.score.changed
privacyops.consent.granted
privacyops.consent.revoked
privacyops.dsar.submitted
privacyops.dsar.verified
privacyops.dsar.completed
privacyops.dsar.overdue
privacyops.incident.created
privacyops.breach.confirmed
privacyops.notification.due
privacyops.retention.policy.violated
privacyops.retention.deletion.completed
privacyops.assessment.submitted
privacyops.assessment.approved
privacyops.vendor.assessment.due
privacyops.compliance.gap.detected
```

## Sample API Contracts

### Create Connector
```
POST /api/v1/connectors

Request:
{
  "name": "Production AWS Account",
  "type": "aws_s3",
  "auth_method": "iam_role",
  "config": {
    "role_arn": "arn:aws:iam::123456789:role/TechDDSPMRole",
    "external_id": "techd-abc123",
    "regions": ["ap-south-1"]
  },
  "scan_schedule": "0 2 * * 1",
  "tags": ["production", "india"]
}

Response (201):
{
  "data": {
    "id": "uuid",
    "name": "Production AWS Account",
    "type": "aws_s3",
    "status": "pending_setup",
    "created_at": "2025-03-10T10:00:00Z"
  }
}
```

### Launch Scan
```
POST /api/v1/scans

Request:
{
  "data_source_id": "uuid",
  "type": "full",
  "config": {
    "sample_size": 1000,
    "include_content_sampling": true,
    "classification_policies": ["default", "india-pii"]
  }
}

Response (202):
{
  "data": {
    "id": "uuid",
    "status": "queued",
    "estimated_duration_minutes": 30
  }
}
```

### Fetch Findings
```
GET /api/v1/findings?severity=critical,high&status=open&page=1&page_size=20

Response (200):
{
  "data": [
    {
      "id": "uuid",
      "title": "Publicly accessible S3 bucket contains Aadhaar numbers",
      "severity": "critical",
      "category": "exposure",
      "risk_score": 95.0,
      "status": "open",
      "asset": {
        "id": "uuid",
        "name": "customer-data-bucket",
        "type": "bucket",
        "data_source": "Production AWS Account"
      },
      "classifications": ["aadhaar_number", "email", "phone"],
      "remediation_guidance": "Remove public access, enable bucket policy to restrict to VPC endpoint only",
      "created_at": "2025-03-10T02:30:00Z"
    }
  ],
  "pagination": { "page": 1, "page_size": 20, "total_items": 5 }
}
```

### Create Consent Record
```
POST /api/v1/consent/records

Request:
{
  "subject_identifier": "user@example.com",
  "notice_id": "uuid",
  "purposes": [
    { "purpose_id": "uuid-marketing", "granted": true },
    { "purpose_id": "uuid-analytics", "granted": false },
    { "purpose_id": "uuid-service", "granted": true }
  ],
  "channel": "web",
  "metadata": {
    "page_url": "https://example.com/signup",
    "ip_address": "203.0.113.1"
  }
}

Response (201):
{
  "data": {
    "id": "uuid",
    "consent_receipt": {
      "receipt_id": "CR-2025-00123",
      "granted_purposes": ["uuid-marketing", "uuid-service"],
      "denied_purposes": ["uuid-analytics"],
      "notice_version": 3,
      "timestamp": "2025-03-10T10:00:00Z"
    }
  }
}
```

### Submit DSAR
```
POST /api/v1/dsar/requests

Request:
{
  "type": "access",
  "requestor": {
    "name": "Rahul Kumar",
    "email": "rahul@example.com",
    "relationship": "self"
  },
  "details": "Please provide all personal data you hold about me"
}

Response (201):
{
  "data": {
    "id": "uuid",
    "reference_number": "DSAR-2025-00042",
    "status": "submitted",
    "due_date": "2025-04-09T10:00:00Z",
    "next_step": "identity_verification",
    "verification_link": "https://portal.privacyops.techd.com/dsar/verify/token123"
  }
}
```

### Record Breach
```
POST /api/v1/incidents

Request:
{
  "title": "Customer database unauthorized access",
  "severity": "high",
  "detected_at": "2025-03-10T14:30:00Z",
  "description": "Security monitoring detected unauthorized queries against customer database from unknown IP",
  "initial_assessment": {
    "personal_data_involved": true,
    "data_types": ["email", "name", "phone", "address"],
    "estimated_records": 25000,
    "affected_systems": ["data-source-uuid"]
  }
}

Response (201):
{
  "data": {
    "id": "uuid",
    "reference_number": "INC-2025-00007",
    "status": "reported",
    "severity": "high",
    "notification_deadlines": [
      { "authority": "CERT-In", "deadline": "2025-03-10T20:30:00Z", "hours_remaining": 6 },
      { "authority": "DPDP Board", "deadline": "TBD", "note": "Timeline per Board rules" }
    ]
  }
}
```

### Generate Compliance Report
```
POST /api/v1/compliance/reports

Request:
{
  "regulation_id": "uuid-dpdp",
  "format": "pdf",
  "include_evidence": true,
  "scope": "full"
}

Response (202):
{
  "data": {
    "report_id": "uuid",
    "status": "generating",
    "estimated_completion": "2025-03-10T10:05:00Z"
  }
}
```

### Create Retention Policy
```
POST /api/v1/retention/policies

Request:
{
  "name": "Customer Transaction Records",
  "record_category": "financial_transactions",
  "retention_period_days": 2555,
  "action_on_expiry": "archive",
  "legal_basis": "Income Tax Act Section 44AA - 7 year retention",
  "applicable_regulations": ["income_tax_act", "gst_act"],
  "applies_to": {
    "asset_tags": ["transactions", "payments"],
    "data_source_types": ["postgresql", "mysql"]
  }
}

Response (201):
{
  "data": {
    "id": "uuid",
    "name": "Customer Transaction Records",
    "status": "active",
    "affected_assets_count": 12
  }
}
```

### Create RoPA Entry
```
POST /api/v1/ropa

Request:
{
  "title": "Employee Payroll Processing",
  "processing_purpose": "Calculate and distribute employee salaries, statutory deductions, and tax reporting",
  "lawful_basis": "contract",
  "data_subject_categories": ["employees", "contractors"],
  "personal_data_categories": ["name", "address", "pan_number", "bank_account", "salary", "tax_id"],
  "recipients": [
    { "name": "Payroll Provider", "type": "processor", "country": "India" },
    { "name": "Income Tax Department", "type": "authority", "country": "India" }
  ],
  "retention_period": "8 years after employment ends (statutory requirement)",
  "security_measures": "Encrypted database, RBAC, audit logging, annual access review",
  "owner_id": "uuid-hr-manager"
}

Response (201):
{
  "data": {
    "id": "uuid",
    "title": "Employee Payroll Processing",
    "status": "draft"
  }
}
```
