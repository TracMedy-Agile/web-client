"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { SettingsHeader, SettingsPanel } from "@/app/dashboard/settings/components";
import { InfoBanner } from "@/app/dashboard/settings/components";
import { Button } from "@/components/ui/button";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  getPermissionDependencyRules,
  getPermissionOptions,
  getPermissionPolicies,
  getRoleTemplates,
  getWorkspaceAdministration,
  updatePermissionPolicies,
  updateWorkspaceAdministration,
  type FacilityPermissionPolicies,
  type FacilityWorkspaceAdministration,
  type PermissionDependencyRule,
} from "@/lib/api/roles";
import {
  AdministrativePowerTable,
  DependencyRulesPanel,
  PolicyToggle,
  RoleCard,
  UnsavedFooter,
  permissionPolicies,
  administrativePowers,
  grantOptions,
  roleAccess,
  type AdministrativePowerKey,
  type GrantOption,
  type PermissionPolicyKey,
  type RoleAccessLevel,
} from "@/app/dashboard/settings/roles/components";

type RoleCardData = { role: string; accessLevel: RoleAccessLevel; description: string; permissionCount: number; previewPermissions: readonly string[]; permissions: readonly string[]; lastUpdated: string };

const initialRoleAccess: RoleCardData[] = roleAccess.map((role) => ({ ...role }));

function defaultPolicyState(): Record<PermissionPolicyKey, boolean> {
  return Object.fromEntries(permissionPolicies.map((policy) => [policy.key, policy.defaultChecked])) as Record<PermissionPolicyKey, boolean>;
}

// Saved facility values for the known toggles; unknown/missing keys keep the design default.
function policyStateFrom(response: FacilityPermissionPolicies): Record<PermissionPolicyKey, boolean> {
  const saved = new Map(response.policies.map((policy) => [policy.key, policy.checked]));
  return Object.fromEntries(permissionPolicies.map((policy) => [policy.key, saved.get(policy.key) ?? policy.defaultChecked])) as Record<PermissionPolicyKey, boolean>;
}

type GrantState = Record<AdministrativePowerKey, GrantOption>;

function defaultGrantState(): GrantState {
  return Object.fromEntries(administrativePowers.map((power) => [power.key, power.grantedTo])) as GrantState;
}

// Saved facility grant scopes for the known powers; unknown/invalid values keep the design default.
function grantStateFrom(response: FacilityWorkspaceAdministration): GrantState {
  const saved = new Map(response.powers.map((power) => [power.key, power.grantedTo]));
  return Object.fromEntries(administrativePowers.map((power) => {
    const value = grantOptions.find((option) => option === saved.get(power.key));
    return [power.key, value ?? power.grantedTo];
  })) as GrantState;
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
  // Last state persisted on the backend — Discard restores it; dirty compares against it.
  const [savedPolicies, setSavedPolicies] = useState<Record<PermissionPolicyKey, boolean>>(defaultPolicyState);
  const [policiesLoaded, setPoliciesLoaded] = useState(false);
  const [grants, setGrants] = useState<GrantState>(defaultGrantState);
  const [savedGrants, setSavedGrants] = useState<GrantState>(defaultGrantState);
  const [grantsLoaded, setGrantsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dependencyRules, setDependencyRules] = useState<PermissionDependencyRule[] | null>(null);
  const [dependencyRulesError, setDependencyRulesError] = useState(false);
  const changedPolicyKeys = permissionPolicies.filter((policy) => policies[policy.key] !== savedPolicies[policy.key]).map((policy) => policy.key);
  const changedGrantKeys = administrativePowers.filter((power) => grants[power.key] !== savedGrants[power.key]).map((power) => power.key);
  const dirty = changedPolicyKeys.length > 0 || changedGrantKeys.length > 0;

  useEffect(() => {
    let active = true;
    getPermissionPolicies()
      .then((response) => {
        if (!active) return;
        const saved = policyStateFrom(response);
        setPolicies(saved);
        setSavedPolicies(saved);
        setPoliciesLoaded(true);
      })
      .catch(() => {
        if (active) toast.error("Unable to load saved permission policies.");
      });
    getWorkspaceAdministration()
      .then((response) => {
        if (!active) return;
        const saved = grantStateFrom(response);
        setGrants(saved);
        setSavedGrants(saved);
        setGrantsLoaded(true);
      })
      .catch(() => {
        if (active) toast.error("Unable to load workspace administration settings.");
      });
    getPermissionDependencyRules()
      .then((rules) => {
        if (active) setDependencyRules(rules);
      })
      .catch(() => {
        if (active) setDependencyRulesError(true);
      });
    return () => {
      active = false;
    };
  }, []);

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
    setPolicies(savedPolicies);
    setGrants(savedGrants);
    capturePostHogEvent("settings_roles_reset");
  }

  async function save() {
    if (!dirty || isSaving) return;
    setIsSaving(true);
    // Partial updates: send only the changed keys (backend audits exactly these).
    // Each section commits independently so one failure never discards the other's save.
    const [policyResult, grantResult] = await Promise.allSettled([
      changedPolicyKeys.length
        ? updatePermissionPolicies(Object.fromEntries(changedPolicyKeys.map((key) => [key, policies[key]])))
        : Promise.resolve(null),
      changedGrantKeys.length
        ? updateWorkspaceAdministration(Object.fromEntries(changedGrantKeys.map((key) => [key, grants[key]])))
        : Promise.resolve(null),
    ]);
    if (policyResult.status === "fulfilled" && policyResult.value) {
      const saved = policyStateFrom(policyResult.value);
      setPolicies(saved);
      setSavedPolicies(saved);
      setPoliciesLoaded(true);
    }
    if (grantResult.status === "fulfilled" && grantResult.value) {
      const saved = grantStateFrom(grantResult.value);
      setGrants(saved);
      setSavedGrants(saved);
      setGrantsLoaded(true);
    }
    const failure = [policyResult, grantResult].find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failure) {
      toast.error(failure.reason instanceof Error ? failure.reason.message : "Unable to save roles and permissions.");
    } else {
      capturePostHogEvent("settings_roles_saved", { changed_count: changedPolicyKeys.length + changedGrantKeys.length });
      toast.success("Roles and permissions saved.");
    }
    setIsSaving(false);
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
                disabled={!policiesLoaded || isSaving}
                onChange={(checked) => setPolicies((current) => ({ ...current, [policy.key]: checked }))}
              />
            ))}
          </div>
        </SettingsPanel>

        <SettingsPanel title="Workspace Administration" description="Configure who is allowed to perform administrative actions.">
          <AdministrativePowerTable
            values={grants}
            disabled={!grantsLoaded || isSaving}
            onChange={(key, value) => setGrants((current) => ({ ...current, [key]: value }))}
          />
        </SettingsPanel>

        <DependencyRulesPanel rules={dependencyRules} error={dependencyRulesError} />
      </div>

      <UnsavedFooter dirty={dirty}>
        <Button type="button" variant="outline" onClick={reset} disabled={!dirty || isSaving} className="h-10 rounded-lg font-semibold">
          <RotateCcw className="h-4 w-4" />
          Discard Changes
        </Button>
        <Button type="button" onClick={() => void save()} disabled={!dirty || isSaving} className="h-10 rounded-lg font-semibold">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </UnsavedFooter>
    </div>
  );
}
