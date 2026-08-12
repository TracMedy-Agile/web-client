"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, RotateCcw, Save } from "lucide-react";

import { SaveNotice, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { DependencyRules, PolicyToggle, RoleCard, RolesTable, UnsavedFooter, roleAccess, unavailableRolePolicy } from "@/app/dashboard/settings/roles/components";

export default function RolesPage() {
  const [auditRequired, setAuditRequired] = useState(true);
  const [adminApproval, setAdminApproval] = useState(true);
  const dirty = auditRequired !== true || adminApproval !== true;

  useEffect(() => {
    capturePostHogEvent("settings_roles_viewed", { expanded: false });
  }, []);

  function reset() {
    setAuditRequired(true);
    setAdminApproval(true);
    capturePostHogEvent("settings_roles_reset");
  }

  return (
    <div>
      <SettingsHeader title="Roles & Permissions" description="Review default role access, workspace administration grants, and permission dependency rules." />
      <SettingsPanel title="Default Role Access" description="These cards summarize the default access profile for each hospital role.">
        <div className="grid gap-4 xl:grid-cols-3">{roleAccess.map((role) => <RoleCard key={role.role} {...role} />)}</div>
        <Button type="button" asChild variant="outline" className="h-10 w-fit rounded-lg font-semibold"><Link href="/dashboard/settings/roles/expanded">View expanded permissions<ChevronRight className="h-4 w-4" /></Link></Button>
      </SettingsPanel>

      <div className="mt-5 space-y-5">
        <SettingsPanel title="Permission Policies" description="Set workspace-level safeguards for sensitive administrative permissions.">
          <PolicyToggle title="Require audit visibility for settings managers" description="Users who can manage hospital settings must also be able to view audit logs." checked={auditRequired} onChange={setAuditRequired} />
          <PolicyToggle title="Require hospital admin approval for full access" description="Full access changes must be approved by a hospital admin before they take effect." checked={adminApproval} onChange={setAdminApproval} />
          <SaveNotice>Dedicated role-policy persistence is not available in the backend yet. Team member permissions exist, but policy defaults still need a settings contract.</SaveNotice>
        </SettingsPanel>

        <SettingsPanel title="Workspace Administration" description="Default access profiles mapped to hospital roles.">
          <RolesTable />
        </SettingsPanel>

        <SettingsPanel title="Permission Dependency Rules" description="Permissions that depend on another capability are listed here.">
          <DependencyRules />
        </SettingsPanel>
      </div>

      <UnsavedFooter dirty={dirty}><Button type="button" variant="outline" onClick={reset} className="h-10 rounded-lg font-semibold"><RotateCcw className="h-4 w-4" />Discard Changes</Button><Button type="button" onClick={() => unavailableRolePolicy("Save role permission policies")} className="h-10 rounded-lg font-semibold"><Save className="h-4 w-4" />Save Changes</Button></UnsavedFooter>
    </div>
  );
}
