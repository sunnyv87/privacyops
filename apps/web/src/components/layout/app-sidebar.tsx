'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { PermissionGate } from '@/components/auth/permission-gate';
import {
  LayoutDashboard,
  Database,
  Shield,
  Search,
  Tags,
  FileCheck,
  UserCheck,
  AlertTriangle,
  Clock,
  Building2,
  CheckSquare,
  ScrollText,
  Settings,
  Map,
} from 'lucide-react';

interface NavLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  section: string;
  permissions?: string[];
  items: NavLink[];
}

type NavItem = (NavLink & { permissions?: string[] }) | NavSection;

const navigation: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    section: 'DATA SECURITY',
    permissions: ['dspm:*', 'dspm:findings:read', 'dspm:datamap:read', 'discovery:*'],
    items: [
      { label: 'Data Map & DSPM', href: '/dspm', icon: Map },
      { label: 'Data Sources', href: '/discovery/sources', icon: Database },
      { label: 'Findings', href: '/dspm/findings', icon: Shield },
    ],
  },
  {
    section: 'DATA INTELLIGENCE',
    permissions: ['discovery:*', 'discovery:assets:read', 'classification:*', 'classification:rules:read'],
    items: [
      { label: 'Data Catalog', href: '/discovery/assets', icon: Search },
      { label: 'Classification', href: '/classification', icon: Tags },
    ],
  },
  {
    section: 'PRIVACY OPS',
    permissions: ['consent:*', 'dsar:*', 'ropa:*', 'incidents:*'],
    items: [
      { label: 'Consent', href: '/consent', icon: FileCheck },
      { label: 'DSAR', href: '/dsar', icon: UserCheck },
      { label: 'RoPA', href: '/ropa', icon: ScrollText },
      { label: 'Breach & Incidents', href: '/breach', icon: AlertTriangle },
    ],
  },
  {
    section: 'RISK & COMPLIANCE',
    permissions: ['assessments:*', 'vendors:*', 'compliance:*'],
    items: [
      { label: 'Risk Assessments', href: '/risk', icon: AlertTriangle },
      { label: 'Vendors', href: '/vendors', icon: Building2 },
      { label: 'Compliance', href: '/compliance', icon: CheckSquare },
    ],
  },
  {
    section: 'GOVERNANCE',
    permissions: ['retention:*', 'retention:policies:read'],
    items: [
      { label: 'Retention', href: '/retention', icon: Clock },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <span className="text-lg font-bold">TechD</span>
          <span className="ml-1 text-xs text-muted-foreground">PrivacyOps</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {navigation.map((item, index) => {
          if ('href' in item) {
            // Top-level link (Dashboard) — always visible
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  pathname === item.href
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          }

          const sectionContent = (
            <div key={item.section}>
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {item.section}
              </p>
              <div className="space-y-1">
                {item.items.map((subItem) => (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      pathname === subItem.href || pathname.startsWith(subItem.href + '/')
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <subItem.icon className="h-4 w-4" />
                    {subItem.label}
                  </Link>
                ))}
              </div>
            </div>
          );

          // Wrap section in PermissionGate if permissions are defined
          if (item.permissions && item.permissions.length > 0) {
            return (
              <PermissionGate key={item.section} permissions={item.permissions}>
                {sectionContent}
              </PermissionGate>
            );
          }

          return sectionContent;
        })}
      </nav>

      {/* Settings — admin only */}
      <div className="border-t p-4">
        <PermissionGate permissions={['admin:*']} roles={['admin', 'super_admin']}>
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              pathname === '/settings' || pathname.startsWith('/settings/')
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </PermissionGate>
      </div>
    </aside>
  );
}
