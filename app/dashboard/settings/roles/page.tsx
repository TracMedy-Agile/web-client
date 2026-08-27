"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";

import { InfoBanner, SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  AdministrativePowerTable,
  DependencyRulesPanel,
  PolicyToggle,
  RoleCard,
  UnsavedFooter,
  permissionPolicies,
  roleAccess,
  unavailableRolePolicy,
  type PermissionPolicyKey,
} from "@/app/dashboard/settings/roles/components";

function defaultPolicyState(): Record<PermissionPolicyKey, boolean> {
  return Object.fromEntries(permissionPolicies.map((policy) => [policy.key, policy.defaultChecked])) as Record<PermissionPolicyKey, boolean>;
}

export default function RolesPage() {
  const [policies, setPolicies] = useState<Record<PermissionPolicyKey, boolean>>(defaultPolicyState);
  const dirty = permissionPolicies.some((policy) => policies[policy.key] !== policy.defaultChecked);

  useEffect(() => {
    capturePostHogEvent("settings_roles_viewed");
  }, []);

  function reset() {
    setPolicies(defaultPolicyState());
    capturePostHogEvent("settings_roles_reset");
  }

  return (
    <div>
      <SettingsHeader title="Roles & Permissions" description="Configure the default access model and permission governance for your hospital workspace." />

      <InfoBanner>
        Role defaults apply only to newly invited team members. Existing members retain their current permissions unless updated individually from the{" "}
        <Link href="/dashboard/team" className="font-semibold underline">Team module</Link>.
      </InfoBanner>

      <div className="mt-5 space-y-5">
        <SettingsPanel title="Default Role Access" description="Configure the default access assigned to newly invited team members.">
          <div className="grid gap-4 xl:grid-cols-3">
            {roleAccess.map((role) => <RoleCard key={role.role} {...role} />)}
          </div>
        </SettingsPanel>

        <SettingsPanel title="Permission Policies" description="Define how permissions behave across the hospital workspace.">
          <div className="grid gap-4 md:grid-cols-2">
            {permissionPolicies.map((policy) => (
              <PolicyToggle
                key={policy.key}
                title={policy.title}
                description={policy.description}
                checked={policies[policy.key]}
                onChange={(checked) => setPolicies((current) => ({ ...current, [policy.key]: checked }))}
              />
            ))}
          </div>
        </SettingsPanel>

        <SettingsPanel title="Workspace Administration" description="Configure who is allowed to perform administrative actions.">
          <AdministrativePowerTable />
        </SettingsPanel>

        <DependencyRulesPanel />
      </div>

      <UnsavedFooter dirty={dirty}>
        <Button type="button" variant="outline" onClick={reset} className="h-10 rounded-lg font-semibold">
          <RotateCcw className="h-4 w-4" />
          Discard Changes
        </Button>
        <Button type="button" onClick={() => unavailableRolePolicy("Save role permission policies")} className="h-10 rounded-lg font-semibold">
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </UnsavedFooter>
    </div>
  );
}
