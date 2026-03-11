'use client';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your organization settings" />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
              <CardDescription>Manage your organization details and preferences</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Organization settings form will render here.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Users & Role Management</CardTitle>
              <CardDescription>Manage team members and their roles</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              User management table with role assignment will render here.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>Configure webhooks, SSO, and third-party integrations</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Integration configuration forms will render here.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Configure email, webhook, and in-app notification settings</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Notification preferences form will render here.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
