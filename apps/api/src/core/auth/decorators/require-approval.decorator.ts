import { SetMetadata } from '@nestjs/common';

export const REQUIRE_APPROVAL_KEY = 'requireApproval';

export interface RequireApprovalMetadata {
  /** Roles that are allowed to approve this action */
  approverRoles: string[];
  /** Override action name (defaults to `<HttpMethod>.<ControllerPath>.<HandlerName>`) */
  action?: string;
  /** Request param name for the resource ID */
  resourceIdParam?: string;
  /** The resource type name for the approval record */
  resourceType?: string;
  /** Expiration time in minutes (default: 24 hours) */
  expiresInMinutes?: number;
}

/**
 * Decorator that marks a controller method as requiring prior approval.
 *
 * When applied, the ApprovalGuard intercepts the request:
 * - If `x-approval-id` header is present, validates the approval is approved and matches.
 * - Otherwise, creates a new approval request and returns 202 Accepted with the request ID.
 *
 * Usage:
 * ```ts
 * @RequireApproval({ approverRoles: ['admin', 'dpo'] })
 * @Delete(':id')
 * async deleteUser(@Param('id') id: string) { ... }
 * ```
 */
export const RequireApproval = (
  approverRolesOrMetadata: string[] | RequireApprovalMetadata,
) => {
  const metadata: RequireApprovalMetadata = Array.isArray(
    approverRolesOrMetadata,
  )
    ? { approverRoles: approverRolesOrMetadata }
    : approverRolesOrMetadata;

  return SetMetadata(REQUIRE_APPROVAL_KEY, metadata);
};
