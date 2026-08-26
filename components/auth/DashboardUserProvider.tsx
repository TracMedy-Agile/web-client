"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiClient } from "@/lib/services/auth/api-client";

type DashboardUser = {
  id: string;
  name: string;
  role: string;
  systemRole: string;
  specialty: string;
  facilityId: string;
  hospitalId: string;
  avatarUrl: string;
  accessProfile: string;
  permissions: string[];
  permissionsLoaded: boolean;
};

type DashboardUserContextValue = {
  user: DashboardUser | null;
  role: string | null;
  status: "loading" | "ready" | "error" | "network-error" | "access-denied";
  hasPermission: (permission: string) => boolean;
  refetch: () => void;
  updateUser: (patch: Partial<Pick<DashboardUser, "name" | "avatarUrl">>) => void;
};

const DashboardUserContext = createContext<DashboardUserContextValue | null>(null);

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstString(record: Record<string, unknown> | null, keys: readonly string[]) {
  if (!record) return "";
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return "";
}

function ownValue(record: Record<string, unknown> | null, key: string) {
  if (!record || !Object.prototype.hasOwnProperty.call(record, key)) return undefined;
  return record[key];
}

const PERMISSION_KEYS = ["permissions", "permissionKeys", "grantedPermissions", "accessPermissions", "scopes"] as const;
const STRICT_PERMISSIONS = new Set(["connected_patients", "care_episode", "appointments", "alerts", "messages", "configure_settings", "view_all_reports"]);

function permissionValues(record: Record<string, unknown> | null) {
  const key = PERMISSION_KEYS.find((permissionKey) => typeof ownValue(record, permissionKey) !== "undefined");
  const rawPermissions = key ? ownValue(record, key) : undefined;
  if (typeof rawPermissions === "undefined") return null;
  if (!Array.isArray(rawPermissions)) {
    const permission = asString(rawPermissions);
    return permission ? [permission] : [];
  }
  return rawPermissions
    .map((permission) => asString(permission))
    .filter(Boolean);
}

function normalizePermissionKey(permission: string) {
  const key = permission.trim().toLowerCase();
  if (key === "view_connected_patients" || key === "manage_patients") return "connected_patients";
  if (key === "view_care_episodes" || key === "manage_care_episodes") return "care_episode";
  if (key === "view_alerts" || key === "acknowledge" || key === "acknowledge_alerts") return "alerts";
  if (key === "view_messages" || key === "send_messages") return "messages";
  return key;
}

function uniquePermissions(permissions: readonly string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const permission of permissions) {
    const key = normalizePermissionKey(permission);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }
  return normalized;
}

function unwrapAuthPayload(payload: unknown) {
  const root = asRecord(payload);
  const outer = asRecord(root?.data) ?? root;
  return asRecord(outer?.user) ?? asRecord(outer?.staff) ?? asRecord(outer?.clinician) ?? asRecord(outer?.profile) ?? outer;
}

function permissionRecords(payload: unknown) {
  const root = asRecord(payload);
  const outer = asRecord(root?.data) ?? root;
  const data = unwrapAuthPayload(payload);
  const records: Array<Record<string, unknown> | null> = [data, outer, root];
  const nestedKeys = ["user", "staff", "clinician", "profile", "teamMember", "member", "access", "authorization"] as const;

  for (const record of [data, outer, root]) {
    for (const key of nestedKeys) {
      records.push(asRecord(record?.[key]));
    }
  }

  return records;
}

function resolvePermissions(payload: unknown) {
  const permissions: string[] = [];
  let permissionsLoaded = false;

  for (const record of permissionRecords(payload)) {
    const values = permissionValues(record);
    if (values === null) continue;
    permissionsLoaded = true;
    permissions.push(...values);
  }

  return {
    permissions: uniquePermissions(permissions),
    permissionsLoaded,
  };
}

export function isDashboardAdmin(user: DashboardUser | null) {
  if (!user) return false;
  const roles = [user.role, user.systemRole].map((role) => role.toLowerCase());
  return roles.some((role) => role === "admin" || role === "hospital_admin" || role.endsWith("_admin"));
}

