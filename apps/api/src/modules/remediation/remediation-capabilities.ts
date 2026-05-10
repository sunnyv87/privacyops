export type ActionType =
  | 'revoke_access'
  | 'encrypt'
  | 'enable_mfa'
  | 'apply_retention'
  | 'restrict_public'
  | 'delete_data'
  | 'mask_data'
  | 'quarantine'
  | 'rotate_credentials'
  | 'restrict_sharing'
  | 'disable_public_access'
  | 'enforce_encryption';

export const ALL_ACTION_TYPES: ActionType[] = [
  'revoke_access',
  'encrypt',
  'enable_mfa',
  'apply_retention',
  'restrict_public',
  'delete_data',
  'mask_data',
  'quarantine',
  'rotate_credentials',
  'restrict_sharing',
  'disable_public_access',
  'enforce_encryption',
];

export interface ActionCapability {
  supported: boolean;
  mode?: 'native' | 'catalog_update';
  note?: string;
  suggested_manual_action?: string;
}

export type ConnectorCapabilityMap = Record<ActionType, ActionCapability>;

const catalogUpdateAccess = (connectorLabel: string): ActionCapability => ({
  supported: true,
  mode: 'catalog_update',
  note: `Reads ${connectorLabel} access policies and updates asset catalog record`,
});

const unsupported = (suggestedAction: string): ActionCapability => ({
  supported: false,
  suggested_manual_action: suggestedAction,
});

const quarantineCatalog: ActionCapability = {
  supported: true,
  mode: 'catalog_update',
  note: 'Marks asset as quarantined in catalog; does not modify source system',
};

const retentionCatalog: ActionCapability = {
  supported: true,
  mode: 'catalog_update',
  note: 'Tags asset with retention metadata in catalog for enforcement by retention workflows',
};

function connectorDefaults(
  connectorLabel: string,
  manualActions: Partial<Record<ActionType, string>>,
): ConnectorCapabilityMap {
  return {
    revoke_access: catalogUpdateAccess(connectorLabel),
    restrict_public: catalogUpdateAccess(connectorLabel),
    disable_public_access: catalogUpdateAccess(connectorLabel),
    restrict_sharing: catalogUpdateAccess(connectorLabel),
    quarantine: quarantineCatalog,
    apply_retention: retentionCatalog,
    delete_data: unsupported(manualActions.delete_data ?? `Delete data via ${connectorLabel} admin console`),
    encrypt: unsupported(manualActions.encrypt ?? `Enable encryption via ${connectorLabel} admin console`),
    enable_mfa: unsupported(manualActions.enable_mfa ?? `Enable MFA via identity provider settings`),
    mask_data: unsupported(manualActions.mask_data ?? `Apply data masking via ETL pipeline or ${connectorLabel} tooling`),
    rotate_credentials: unsupported(manualActions.rotate_credentials ?? `Rotate credentials via ${connectorLabel} admin console`),
    enforce_encryption: unsupported(manualActions.enforce_encryption ?? `Enforce encryption via ${connectorLabel} admin console`),
  };
}

