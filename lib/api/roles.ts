import type { components } from "@/docs/types/api";
import { apiClient } from "@/lib/services/auth/api-client";

export type FacilityPermissionPolicies = components["schemas"]["FacilityPermissionPoliciesResponseDto"];
export type PermissionPolicyValues = components["schemas"]["PermissionPoliciesValueDto"];
export type FacilityWorkspaceAdministration = components["schemas"]["FacilityWorkspaceAdministrationResponseDto"];
export type WorkspaceGrantValues = components["schemas"]["WorkspaceGrantsValueDto"];
export type WorkspaceGrantScope = NonNullable<WorkspaceGrantValues["fullWorkspaceAccess"]>;

export type AdminPermissionOption = { key: string; label: string; module: string };
export type AdminRoleTemplate = {
  id: string;
  key: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function unwrap(value: unknown): unknown {
  const record = asRecord(value);
  return record && "data" in record ? record.data : value;
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await apiClient(path, init);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const record = asRecord(payload);
    throw new Error(typeof record?.message === "string" ? record.message : "Unable to load role permissions.");
  }
  return unwrap(payload);
}

function normalizePolicies(value: unknown): FacilityPermissionPolicies {
  const record = asRecord(value);
  const policies = Array.isArray(record?.policies) ? record.policies : [];
  return {
    policies: policies
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item?.key === "string")
      .map((item) => ({
        key: String(item.key),
        title: typeof item.title === "string" ? item.title : "",
        description: typeof item.description === "string" ? item.description : "",
        checked: item.checked === true,
        defaultChecked: item.defaultChecked === true,
      })),
    updatedAt: typeof record?.updatedAt === "string" ? record.updatedAt : null,
    updatedBy: typeof record?.updatedBy === "string" ? record.updatedBy : null,
  };
}

export type PermissionDependencyRule = { permission: string; requires: string[] };

// GET /team/roles/dependency-rules + /team/roles/permission-options — backend dependency graph,
// labelled from the facility permission catalog. Only permissions with prerequisites are returned.
export async function getPermissionDependencyRules(): Promise<PermissionDependencyRule[]> {
  const [rulesValue, optionsValue] = await Promise.all([
    request("/team/roles/dependency-rules"),
    request("/team/roles/permission-options"),
  ]);
  const labels = new Map<string, string>();
  for (const item of Array.isArray(optionsValue) ? optionsValue : []) {
    const record = asRecord(item);
    if (record && typeof record.key === "string" && typeof record.label === "string") labels.set(record.key, record.label);
  }
  const labelFor = (key: string) => labels.get(key) ?? key;
  return (Array.isArray(rulesValue) ? rulesValue : [])
    .map(asRecord)
    .filter((record): record is Record<string, unknown> => Boolean(record) && typeof record?.permissionKey === "string")
    .map((record) => ({
      permission: labelFor(String(record.permissionKey)),
      requires: (Array.isArray(record.requires) ? record.requires : [])
        .filter((key): key is string => typeof key === "string")
        .map(labelFor),
    }))
    .filter((rule) => rule.requires.length > 0);
}

function normalizeWorkspaceAdministration(value: unknown): FacilityWorkspaceAdministration {
  const record = asRecord(value);
  const powers = Array.isArray(record?.powers) ? record.powers : [];
  return {
    powers: powers
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item?.key === "string" && typeof item?.grantedTo === "string")
      .map((item) => ({
        key: String(item.key),
        label: typeof item.label === "string" ? item.label : String(item.key),
        grantedTo: String(item.grantedTo),
      })),
    grantOptions: Array.isArray(record?.grantOptions) ? record.grantOptions.filter((item): item is string => typeof item === "string") : [],
    updatedAt: typeof record?.updatedAt === "string" ? record.updatedAt : null,
    updatedBy: typeof record?.updatedBy === "string" ? record.updatedBy : null,
  };
}

// GET /team/roles/workspace-administration — who may grant/edit each administrative power.
export async function getWorkspaceAdministration(): Promise<FacilityWorkspaceAdministration> {
  return normalizeWorkspaceAdministration(await request("/team/roles/workspace-administration"));
}

// PUT /team/roles/workspace-administration — partial update; backend audits the changed keys.
export async function updateWorkspaceAdministration(grants: WorkspaceGrantValues): Promise<FacilityWorkspaceAdministration> {
  return normalizeWorkspaceAdministration(await request("/team/roles/workspace-administration", {
    method: "PUT",
    body: JSON.stringify({ grants }),
  }));
}

// GET /team/roles/permission-policies — facility-scoped toggles (effective + design-default values).
export async function getPermissionPolicies(): Promise<FacilityPermissionPolicies> {
  return normalizePolicies(await request("/team/roles/permission-policies"));
}

// PUT /team/roles/permission-policies — partial update; backend audits the changed keys.
export async function updatePermissionPolicies(policies: PermissionPolicyValues): Promise<FacilityPermissionPolicies> {
  return normalizePolicies(await request("/team/roles/permission-policies", {
    method: "PUT",
    body: JSON.stringify({ policies }),
  }));
}

function normalizeTemplate(value: unknown): AdminRoleTemplate | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string" || typeof record.key !== "string" || typeof record.name !== "string") return null;
  return {
    id: record.id,
    key: record.key,
    name: record.name,
    description: typeof record.description === "string" ? record.description : undefined,
    permissions: Array.isArray(record.permissions) ? record.permissions.filter((item): item is string => typeof item === "string") : [],
    isSystem: record.isSystem === true,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  };
}

export async function getRoleTemplates(): Promise<AdminRoleTemplate[]> {
  const value = unwrap(await request("/admin/roles/templates"));
  const list = Array.isArray(value) ? value : [];
  return list.map(normalizeTemplate).filter((item): item is AdminRoleTemplate => item !== null);
}

export async function getPermissionOptions(): Promise<AdminPermissionOption[]> {
  const value = unwrap(await request("/admin/roles/permission-options"));
  const list = Array.isArray(value) ? value : [];
  return list.map((item) => {
    const record = asRecord(item);
    if (!record || typeof record.key !== "string" || typeof record.label !== "string" || typeof record.module !== "string") return null;
    return { key: record.key, label: record.label, module: record.module };
  }).filter((item): item is AdminPermissionOption => item !== null);
}
