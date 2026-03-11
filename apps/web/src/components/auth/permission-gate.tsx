'use client';

import { useAuthStore } from '@/stores/auth.store';

interface PermissionGateProps {
  permissions?: string | string[];
  roles?: string | string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditionally renders children based on the current user's permissions and/or roles.
 *
 * By default, access is granted if the user has ANY of the listed permissions/roles.
 * Set `requireAll` to require ALL listed permissions.
 */
export function PermissionGate({
  permissions,
  roles,
  requireAll = false,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasRole, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  const permList = normalizeToArray(permissions);
  const roleList = normalizeToArray(roles);

  // If no permissions or roles specified, always render
  if (permList.length === 0 && roleList.length === 0) {
    return <>{children}</>;
  }

  let hasAccess: boolean;

  if (requireAll) {
    // Must have ALL permissions AND ALL roles
    const allPerms = permList.length === 0 || permList.every((p) => hasPermission(p));
    const allRoles = roleList.length === 0 || roleList.every((r) => hasRole(r));
    hasAccess = allPerms && allRoles;
  } else {
    // Must have ANY permission OR ANY role
    const anyPerm = permList.length > 0 && hasAnyPermission(...permList);
    const anyRole = roleList.length > 0 && roleList.some((r) => hasRole(r));

    if (permList.length > 0 && roleList.length > 0) {
      hasAccess = anyPerm || anyRole;
    } else if (permList.length > 0) {
      hasAccess = anyPerm;
    } else {
      hasAccess = anyRole;
    }
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

function normalizeToArray(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