export function canAccessDashboardPermission(user: DashboardUser | null, permission: string) {
  if (!user) return false;
  if (isDashboardAdmin(user)) return true;
  if (!user.permissionsLoaded) return !STRICT_PERMISSIONS.has(permission);
  return user.accessProfile === "full_access" || user.permissions.includes("full_system_access") || user.permissions.includes(permission);
}

function parseUser(payload: unknown): DashboardUser | null {
  const root = asRecord(payload);
  const outer = asRecord(root?.data) ?? root;
  const data = unwrapAuthPayload(payload);
  if (!data) return null;

  const role = firstString(data, ["role", "userRole", "accountRole"]) || firstString(outer, ["role", "userRole", "accountRole"]);
  const systemRole = firstString(data, ["systemRole", "roleType"]) || firstString(outer, ["systemRole", "roleType"]);
  const resolvedPermissions = resolvePermissions(payload);

  const facility = asRecord(data.facility) ?? asRecord(outer?.facility) ?? asRecord(data.hospital) ?? asRecord(outer?.hospital);
  const facilityName = firstString(facility, ["name", "facilityName", "hospitalName"]);
  const specificName = firstString(data, ["fullName", "displayName", "staffName", "clinicianName", "userName"]);
  const genericName = firstString(data, ["name"]);
  const email = firstString(data, ["email"]);
  const emailFallback = email ? email.split("@")[0] : "";
  const resolvedName = specificName || (genericName && genericName !== facilityName ? genericName : "") || emailFallback || "Staff member";

  return {
    id: firstString(data, ["id", "userId", "staffId", "clinicianId"]),
    name: resolvedName,
    role: role || "staff",
    systemRole,
    specialty: firstString(data, ["specialty", "department", "ward", "title"]),
    facilityId: firstString(data, ["facilityId"]) || firstString(facility, ["id", "facilityId"]),
    hospitalId: firstString(data, ["hospitalId"]) || firstString(facility, ["hospitalId", "tracId"]),
    avatarUrl: firstString(data, ["avatarUrl", "photoUrl"]),
    accessProfile: firstString(data, ["accessProfile", "accessLevel"]) || firstString(outer, ["accessProfile", "accessLevel"]),
    permissions: resolvedPermissions.permissions,
    permissionsLoaded: resolvedPermissions.permissionsLoaded,
  };
}

export default function DashboardUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [status, setStatus] = useState<DashboardUserContextValue["status"]>("loading");
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    apiClient("/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!isActive) return;
        if (!response.ok) {
          setStatus(response.status === 403 ? "access-denied" : "error");
          return;
        }
        const nextUser = parseUser(await response.json());
        setUser(nextUser);
        setStatus(nextUser ? "ready" : "error");
      })
      .catch(() => {
        if (isActive) setStatus("network-error");
      });

    return () => {
      isActive = false;
    };
  }, [requestKey]);

  const refetch = useCallback(() => {
    setStatus("loading");
    setRequestKey((value) => value + 1);
  }, []);

  // Patches the cached user in place (e.g. after saving a profile photo/name) without
  // refetching — refetch() flips status to "loading", which RoleGuard treats as a full
  // page remount, so it's too heavy for a same-session local update.
  const updateUser = useCallback((patch: Partial<Pick<DashboardUser, "name" | "avatarUrl">>) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const value = useMemo<DashboardUserContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      status,
      hasPermission: (permission: string) => canAccessDashboardPermission(user, permission),
      refetch,
      updateUser,
    }),
    [refetch, status, updateUser, user],
  );

  return <DashboardUserContext.Provider value={value}>{children}</DashboardUserContext.Provider>;
}

export function useDashboardUser() {
  const context = useContext(DashboardUserContext);
  if (!context) {
    throw new Error("useDashboardUser must be used inside DashboardUserProvider.");
  }
  return context;
}
