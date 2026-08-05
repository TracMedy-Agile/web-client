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
import type { UserRole } from "@/lib/types/auth";

type DashboardUser = {
  id: string;
  name: string;
  role: UserRole;
  specialty: string;
  facilityId: string;
  hospitalId: string;
};

type DashboardUserContextValue = {
  user: DashboardUser | null;
  role: UserRole | null;
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
  return typeof value === "string" ? value : "";
}

function parseUser(payload: unknown): DashboardUser | null {
  const root = asRecord(payload);
  const outer = asRecord(root?.data) ?? root;
  const data = asRecord(outer?.user) ?? outer;
  if (!data) return null;
  const role = asString(data.role);
  if (!["patient", "clinician", "hospital_admin", "tracmedy_admin"].includes(role)) {
    return null;
  }
  return {
    id: asString(data.id),
    name: asString(data.name),
    role: role as UserRole,
    specialty: asString(data.specialty),
    facilityId: asString(data.facilityId),
    hospitalId: asString(data.hospitalId),
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
