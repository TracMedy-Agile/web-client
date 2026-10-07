"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";

import { SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { InfoBanner } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getPermissionOptions, getRoleTemplates } from "@/lib/api/roles";
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
  type RoleAccessLevel,
} from "@/app/dashboard/settings/roles/components";

type RoleCardData = { role: string; accessLevel: RoleAccessLevel; description: string; permissionCount: number; previewPermissions: readonly string[]; permissions: readonly string[]; lastUpdated: string };

const initialRoleAccess: RoleCardData[] = roleAccess.map((role) => ({ ...role }));

function defaultPolicyState(): Record<PermissionPolicyKey, boolean> {
  return Object.fromEntries(permissionPolicies.map((policy) => [policy.key, policy.defaultChecked])) as Record<PermissionPolicyKey, boolean>;
}

function roleKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function formatUpdatedDate(value: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleCardData[]>(initialRoleAccess);
  const [policies, setPolicies] = useState<Record<PermissionPolicyKey, boolean>>(defaultPolicyState);
  const dirty = permissionPolicies.some((policy) => policies[policy.key] !== policy.defaultChecked);

  useEffect(() => {
    capturePostHogEvent("settings_roles_viewed");
    let active = true;
    void Promise.all([getRoleTemplates(), getPermissionOptions()])
      .then(([templates, options]) => {
        if (!active || templates.length === 0) return;
        const labels = new Map(options.map((option) => [option.key, option.label]));
        setRoles(roleAccess.map((role): RoleCardData => {
          const template = templates.find((item) => roleKey(item.key) === roleKey(role.role) || roleKey(item.name) === roleKey(role.role));
          if (!template) return role;
          const permissions = template.permissions.map((permission) => labels.get(permission) ?? permission);
          return {
            ...role,
            description: template.description || role.description,
            permissionCount: permissions.length,
            previewPermissions: permissions.slice(0, 3),
            permissions,
            lastUpdated: formatUpdatedDate(template.updatedAt, role.lastUpdated),
          };
        }));
      })
      .catch(() => {
        // Preserve the design defaults when the role endpoints are unavailable.
      });
    return () => {
      active = false;
    };
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
            {roles.map((role) => <RoleCard key={role.role} {...role} />)}
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
