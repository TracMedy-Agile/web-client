import { apiClient } from "@/lib/services/auth/api-client";

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

async function request(path: string): Promise<unknown> {
  const response = await apiClient(path);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const record = asRecord(payload);
    throw new Error(typeof record?.message === "string" ? record.message : "Unable to load role permissions.");
  }
  return unwrap(payload);
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
