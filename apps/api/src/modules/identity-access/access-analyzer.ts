import { Injectable } from '@nestjs/common';

@Injectable()
export class AccessAnalyzer {
  analyzeExcessivePermissions(mappings: any[]): any[] {
    return mappings.map((mapping) => {
      const permissions = (mapping.permissions as string[]) || [];
      const hasAdminAccess = permissions.some((p) =>
        ['admin', 'owner', 'full_control'].includes(p.toLowerCase()),
      );
      const isOwner = mapping.isOwner ?? false;

      if (hasAdminAccess && !isOwner) {
        return { ...mapping, isExcessive: true, excessiveReason: 'Non-owner with admin/owner level access' };
      }

      return mapping;
    });
  }

  analyzeInactiveAccess(mappings: any[]): any[] {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    return mappings.map((mapping) => {
      if (mapping.lastAccessedAt && new Date(mapping.lastAccessedAt) < ninetyDaysAgo) {
        return { ...mapping, isInactive: true, inactiveReason: 'No access in over 90 days' };
      }

      if (!mapping.lastAccessedAt) {
        return { ...mapping, isInactive: true, inactiveReason: 'Never accessed' };
      }

      return mapping;
    });
  }

  analyzePublicSharing(mappings: any[]): any[] {
    return mappings.map((mapping) => {
      if (mapping.identityType === 'public') {
        return {
          ...mapping,
          isExcessive: true,
          isPublicSharing: true,
          excessiveReason: 'Public access detected',
        };
      }

      return mapping;
    });
  }
}
