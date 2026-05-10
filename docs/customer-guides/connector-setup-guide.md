# TechD PrivacyOps + DSPM -- Connector Setup Guide

This guide provides step-by-step instructions for connecting your data sources to TechD PrivacyOps. Each connector section covers credential requirements, configuration, connectivity testing, and scan scheduling. PrivacyOps supports 43 connector types; this guide covers the most common ones.

---

## Table of Contents

1. [General Connector Workflow](#general-connector-workflow)
2. [AWS S3](#aws-s3)
3. [PostgreSQL](#postgresql)
4. [MySQL](#mysql)
5. [Microsoft SQL Server](#microsoft-sql-server)
6. [Snowflake](#snowflake)
7. [MongoDB](#mongodb)
8. [Salesforce](#salesforce)
9. [Azure Blob Storage](#azure-blob-storage)
10. [Google Cloud Storage](#google-cloud-storage)
11. [Google BigQuery](#google-bigquery)
12. [Okta](#okta)
13. [Testing and Troubleshooting](#testing-and-troubleshooting)
14. [Scan Scheduling](#scan-scheduling)

---

## General Connector Workflow

For every connector type, the process follows the same sequence:

1. Navigate to **Discovery > Connectors** and click **Add Connector**.
2. Select the connector type from the catalog.
3. Enter a **display name** and optional **description** for the connector.
4. Provide connection credentials (details vary by type -- see sections below).
5. Click **Test Connection** to verify connectivity.
6. Configure **scan scope** (which schemas, tables, buckets, or objects to include/exclude).
7. Set **sampling rate** for classification (10%, 25%, 50%, or 100%).
8. Click **Save Connector**.
9. Optionally click **Run Scan** to start an immediate discovery scan.

> **Security:** All credentials are encrypted at rest using envelope encryption. Connections to databases enforce TLS verification. Credentials are never exposed in logs or API responses.

---

## AWS S3

### Prerequisites

- An AWS IAM user or role with `s3:ListBucket`, `s3:GetObject`, and `s3:GetBucketLocation` permissions on target buckets
- Buckets must be accessible from the PrivacyOps network (public internet or VPC peering)

### Configuration Fields

| Field | Description | Example |
|-------|-------------|---------|
| AWS Region | The region where your buckets reside | `us-east-1` |
| Authentication Method | Choose IAM Access Key or IAM Role ARN | -- |
| Access Key ID | IAM user access key (if using access key auth) | `AKIAIOSFODNN7EXAMPLE` |
| Secret Access Key | IAM user secret key (if using access key auth) | `wJalrXUtnFEMI/K7MDENG/...` |
| Role ARN | IAM role to assume (if using role-based auth) | `arn:aws:iam::123456789012:role/PrivacyOpsRole` |
| Bucket Filter | Comma-separated list of bucket names, or `*` for all accessible buckets | `customer-data,logs-prod` |
| Path Prefix | Optional prefix to limit scanning to specific object paths | `data/pii/` |

### What Gets Scanned

- Object metadata (key, size, last modified, content type)
- File contents for supported formats: CSV, JSON, Parquet, Avro, XLSX, TXT
- Sampling is applied to large files (configurable row/byte limit)

---

## PostgreSQL

### Prerequisites

- A PostgreSQL user with `SELECT` privileges on target schemas and tables
- The `pg_catalog` schema must be accessible for metadata discovery
- Network connectivity from PrivacyOps to the database host and port (default: 5432)
- TLS/SSL enabled on the database server

### Configuration Fields

| Field | Description | Example |
|-------|-------------|---------|
| Host | Database server hostname or IP | `db.yourcompany.com` |
| Port | PostgreSQL port | `5432` |
| Database | Database name | `production` |
| Username | Database user | `privacyops_reader` |
| Password | Database user password | -- |
| SSL Mode | `require`, `verify-ca`, or `verify-full` | `verify-full` |
| SSL CA Certificate | CA certificate for SSL verification (PEM format) | -- |
| Schema Filter | Comma-separated schemas to include, or `*` for all | `public,customers` |

### Recommended Database User Setup

```sql
CREATE USER privacyops_reader WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE production TO privacyops_reader;
GRANT USAGE ON SCHEMA public TO privacyops_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO privacyops_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO privacyops_reader;
```

---

## MySQL

### Prerequisites

- A MySQL user with `SELECT` and `SHOW DATABASES` privileges
- Network connectivity to port 3306 (default)
- TLS enabled on the MySQL server

### Configuration Fields

| Field | Description | Example |
|-------|-------------|---------|
| Host | Database server hostname or IP | `mysql.yourcompany.com` |
| Port | MySQL port | `3306` |
| Database | Database name (or `*` for all accessible databases) | `app_db` |
| Username | Database user | `privacyops_reader` |
| Password | Database user password | -- |
| SSL Mode | `REQUIRED`, `VERIFY_CA`, or `VERIFY_IDENTITY` | `VERIFY_CA` |
| SSL CA Certificate | CA certificate for TLS verification | -- |

### Recommended Database User Setup

```sql
CREATE USER 'privacyops_reader'@'%' IDENTIFIED BY 'secure_password';
GRANT SELECT ON app_db.* TO 'privacyops_reader'@'%';
FLUSH PRIVILEGES;
```

---

## Microsoft SQL Server

### Prerequisites

- A SQL Server login with `db_datareader` role on target databases
- Network connectivity to port 1433 (default)
- TLS encryption enabled

### Configuration Fields

| Field | Description | Example |
|-------|-------------|---------|
| Host | Server hostname or IP | `sqlserver.yourcompany.com` |
| Port | SQL Server port | `1433` |
| Database | Database name | `CustomerDB` |
| Username | SQL login username | `privacyops_reader` |
| Password | SQL login password | -- |
| Encrypt | Enable TLS encryption | `true` |
| Trust Server Certificate | Trust self-signed certificates (not recommended for production) | `false` |

---

## Snowflake

### Prerequisites

- A Snowflake user with the `USAGE` privilege on target warehouses, databases, and schemas
- `SELECT` privilege on target tables and views
- Network policy must allow connections from PrivacyOps IP ranges (contact TechD support for the list)

### Configuration Fields

| Field | Description | Example |
|-------|-------------|---------|
| Account Identifier | Snowflake account identifier | `xy12345.us-east-1` |
| Username | Snowflake user | `PRIVACYOPS_SERVICE` |
| Authentication | Password or Key Pair | -- |
| Password | User password (if password auth) | -- |
| Private Key | RSA private key PEM (if key pair auth) | -- |
| Warehouse | Compute warehouse for scan queries | `PRIVACYOPS_WH` |
| Database | Target database | `PROD_DB` |
| Schema Filter | Comma-separated schemas or `*` | `PUBLIC,RAW` |
| Role | Snowflake role to use | `PRIVACYOPS_ROLE` |

### Recommended Snowflake Setup

```sql
CREATE ROLE PRIVACYOPS_ROLE;
CREATE USER PRIVACYOPS_SERVICE PASSWORD='secure_password' DEFAULT_ROLE=PRIVACYOPS_ROLE;
GRANT USAGE ON WAREHOUSE PRIVACYOPS_WH TO ROLE PRIVACYOPS_ROLE;
GRANT USAGE ON DATABASE PROD_DB TO ROLE PRIVACYOPS_ROLE;
GRANT USAGE ON ALL SCHEMAS IN DATABASE PROD_DB TO ROLE PRIVACYOPS_ROLE;
GRANT SELECT ON ALL TABLES IN DATABASE PROD_DB TO ROLE PRIVACYOPS_ROLE;
GRANT ROLE PRIVACYOPS_ROLE TO USER PRIVACYOPS_SERVICE;
```

---

## MongoDB

### Prerequisites

- A MongoDB user with `read` role on target databases
- Network connectivity to port 27017 (default) or your custom port
- TLS/SSL enabled on the MongoDB cluster

### Configuration Fields

| Field | Description | Example |
|-------|-------------|---------|
| Connection String | Full MongoDB URI | `mongodb+srv://host.mongodb.net/` |
| Host | MongoDB hostname (if not using connection string) | `mongo.yourcompany.com` |
| Port | MongoDB port | `27017` |
| Database | Target database | `customer_data` |
| Username | MongoDB user | `privacyops_reader` |
| Password | User password | -- |
| Auth Database | Authentication database | `admin` |
| Replica Set | Replica set name (if applicable) | `rs0` |
| SSL | Enable TLS/SSL | `true` |

### What Gets Scanned

- Collections and their document schemas (inferred from sampling)
- Field names, types, and nested structures
- Sample values for classification

---

## Salesforce

### Prerequisites

- A Salesforce Connected App configured for OAuth 2.0
- A Salesforce user with API access and read permissions on target objects
- The Connected App must have the `api` and `refresh_token` OAuth scopes

### Configuration Fields

| Field | Description | Example |
|-------|-------------|---------|
| Instance URL | Your Salesforce instance URL | `https://yourcompany.my.salesforce.com` |
| Client ID | Connected App Consumer Key | -- |
| Client Secret | Connected App Consumer Secret | -- |
| Username | Salesforce user email | `admin@yourcompany.com` |
| Security Token | User's security token (appended to password) | -- |
| Object Filter | Comma-separated Salesforce objects to scan | `Account,Contact,Lead,Opportunity` |

### What Gets Scanned

- Standard and custom Salesforce objects
- Field metadata (name, type, label, picklist values)
- Record sampling for classification

---

## Azure Blob Storage

### Prerequisites

- An Azure service principal or storage account key with `Storage Blob Data Reader` role
- Network access from PrivacyOps to the storage account (public endpoint or private endpoint)

### Configuration Fields

| Field | Description | Example |
|-------|-------------|---------|
| Storage Account Name | Azure storage account name | `yourstorageaccount` |
| Authentication Method | Service Principal or Access Key | -- |
| Tenant ID | Azure AD tenant ID (if using service principal) | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| Client ID | Service principal app ID (if using service principal) | -- |
| Client Secret | Service principal secret (if using service principal) | -- |
| Access Key | Storage account access key (if using access key) | -- |
| Container Filter | Comma-separated container names or `*` | `customer-uploads,exports` |
| Path Prefix | Optional blob path prefix | `data/2024/` |

---

## Google Cloud Storage

### Prerequisites

- A GCP service account with `roles/storage.objectViewer` on target buckets
- A JSON key file for the service account

### Configuration Fields

| Field | Description | Example |
|-------|-------------|---------|
| Project ID | GCP project ID | `your-project-id` |
| Service Account Key | JSON key file contents (paste or upload) | -- |
| Bucket Filter | Comma-separated bucket names or `*` | `data-lake-prod,backups` |
| Path Prefix | Optional object path prefix | `exports/` |

---

## Google BigQuery

### Prerequisites

- A GCP service account with `roles/bigquery.dataViewer` and `roles/bigquery.jobUser`
- The service account must be able to run query jobs in the target project

### Configuration Fields

| Field | Description | Example |
|-------|-------------|---------|
| Project ID | GCP project ID | `your-project-id` |
| Service Account Key | JSON key file contents (paste or upload) | -- |
| Dataset Filter | Comma-separated dataset names or `*` | `analytics,customer_data` |
| Location | BigQuery dataset location | `US` |

---

## Okta

### Prerequisites

- An Okta API token with `okta.users.read` and `okta.apps.read` scopes
- Your Okta organization URL

### Configuration Fields

| Field | Description | Example |
|-------|-------------|---------|
| Okta Domain | Your Okta organization URL | `https://yourcompany.okta.com` |
| API Token | Okta API token | -- |
| Scan Scope | Users, Groups, Applications, or All | `All` |

### What Gets Scanned

- User profiles (name, email, phone, department, custom attributes)
- Group memberships
- Application assignments

---

## Testing and Troubleshooting

### Connection Test

After entering credentials, always click **Test Connection** before saving. The test verifies:

- Network connectivity to the target host and port
- Authentication with the provided credentials
- Authorization to read metadata (schemas, tables, buckets, objects)

### Common Failure Reasons

| Error | Cause | Resolution |
|-------|-------|------------|
| Connection timed out | Network/firewall blocking access | Whitelist PrivacyOps IP ranges in your firewall. Contact TechD support for the current IP list. |
| Authentication failed | Invalid credentials | Verify username, password, and any security tokens. For databases, test credentials directly using a client tool. |
| SSL handshake failed | TLS certificate issue | Ensure the correct CA certificate is uploaded. Verify the server's TLS certificate is valid and not expired. |
| Permission denied | Insufficient privileges | Grant the required read permissions to the service account (see connector-specific setup sections). |
| Host not found | DNS resolution failure | Verify the hostname is correct and resolvable from the PrivacyOps network. |

### Health Monitoring

After a connector is saved:

- A **health check** runs every 15 minutes to verify connectivity.
- Status indicators: **Healthy** (green), **Degraded** (yellow), **Offline** (red).
- Navigate to **Discovery > Connectors** to view the health status of all connectors.
- Configure alerts in **Settings > Notifications** to receive notifications when a connector goes offline.

---

## Scan Scheduling

### One-Time Scans

Click **Run Scan** on any connector to start an immediate discovery scan.

### Scheduled Scans

1. Open the connector's detail page.
2. Click **Schedule**.
3. Configure the schedule:

| Option | Description |
|--------|-------------|
| Daily | Runs at a specified time each day |
| Weekly | Runs on a selected day and time each week |
| Monthly | Runs on a selected date and time each month |
| Custom Cron | Enter a cron expression for advanced schedules |

4. Set the **scan window** -- the time range during which scans are allowed to run (useful for avoiding peak-hours impact on production databases).
5. Click **Save Schedule**.

### Scan Scope Options

| Setting | Description |
|---------|-------------|
| Full Scan | Discover all accessible schemas, tables, and objects |
| Incremental Scan | Only scan assets modified since the last scan (faster, lower impact) |
| Schema Filter | Include or exclude specific schemas or datasets |
| Table Filter | Include or exclude specific tables by name or pattern |
| Sampling Rate | Percentage of rows/objects sampled for classification: 10%, 25%, 50%, 100% |

---

*TechD PrivacyOps + DSPM -- Copyright 2026 TechD Inc. All rights reserved.*
