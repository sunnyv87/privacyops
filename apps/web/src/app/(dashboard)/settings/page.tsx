'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUsers, useRoles, useAuditLogs } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, Key, Bell, Webhook, Users, Settings2, Globe } from 'lucide-react';

// Users table columns
const userColumns: ColumnDef<any>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div>
        <span className="font-medium">{row.original.name}</span>
        <p className="text-xs text-muted-foreground">{row.original.email}</p>
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'roles',
    header: 'Roles',
    cell: ({ row }) => {
      const roles = row.original.roles || [];
      return (
        <div className="flex gap-1 flex-wrap">
          {roles.map((r: any) => (
            <Badge key={r.id || r} variant="secondary" className="text-xs">
              {r.name || r}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: 'mfaEnabled',
    header: 'MFA',
    cell: ({ row }) => (
      <Badge variant={row.original.mfaEnabled ? 'default' : 'outline'}>
        {row.original.mfaEnabled ? 'Enabled' : 'Disabled'}
      </Badge>
    ),
  },
  {
    accessorKey: 'lastLoginAt',
    header: 'Last Login',
    cell: ({ row }) => {
      const date = row.original.lastLoginAt;
      if (!date) return <span className="text-muted-foreground">Never</span>;
      return new Date(date).toLocaleDateString();
    },
  },
  {
    accessorKey: 'authProvider',
    header: 'Auth Provider',
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.authProvider}
      </Badge>
    ),
  },
];

// Audit log columns
const auditColumns: ColumnDef<any>[] = [
  {
    accessorKey: 'timestamp',
    header: 'Time',
    cell: ({ row }) => (
      <span className="text-xs font-mono">
        {new Date(row.original.timestamp).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.action}</span>
    ),
  },
  {
    accessorKey: 'actorType',
    header: 'Actor',
    cell: ({ row }) => (
      <div className="text-xs">
        <Badge variant="outline" className="text-xs">
          {row.original.actorType}
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: 'entityType',
    header: 'Entity',
    cell: ({ row }) => (
      <span className="text-xs">
        {row.original.entityType}:{row.original.entityId?.substring(0, 8)}
      </span>
    ),
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) =>
      row.original.category ? (
        <Badge variant="secondary" className="text-xs capitalize">
          {row.original.category}
        </Badge>
      ) : null,
  },
  {
    accessorKey: 'ipAddress',
    header: 'IP',
    cell: ({ row }) => (
      <span className="text-xs font-mono">{row.original.ipAddress || '--'}</span>
    ),
  },
];

function UsersTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useUsers({ page, page_size: 20 });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input placeholder="Search users..." className="max-w-sm" />
        <Button>Invite User</Button>
      </div>
      <DataTable
        columns={userColumns}
        data={data?.data || []}
        pagination={data?.pagination}
        onPageChange={setPage}
      />
    </div>
  );
}

function RolesTab() {
  const { data, isLoading } = useRoles();

  if (isLoading) return <Skeleton className="h-64" />;

  const roles = data?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage roles and their associated permissions
        </p>
        <Button>Create Role</Button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {roles.map((role: any) => (
          <Card key={role.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{role.name}</CardTitle>
                {role.isSystem && <Badge variant="secondary">System</Badge>}
              </div>
              <CardDescription>{role.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {((role.permissions as string[]) || []).slice(0, 5).map((p: string) => (
                  <Badge key={p} variant="outline" className="text-xs font-mono">
                    {p}
                  </Badge>
                ))}
                {(role.permissions as string[])?.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{(role.permissions as string[]).length - 5} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function IntegrationsTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <div>
              <CardTitle>Single Sign-On (SSO)</CardTitle>
              <CardDescription>Configure SAML 2.0 or OIDC for enterprise SSO</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">SAML 2.0</span>
                <Badge variant="outline">Not Configured</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Connect with Okta, Azure AD, OneLogin, or any SAML 2.0 IdP
              </p>
              <Button variant="outline" size="sm">Configure</Button>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">OpenID Connect</span>
                <Badge variant="outline">Not Configured</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Connect with Google, Azure AD, Auth0, or any OIDC provider
              </p>
              <Button variant="outline" size="sm">Configure</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <div>
              <CardTitle>SCIM Provisioning</CardTitle>
              <CardDescription>Automate user provisioning from your identity provider</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <span className="font-medium">SCIM 2.0 Endpoint</span>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                /scim/v2
              </p>
            </div>
            <Button variant="outline" size="sm">Generate Token</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage API keys for programmatic access</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm">Create API Key</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            <div>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>Configure outbound webhook notifications</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm">Add Webhook</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationsTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <div>
              <CardTitle>Notification Channels</CardTitle>
              <CardDescription>Configure how and when you receive notifications</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'DSAR SLA Approaching', desc: 'Notify when DSAR deadlines are approaching', channels: ['email', 'in_app'] },
            { label: 'Critical Risk Finding', desc: 'Notify on new critical/high risk findings', channels: ['email', 'in_app', 'webhook'] },
            { label: 'Breach Detected', desc: 'Immediate notification on breach incidents', channels: ['email', 'in_app', 'webhook'] },
            { label: 'Assessment Review Due', desc: 'Notify when assessments require review', channels: ['email', 'in_app'] },
            { label: 'Consent Rate Drop', desc: 'Alert when consent opt-in rates drop significantly', channels: ['email'] },
            { label: 'Security Events', desc: 'Account lockout, unauthorized access, suspicious activity', channels: ['email', 'in_app', 'webhook'] },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <span className="font-medium text-sm">{item.label}</span>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <div className="flex gap-1">
                {item.channels.map((ch) => (
                  <Badge key={ch} variant="secondary" className="text-xs capitalize">
                    {ch.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLogs({ page, page_size: 50 });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <DataTable
      columns={auditColumns}
      data={data?.data || []}
      pagination={data?.pagination}
      onPageChange={setPage}
    />
  );
}

function GeneralTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            <div>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Manage your organization profile</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Organization Name</label>
              <Input placeholder="Acme Corp" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Domain</label>
              <Input placeholder="acme.com" className="mt-1" />
            </div>
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <div>
              <CardTitle>Data Residency</CardTitle>
              <CardDescription>Configure data storage region and compliance settings</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <span className="font-medium text-sm">Primary Region</span>
              <p className="text-xs text-muted-foreground">Where your data is stored</p>
            </div>
            <Badge variant="secondary">Asia Pacific (Mumbai)</Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <span className="font-medium text-sm">Encryption</span>
              <p className="text-xs text-muted-foreground">Data encryption at rest</p>
            </div>
            <Badge variant="default">AES-256-GCM</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your organization settings and configuration" />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <GeneralTab />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <RolesTab />
        </TabsContent>
        <TabsContent value="integrations" className="mt-4">
          <IntegrationsTab />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