export const CAPABILITY_MATRIX: Record<string, ConnectorCapabilityMap> = {
  aws_s3: {
    ...connectorDefaults('AWS S3', {
      encrypt: 'Enable SSE-S3 or SSE-KMS in S3 bucket settings',
      enable_mfa: 'Enable MFA Delete in S3 bucket versioning configuration',
      mask_data: 'Use S3 Object Lambda or ETL pipeline for data masking',
      rotate_credentials: 'Rotate IAM access keys in AWS IAM console',
      enforce_encryption: 'Add bucket policy requiring encrypted uploads (aws:SecureTransport)',
    }),
    delete_data: {
      supported: true,
      mode: 'native',
      note: 'Calls S3 DeleteObject; gated by enableNativeDisposal connector config',
    },
  },

  postgresql: connectorDefaults('PostgreSQL', {
    delete_data: 'Execute TRUNCATE or DELETE with DBA review',
    encrypt: 'Enable TDE or pgcrypto column-level encryption',
    mask_data: 'Use pg_anonymize or application-level masking',
    rotate_credentials: 'ALTER ROLE with new password; update connection config',
    enforce_encryption: 'Enable ssl=on in postgresql.conf and require sslmode in clients',
  }),

  mysql: connectorDefaults('MySQL', {
    delete_data: 'Execute TRUNCATE or DELETE with DBA review',
    encrypt: 'Enable InnoDB tablespace encryption (ENCRYPTION=Y)',
    mask_data: 'Use MySQL Enterprise Data Masking or application-level',
    rotate_credentials: 'ALTER USER with new password; update connection config',
    enforce_encryption: 'Set require_secure_transport=ON in server config',
  }),

  snowflake: connectorDefaults('Snowflake', {
    delete_data: 'Execute TRUNCATE TABLE or DROP TABLE with admin review',
    encrypt: 'Snowflake encrypts all data at rest by default (AES-256)',
    mask_data: 'Use Snowflake Dynamic Data Masking policies',
    rotate_credentials: 'ALTER USER SET PASSWORD; rotate key pair credentials',
    enforce_encryption: 'Snowflake enforces TLS; configure network policies for IP restrictions',
  }),

  mongodb: {
    ...connectorDefaults('MongoDB', {
      delete_data: 'Execute db.collection.drop() or deleteMany() with admin review',
      encrypt: 'Enable MongoDB Encryption at Rest or Client-Side Field Level Encryption',
      mask_data: 'Use MongoDB Atlas Data Masking or Queryable Encryption',
      rotate_credentials: 'Update user credentials via db.updateUser()',
      enforce_encryption: 'Enable TLS/SSL and configure net.tls settings',
    }),
    revoke_access: unsupported('Revoke roles via db.revokeRolesFromUser() in MongoDB shell'),
    restrict_public: unsupported('Bind MongoDB to private interface; update net.bindIp'),
    disable_public_access: unsupported('Bind MongoDB to private interface; update net.bindIp'),
    restrict_sharing: unsupported('Review database roles and remove overly permissive grants in MongoDB shell'),
  },

  salesforce: connectorDefaults('Salesforce', {
    delete_data: 'Use Data Loader or Bulk API to delete records with admin approval',
    encrypt: 'Enable Salesforce Shield Platform Encryption',
    mask_data: 'Use Salesforce Data Mask in sandbox environments',
    rotate_credentials: 'Reset security token and update OAuth credentials',
    enforce_encryption: 'Enable Salesforce Shield; enforce TLS for all API calls',
  }),

  okta: {
    ...connectorDefaults('Okta', {
      enable_mfa: 'Enable MFA policy for user group in Okta Admin Console',
      rotate_credentials: 'Rotate API token in Okta Admin > Security > API',
    }),
    revoke_access: unsupported('Deactivate user or remove group membership in Okta Admin Console'),
    restrict_public: unsupported('Review application sign-on policies in Okta Admin Console'),
    disable_public_access: unsupported('Review application sign-on policies in Okta Admin Console'),
    restrict_sharing: unsupported('Review application access and group assignments in Okta Admin Console'),
  },

  azure_blob: connectorDefaults('Azure Blob Storage', {
    delete_data: 'Delete blobs via Azure Portal or az storage blob delete',
    encrypt: 'Enable Azure Storage Service Encryption (SSE) with customer-managed keys',
    mask_data: 'Use Azure Purview or ETL pipeline for data masking',
    rotate_credentials: 'Rotate storage account access keys in Azure Portal',
    enforce_encryption: 'Require secure transfer (HTTPS) in storage account settings',
  }),

  gcp_storage: connectorDefaults('GCP Cloud Storage', {
    delete_data: 'Delete objects via gsutil rm or Cloud Console',
    encrypt: 'Enable Customer-Managed Encryption Keys (CMEK) on bucket',
    mask_data: 'Use Cloud DLP API or Dataflow pipeline for masking',
    rotate_credentials: 'Rotate service account keys in IAM & Admin console',
    enforce_encryption: 'GCS enforces TLS; add CMEK for additional layer',
  }),

  sqlserver: connectorDefaults('SQL Server', {
    delete_data: 'Execute TRUNCATE or DELETE with DBA review',
    encrypt: 'Enable Transparent Data Encryption (TDE) on database',
    mask_data: 'Use SQL Server Dynamic Data Masking on columns',
    rotate_credentials: 'ALTER LOGIN with new password; update connection config',
    enforce_encryption: 'Set Force Encryption in SQL Server Configuration Manager',
  }),

  bigquery: connectorDefaults('BigQuery', {
    delete_data: 'Execute DELETE DML or drop table/partition via BigQuery console',
    encrypt: 'BigQuery encrypts all data at rest by default; add CMEK if needed',
    mask_data: 'Use BigQuery column-level security or data masking rules',
    rotate_credentials: 'Rotate service account keys in GCP IAM',
    enforce_encryption: 'BigQuery enforces TLS; configure VPC Service Controls for additional isolation',
  }),
};

export function getCapabilitiesForConnector(connectorType: string): ConnectorCapabilityMap | null {
  return CAPABILITY_MATRIX[connectorType] ?? null;
}

export function getSuggestedManualAction(connectorType: string, actionType: ActionType): string | null {
  const cap = CAPABILITY_MATRIX[connectorType]?.[actionType];
  if (!cap) return null;
  return cap.suggested_manual_action ?? null;
}
