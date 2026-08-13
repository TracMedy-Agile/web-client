"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, RotateCcw, Save } from "lucide-react";

import { SaveNotice, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { DependencyRules, PolicyToggle, RolesTable, UnsavedFooter, permissionGroups, roleAccess, unavailableRolePolicy } from "@/app/dashboard/settings/roles/components";

const defaultSelected: Set<string> = new Set(permissionGroups.flatMap((group) => group.items));

export default function ExpandedRolesPage() {
  const [selected, setSelected] = useState(defaultSelected);
  const [auditRequired, setAuditRequired] = useState(true);
  const [adminApproval, setAdminApproval] = useState(true);
  const dirty = selected.size !== defaultSelected.size || auditRequired !== true || adminApproval !== true;

  useEffect(() => {
    capturePostHogEvent("settings_roles_viewed", { expanded: true });
  }, []);

  function toggle(permission: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(permission);
      else next.delete(permission);
      return next;
    });
  }

  function reset() {
    setSelected(defaultSelected);
    setAuditRequired(true);
    setAdminApproval(true);
    capturePostHogEvent("settings_roles_reset", { expanded: true });
  }

  return (
    <div>
      <SettingsHeader title="Roles & Permissions" description="Expanded permission controls for role defaults, policy safeguards, workspace administration, and dependency rules." />
      <Button type="button" asChild variant="outline" className="mb-5 h-10 rounded-lg font-semibold"><Link href="/dashboard/settings/roles"><ChevronLeft className="h-4 w-4" />Back to roles</Link></Button>

      <SettingsPanel title="Default Role Access" description="Expanded view of role defaults and granular permissions.">
        <div className="grid gap-4 xl:grid-cols-3">{roleAccess.map((role) => <div key={role.role} className="rounded-lg border border-border bg-background p-4"><h3 className="text-base font-bold text-foreground">{role.role}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{role.description}</p><div className="mt-4 space-y-2">{role.permissions.map((permission) => <label key={permission} className="flex cursor-pointer items-center gap-3 rounded-lg bg-card px-3 py-2 text-sm font-semibold text-foreground"><input type="checkbox" checked={selected.has(permission)} onChange={(event) => toggle(permission, event.target.checked)} className="h-4 w-4 accent-primary" />{permission}</label>)}</div></div>)}</div>
      </SettingsPanel>

      <div className="mt-5 space-y-5">
        <SettingsPanel title="Permission Groups" description="Expand each permission group to review or change granular access.">
          <Accordion type="multiple" defaultValue={permissionGroups.map((group) => group.title)} className="rounded-lg border border-border bg-background px-4">
            {permissionGroups.map((group) => {
              const Icon = group.icon;
              return <AccordionItem key={group.title} value={group.title} className="border-border"><AccordionTrigger className="text-left text-base font-bold hover:no-underline"><span className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{group.title}</span></AccordionTrigger><AccordionContent><div className="grid gap-2 md:grid-cols-2">{group.items.map((permission) => <label key={permission} className="flex cursor-pointer items-center gap-3 rounded-lg bg-card px-3 py-2 text-sm font-semibold text-foreground"><input type="checkbox" checked={selected.has(permission)} onChange={(event) => toggle(permission, event.target.checked)} className="h-4 w-4 accent-primary" />{permission}</label>)}</div></AccordionContent></AccordionItem>;
            })}
          </Accordion>
        </SettingsPanel>

        <SettingsPanel title="Permission Policies" description="Policy switches for sensitive workspace administration access.">
          <PolicyToggle title="Require audit visibility for settings managers" description="Users who can manage hospital settings must also be able to view audit logs." checked={auditRequired} onChange={setAuditRequired} />
          <PolicyToggle title="Require hospital admin approval for full access" description="Full access changes must be approved by a hospital admin before they take effect." checked={adminApproval} onChange={setAdminApproval} />
          <SaveNotice>Expanded role defaults are UI-ready. A dedicated backend settings contract is required before policy defaults can persist.</SaveNotice>
        </SettingsPanel>

        <SettingsPanel title="Workspace Administration" description="Grant/edit table for workspace-level administration roles.">
          <RolesTable expanded />
        </SettingsPanel>

        <SettingsPanel title="Permission Dependency Rules" description="Dependency rules that prevent unsafe permission combinations.">
          <DependencyRules />
        </SettingsPanel>
      </div>

      <UnsavedFooter dirty={dirty}><Button type="button" variant="outline" onClick={reset} className="h-10 rounded-lg font-semibold"><RotateCcw className="h-4 w-4" />Discard Changes</Button><Button type="button" onClick={() => unavailableRolePolicy("Save expanded role permission policies")} className="h-10 rounded-lg font-semibold"><Save className="h-4 w-4" />Save Changes</Button></UnsavedFooter>
    </div>
  );
}
