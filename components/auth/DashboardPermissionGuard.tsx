"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  canAccessDashboardPermission,
  useDashboardUser,
} from "@/components/auth/DashboardUserProvider";
import AccessDeniedState from "@/components/system/AccessDeniedState";
import NetworkErrorState from "@/components/system/NetworkErrorState";

type DashboardPermission =
  | "connected_patients"
  | "care_episode"
  | "appointments"
  | "alerts"
  | "messages"
  | "manage_team_members"
  | "audit_log"
  | "view_all_reports"
  | "configure_settings";

type GuardedRoute = {
  prefix: string;
  permission: DashboardPermission;
};

// Routes with permission-backed screens are gated here. Connected Patients, Alerts, and
// Messages share the care_episode value in the current Team Management contract; the provider
// expands that bundle for the client so a removed care_episode grant becomes Access Restricted.
// The backend response is still authoritative for the actual API request.
const GUARDED_ROUTES: readonly GuardedRoute[] = [
  { prefix: "/dashboard/connected-patients", permission: "connected_patients" },
  { prefix: "/dashboard/alerts", permission: "alerts" },
  { prefix: "/dashboard/messages", permission: "messages" },
  { prefix: "/dashboard/team", permission: "manage_team_members" },
  { prefix: "/dashboard/audit-logs", permission: "audit_log" },
  { prefix: "/dashboard/audit", permission: "audit_log" },
  { prefix: "/dashboard/care-episodes", permission: "care_episode" },
  { prefix: "/dashboard/appointments", permission: "appointments" },
  { prefix: "/dashboard/reports", permission: "view_all_reports" },
  { prefix: "/dashboard/settings", permission: "configure_settings" },
] as const;

function requiredPermissionForPath(pathname: string) {
  return GUARDED_ROUTES.find((route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`))?.permission ?? null;
}

function isDashboardApiRequest(input: RequestInfo | URL) {
  const rawUrl = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;

  try {
    return new URL(rawUrl, window.location.origin).pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function AccessCheckSkeleton() {
  return (
    <div
      aria-label="Checking page access"
      className="min-h-[calc(100vh-7rem)] animate-pulse rounded-xl bg-muted"
    />
  );
}

function AccessCheckError({ onRetry }: { onRetry: () => void }) {
  return (
    <section role="alert" className="flex min-h-full items-center justify-center px-2 py-8 md:px-6">
      <div className="flex min-h-[470px] w-full max-w-2xl flex-col items-center justify-center rounded-xl bg-card px-6 py-12 text-center shadow-[0_12px_36px_rgba(15,39,71,0.04)] md:min-h-[610px]">
        <h2 className="text-2xl font-bold text-foreground md:text-[28px]">Unable to verify access</h2>
        <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground md:text-lg">
          We could not confirm your workspace access right now. Please try again.
        </p>
        <button type="button" onClick={onRetry} className="mt-10 inline-flex h-12 min-w-40 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">
          Try Again
        </button>
      </div>
    </section>
  );
}

export default function DashboardPermissionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status, user, refetch } = useDashboardUser();
  const [backendAccessDeniedPath, setBackendAccessDeniedPath] = useState<string | null>(null);
  const requiredPermission = requiredPermissionForPath(pathname);
  const backendAccessDenied = requiredPermission ? backendAccessDeniedPath === pathname && !canAccessDashboardPermission(user, requiredPermission) : false;

  useEffect(() => {
    let active = true;
    const originalFetch = window.fetch;

    const guardedFetch: typeof window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (active && response.status === 403 && isDashboardApiRequest(args[0]) && requiredPermissionForPath(window.location.pathname)) {
        setBackendAccessDeniedPath(window.location.pathname);
      }
      return response;
    };

    window.fetch = guardedFetch;
    return () => {
      active = false;
      if (window.fetch === guardedFetch) window.fetch = originalFetch;
    };
  }, []);

  if (status === "loading") {
    return <AccessCheckSkeleton />;
  }

  if (status === "network-error") {
    return <NetworkErrorState onRetry={refetch} />;
  }

  if (status === "access-denied" || backendAccessDenied) {
    return <AccessDeniedState />;
  }

  if (status === "error") {
    return <AccessCheckError onRetry={refetch} />;
  }

  if (requiredPermission && !canAccessDashboardPermission(user, requiredPermission)) {
    return (
      <AccessDeniedState description="Your hospital has not granted your account permission to view this screen." />
    );
  }

  return children;
}