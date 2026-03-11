import { SetMetadata } from '@nestjs/common';

export const ABAC_POLICY_KEY = 'abacPolicy';

export interface AbacPolicyMetadata {
  /** The type of resource being accessed (e.g. 'DataSource', 'DsarRequest') */
  resourceType: string;

  /** The action being performed (e.g. 'read', 'delete', 'update') */
  action: string;

  /** Request parameter name that holds the resource ID (e.g. 'id', 'dataSourceId') */
  resourceIdParam?: string;

  /** Dot-path field on the loaded resource that contains the owner user ID */
  ownerField?: string;

  /** Dot-path field on the loaded resource that holds the classification/sensitivity value */
  classificationField?: string;

  /** Dot-path field on the loaded resource that holds the department */
  departmentField?: string;
}

/**
 * Decorator to declare ABAC policy requirements on a controller method.
 *
 * Usage:
 * ```ts
 * @RequireAbacPolicy({
 *   resourceType: 'DataSource',
 *   action: 'delete',
 *   resourceIdParam: 'id',
 *   ownerField: 'createdBy',
 * })
 * ```
 */
export const RequireAbacPolicy = (metadata: AbacPolicyMetadata) =>
  SetMetadata(ABAC_POLICY_KEY, metadata);
