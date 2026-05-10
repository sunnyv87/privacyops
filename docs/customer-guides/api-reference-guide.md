# TechD PrivacyOps + DSPM -- API Reference Guide

This guide covers the TechD PrivacyOps REST API for programmatic integration, including authentication, base URL conventions, pagination, common endpoints, request/response examples, rate limits, webhooks, and error codes.

---

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Base URL and Versioning](#base-url-and-versioning)
4. [Pagination](#pagination)
5. [Common Endpoints](#common-endpoints)
6. [Scans API](#scans-api)
7. [DSAR API](#dsar-api)
8. [Consent API](#consent-api)
9. [Remediation API](#remediation-api)
10. [Incidents API](#incidents-api)
11. [Dashboard API](#dashboard-api)
12. [Rate Limits](#rate-limits)
13. [Webhooks](#webhooks)
14. [Error Codes](#error-codes)

---

## API Overview

The PrivacyOps API is a RESTful JSON API that provides programmatic access to all platform capabilities. Use it to integrate PrivacyOps with your existing workflows, build custom dashboards, automate DSAR intake, trigger remediations, and extract data for external reporting.

### Key Characteristics

- **Protocol:** HTTPS only (TLS 1.2+)
- **Format:** JSON request and response bodies
- **Authentication:** JWT bearer tokens
- **Documentation:** Interactive Swagger/OpenAPI docs available at `/api/docs` (non-production environments)

---

## Authentication

All API requests (except public auth endpoints) require a JWT bearer token in the `Authorization` header.

### Obtaining a Token

**POST** `/api/v1/auth/login`

Request:

```json
{
  "email": "analyst@yourcompany.com",
  "password": "your-password"
}
```

Response:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

### Using the Token

Include the access token in every subsequent request:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Refreshing a Token

**POST** `/api/v1/auth/refresh`

Request:

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

Response: Same structure as the login response with a new access token.

### MFA-Enabled Accounts

If the user has MFA enabled, the login response includes an `mfaRequired: true` flag. Submit the TOTP code in a follow-up request:

**POST** `/api/v1/auth/mfa/verify`

```json
{
  "tempToken": "temporary-token-from-login",
  "totpCode": "123456"
}
```

---

## Base URL and Versioning

All endpoints use the prefix `/api/v1/`. The full base URL is:

```
https://yourcompany.privacyops.techd.io/api/v1
```

The API is versioned in the URL path. The current version is `v1`. When a new major version is released, the previous version remains available for a documented deprecation period.

---

## Pagination

List endpoints return paginated results. Use these query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-based) |
| `limit` | integer | 20 | Items per page (max: 100) |
| `sortBy` | string | varies | Field name to sort by |
| `sortOrder` | string | `asc` | Sort direction: `asc` or `desc` |

### Paginated Response Structure

```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 142,
    "totalPages": 8
  }
}
```

---

## Common Endpoints

### Connectors

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/connectors` | List all connectors |
| GET | `/connectors/:id` | Get connector details |
| POST | `/connectors` | Create a new connector |
| PUT | `/connectors/:id` | Update a connector |
| DELETE | `/connectors/:id` | Delete a connector |
| POST | `/connectors/:id/test` | Test connector connectivity |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | List tenant users |
| GET | `/users/:id` | Get user details |
| POST | `/users/invite` | Invite a new user |
| PUT | `/users/:id` | Update user profile |
| DELETE | `/users/:id` | Deactivate a user |

### Classification

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/classification/labels` | List classification labels |
| GET | `/classification/reviews` | List pending classification reviews |
| PUT | `/classification/reviews/:id` | Approve or reject a classification |

---

## Scans API

### Trigger a Scan

**POST** `/api/v1/scans`

Request:

```json
{
  "connectorId": "conn_abc123",
  "scanType": "full",
  "samplingRate": 25
}
```

Response:

```json
{
  "id": "scan_xyz789",
  "connectorId": "conn_abc123",
  "status": "queued",
  "scanType": "full",
  "samplingRate": 25,
  "createdAt": "2026-05-10T14:30:00Z"
}
```

### Get Scan Status

**GET** `/api/v1/scans/:id`

Response:

```json
{
  "id": "scan_xyz789",
  "connectorId": "conn_abc123",
  "status": "completed",
  "scanType": "full",
  "assetsDiscovered": 347,
  "classificationsApplied": 289,
  "startedAt": "2026-05-10T14:30:05Z",
  "completedAt": "2026-05-10T14:42:18Z",
  "duration": 733
}
```

### List Scan History

**GET** `/api/v1/scans?connectorId=conn_abc123&page=1&limit=10`

---

## DSAR API

### Create a DSAR

**POST** `/api/v1/dsar`

Request:

```json
{
  "subjectName": "Jane Smith",
  "subjectEmail": "jane.smith@example.com",
  "subjectPhone": "+1-555-0123",
  "requestType": "access",
  "regulation": "GDPR",
  "description": "I would like a copy of all personal data you hold about me."
}
```

Response:

```json
{
  "id": "dsar_def456",
  "subjectName": "Jane Smith",
  "requestType": "access",
  "regulation": "GDPR",
  "status": "submitted",
  "slaDeadline": "2026-06-09T14:30:00Z",
  "createdAt": "2026-05-10T14:30:00Z"
}
```

### List DSARs

**GET** `/api/v1/dsar?status=submitted&page=1&limit=20`

### Get DSAR Details

**GET** `/api/v1/dsar/:id`

### Update DSAR Status

**PATCH** `/api/v1/dsar/:id`

```json
{
  "status": "verified"
}
```

### Identity Match

**POST** `/api/v1/dsar/identity-match`

```json
{
  "email": "jane.smith@example.com",
  "name": "Jane Smith",
  "phone": "+1-555-0123"
}
```

Response returns matched records with confidence scores across connected data sources.

### Download DSAR Package

**GET** `/api/v1/dsar/:id/download`

Returns the compiled response package as a ZIP file.

---

## Consent API

### Record Consent

**POST** `/api/v1/consent/records`

```json
{
  "subjectId": "user_123",
  "purpose": "marketing_communications",
  "status": "given",
  "source": "web_form",
  "metadata": {
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
}
```

### List Consent Records

**GET** `/api/v1/consent/records?subjectId=user_123`

### Withdraw Consent

**PATCH** `/api/v1/consent/records/:id`

```json
{
  "status": "withdrawn",
  "withdrawalReason": "No longer interested"
}
```

### Public Consent Endpoint

For unauthenticated consent collection (e.g., cookie banners):

**POST** `/api/v1/consent/public/record`

Headers:

```
X-Tenant-Id: your-tenant-id
X-Consent-Signature: hmac-sha256-signature
```

The signature is computed over the request body using your `CONSENT_PUBLIC_SHARED_SECRET`.

### List Purposes

**GET** `/api/v1/consent/purposes`

---

## Remediation API

### List Findings

**GET** `/api/v1/remediation/findings?severity=critical&status=open`

### Get Finding Details

**GET** `/api/v1/remediation/findings/:id`

### Execute Remediation

**POST** `/api/v1/remediation/execute`

```json
{
  "findingId": "finding_ghi789",
  "actionType": "revoke_access",
  "confirm": true
}
```

Response:

```json
{
  "id": "rem_action_001",
  "findingId": "finding_ghi789",
  "actionType": "revoke_access",
  "executionMode": "native",
  "status": "completed",
  "details": {
    "actionsPerformed": ["REVOKE SELECT ON customers FROM excessive_role"],
    "rollbackAvailable": true
  },
  "executedAt": "2026-05-10T15:00:00Z"
}
```

### Rollback Remediation

**POST** `/api/v1/remediation/rollback`

```json
{
  "remediationActionId": "rem_action_001"
}
```

---

## Incidents API

### Create Incident

**POST** `/api/v1/incidents`

```json
{
  "title": "Unauthorized access to customer database",
  "description": "Anomalous query patterns detected on production PostgreSQL cluster.",
  "severity": "high",
  "discoveredAt": "2026-05-10T12:00:00Z",
  "affectedDataTypes": ["email", "name", "phone"],
  "estimatedSubjectsAffected": 5000
}
```

### List Incidents

**GET** `/api/v1/incidents?status=investigating&page=1&limit=10`

### Update Incident Status

**PATCH** `/api/v1/incidents/:id`

```json
{
  "status": "contained",
  "containmentActions": "Revoked compromised credentials and blocked source IP."
}
```

---

## Dashboard API

### Get Dashboard Summary

**GET** `/api/v1/dashboard/summary`

Response:

```json
{
  "complianceScore": 87.5,
  "openFindings": {
    "critical": 2,
    "high": 14,
    "medium": 38,
    "low": 91
  },
  "activeDsars": 7,
  "pendingConsents": 12,
  "openIncidents": 1,
  "dataAssets": {
    "total": 1247,
    "classified": 1102,
    "unclassified": 145
  }
}
```

### Get Compliance Scores

**GET** `/api/v1/dashboard/compliance`

Returns per-regulation compliance scores and trend data.

### Get Risk Heatmap Data

**GET** `/api/v1/dashboard/risk-heatmap`

Returns the risk matrix data for rendering heatmap visualizations.

---

## Rate Limits

API requests are rate-limited per tenant to ensure platform stability.

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| General API | 100 requests | 60 seconds |
| Authentication (login) | 5 requests | 60 seconds |
| Token refresh | 10 requests | 60 seconds |
| Scan trigger | 10 requests | 60 seconds |
| Bulk operations | 5 requests | 60 seconds |

### Rate Limit Headers

Every response includes:

```
X-RateLimit-Remaining: 87
```

When the limit is exceeded, the API returns HTTP 429:

```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded. Retry after 23 seconds.",
  "retryAfter": 23
}
```

---

## Webhooks

Configure webhooks to receive real-time notifications when events occur in PrivacyOps.

### Configuring Webhooks

1. Navigate to **Settings > Integrations > Webhooks** (or use the API).
2. Provide:
   - **URL** -- Your endpoint URL (HTTPS required)
   - **Events** -- Select which event types to subscribe to
   - **Secret** -- A shared secret for signature verification

### Webhook Events

| Event | Trigger |
|-------|---------|
| `scan.completed` | A discovery scan finishes |
| `scan.failed` | A discovery scan encounters an error |
| `finding.created` | A new DSPM finding is detected |
| `finding.resolved` | A finding is marked as resolved |
| `dsar.created` | A new DSAR is submitted |
| `dsar.sla_warning` | A DSAR is approaching its SLA deadline |
| `dsar.completed` | A DSAR response is delivered |
| `consent.withdrawn` | A consent record is withdrawn |
| `incident.created` | A new incident is reported |
| `incident.escalated` | An incident severity is escalated |
| `remediation.completed` | A remediation action finishes |
| `remediation.failed` | A remediation action fails |
| `connector.offline` | A connector health check fails |

### Webhook Payload Structure

```json
{
  "event": "finding.created",
  "timestamp": "2026-05-10T15:30:00Z",
  "tenantId": "tenant_abc",
  "data": {
    "id": "finding_xyz",
    "title": "Unencrypted PII column detected",
    "severity": "high",
    "connectorId": "conn_abc123"
  }
}
```

### Signature Verification

Each webhook request includes an `X-PrivacyOps-Signature` header containing an HMAC-SHA256 signature of the request body, signed with your webhook secret. Verify this signature on your server to confirm the request originated from PrivacyOps.

---

## Error Codes

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Resource created |
| 204 | Success (no content) |
| 400 | Bad request -- invalid parameters or request body |
| 401 | Unauthorized -- missing or invalid token |
| 403 | Forbidden -- insufficient permissions for this action |
| 404 | Not found -- resource does not exist |
| 409 | Conflict -- resource already exists or state conflict |
| 422 | Unprocessable entity -- validation error |
| 429 | Too many requests -- rate limit exceeded |
| 500 | Internal server error |
| 503 | Service unavailable -- temporary maintenance |

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Validation failed: 'connectorId' is required",
  "error": "Bad Request",
  "details": [
    {
      "field": "connectorId",
      "message": "must not be empty"
    }
  ]
}
```

### Common Error Scenarios

| Scenario | Code | Resolution |
|----------|------|------------|
| Expired JWT token | 401 | Refresh the token using `/auth/refresh` |
| Viewer role attempting a write operation | 403 | Request a role with write permissions from your Admin |
| Connector not found | 404 | Verify the connector ID; it may have been deleted |
| Duplicate DSAR for same subject and type | 409 | Check existing DSARs before creating a new one |
| Invalid date format in request body | 422 | Use ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ` |
| Rate limit exceeded | 429 | Wait for the `retryAfter` period and retry |

---

*TechD PrivacyOps + DSPM -- Copyright 2026 TechD Inc. All rights reserved.*
