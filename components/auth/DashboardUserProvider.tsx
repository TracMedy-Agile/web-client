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
  specialty: string;
  facilityId: string;
  hospitalId: string;
};

type DashboardUserContextValue = {
  user: DashboardUser | null;
  role: string | null;
  status: "loading" | "ready" | "error";
  refetch: () => void;
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

function unwrapAuthPayload(payload: unknown) {
  const root = asRecord(payload);
  const outer = asRecord(root?.data) ?? root;
  return asRecord(outer?.user) ?? asRecord(outer?.staff) ?? asRecord(outer?.clinician) ?? asRecord(outer?.profile) ?? outer;
}

function parseUser(payload: unknown): DashboardUser | null {
  const root = asRecord(payload);
  const outer = asRecord(root?.data) ?? root;
  const data = unwrapAuthPayload(payload);
  if (!data) return null;

  const role = firstString(data, ["role", "userRole", "accountRole"]) || firstString(outer, ["role", "userRole", "accountRole"]);

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
    specialty: firstString(data, ["specialty", "department", "ward", "title"]),
    facilityId: firstString(data, ["facilityId"]) || firstString(facility, ["id", "facilityId"]),
    hospitalId: firstString(data, ["hospitalId"]) || firstString(facility, ["hospitalId", "tracId"]),
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
          setStatus("error");
          return;
        }
        const nextUser = parseUser(await response.json());
        setUser(nextUser);
        setStatus(nextUser ? "ready" : "error");
      })
      .catch(() => {
        if (isActive) setStatus("error");
      });

    return () => {
      isActive = false;
    };
  }, [requestKey]);

  const refetch = useCallback(() => {
    setStatus("loading");
    setRequestKey((value) => value + 1);
  }, []);

  const value = useMemo<DashboardUserContextValue>(
    () => ({ user, role: user?.role ?? null, status, refetch }),
    [refetch, status, user],
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
