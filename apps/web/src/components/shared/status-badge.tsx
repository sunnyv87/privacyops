import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
}

const statusStyles: Record<string, string> = {
  // Generic
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',

  // Scan
  queued: 'bg-blue-100 text-blue-800',
  running: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',

  // DSAR
  received: 'bg-blue-100 text-blue-800',
  identity_verification: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  review: 'bg-purple-100 text-purple-800',
  rejected: 'bg-red-100 text-red-800',
  overdue: 'bg-red-100 text-red-800',

  // Consent
  granted: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-800',
  revoked: 'bg-orange-100 text-orange-800',
  expired: 'bg-gray-100 text-gray-800',

  // Incident
  reported: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-orange-100 text-orange-800',
  investigating: 'bg-indigo-100 text-indigo-800',
  contained: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',

  // Assessment
  draft: 'bg-gray-100 text-gray-800',
  in_review: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-500',

  // Remediation
  proposed: 'bg-blue-100 text-blue-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  executing: 'bg-indigo-100 text-indigo-800',
  rolled_back: 'bg-orange-100 text-orange-800',
  unsupported: 'bg-amber-100 text-amber-800',
  manual_required: 'bg-purple-100 text-purple-800',

  // Findings
  open: 'bg-red-100 text-red-800',
  acknowledged: 'bg-yellow-100 text-yellow-800',
  mitigated: 'bg-green-100 text-green-800',
  accepted: 'bg-blue-100 text-blue-800',
  false_positive: 'bg-gray-100 text-gray-500',

  // Vendor
  under_review: 'bg-yellow-100 text-yellow-800',
  suspended: 'bg-orange-100 text-orange-800',
  terminated: 'bg-red-100 text-red-800',

  // Controls
  implemented: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  planned: 'bg-blue-100 text-blue-800',
  not_applicable: 'bg-gray-100 text-gray-500',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = statusStyles[status] || 'bg-gray-100 text-gray-800';
  const label = status.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        style,
      )}
    >
      {label}
    </span>
  );
}
