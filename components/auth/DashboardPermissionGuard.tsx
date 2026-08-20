"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  canAccessDashboardPermission,
  useDashboardUser,
} from "@/components/auth/DashboardUserProvider";
import AccessDeniedState from "@/components/system/AccessDeniedState";
import NetworkErrorState from "@/components/system/NetworkErrorState";

type DashboardPermission =
  | "care_episode"
  | "appointments"
  | "manage_team_members"
  | "audit_log"
  | "view_all_reports"
  | "configure_settings";

type GuardedRoute = {
  prefix: string;
  permission: DashboardPermission;
};

const GUARDED_ROUTES: readonly GuardedRoute[] = [
  { prefix: "/dashboard/connected-patients", permission: "care_episode" },
  { prefix: "/dashboard/care-episodes", permission: "care_episode" },
  { prefix: "/dashboard/alerts", permission: "care_episode" },
  { prefix: "/dashboard/messages", permission: "care_episode" },
  { prefix: "/dashboard/appointments", permission: "appointments" },
  { prefix: "/dashboard/reports", permission: "view_all_reports" },
  { prefix: "/dashboard/team", permission: "manage_team_members" },
  { prefix: "/dashboard/audit-logs", permission: "audit_log" },
  { prefix: "/dashboard/audit", permission: "audit_log" },
  { prefix: "/dashboard/settings", permission: "configure_settings" },
] as const;

function requiredPermissionForPath(pathname: string) {
  return GUARDED_ROUTES.find((route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`))?.permission ?? null;
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

  if (status === "loading") {
    return <AccessCheckSkeleton />;
  }

  if (status === "network-error") {
    return <NetworkErrorState onRetry={refetch} />;
  }

  if (status === "access-denied") {
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