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

// Only routes backed by real server-side enforcement are gated here. As of the Phase 12.6 backend
// pass, TeamPermissionGuard is wired onto team.controller.ts (manage_team_members),
// audit.controller.ts (audit_log), care-episodes.controller.ts (care_episode),
// appointment.controller.ts (appointments), and analytics.controller.ts (view_all_reports) — and
// the Team edit UI maps those five checkboxes directly to their matching backend values (no
// collapsing), so they're both enforced AND satisfiable. connected_patients/alerts/messages are
// NOT gated here: no facility/alerts/messaging route checks them, and the Team edit UI still
// collapses all three of those checkboxes into the single `care_episode` value on save (see
// TeamMemberActions.tsx), so the backend can never store those literal strings — gating those
// pages would permanently lock clinicians out with no checkbox able to restore access.
// Settings (`configure_settings`) is gated too, restoring a restriction that used to live in
// middleware.ts and was dropped as a side effect of the login/session security-hardening rewrite —
// Settings is meant to be hospital_admin-only. Nothing on the backend checks `configure_settings`
// yet, and `/auth/me` doesn't return a clinician's actual granted permissions at all (see
// docs/backend.md), so `canAccessDashboardPermission`'s fallback currently makes this behave as
// blanket hospital_admin-only for every STRICT_PERMISSIONS entry, care_episode/appointments/
// view_all_reports included — that's a real, separate backend bug, not something this route
// addition causes. Once `/auth/me` is fixed to include a clinician's `FacilityStaffMember`
// permissions, a clinician actually granted `configure_settings` will correctly gain access here
// instead of this staying admin-only forever.
const GUARDED_ROUTES: readonly GuardedRoute[] = [
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
  const backendAccessDenied = backendAccessDeniedPath === pathname;

  useEffect(() => {
    let active = true;
    const originalFetch = window.fetch;

    const guardedFetch: typeof window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (active && response.status === 403 && isDashboardApiRequest(args[0])) {
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

  const requiredPermission = requiredPermissionForPath(pathname);
  if (requiredPermission && !canAccessDashboardPermission(user, requiredPermission)) {
    return (
      <AccessDeniedState description="Your hospital has not granted your account permission to view this screen." />
    );
  }

  return children;
}