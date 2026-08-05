"use client";

import type { ReactNode } from "react";
import { useDashboardUser } from "@/components/auth/DashboardUserProvider";
import AccessDeniedState from "@/components/system/AccessDeniedState";
import NetworkErrorState from "@/components/system/NetworkErrorState";
import type { UserRole } from "@/lib/types/auth";

type RoleGuardProps = {
  allowedRoles: readonly UserRole[];
  children: ReactNode;
  deniedDescription?: string;
};

export default function RoleGuard({
  allowedRoles,
  children,
  deniedDescription,
}: RoleGuardProps) {
  const { role, status, refetch } = useDashboardUser();

  if (status === "loading") {
    return (
      <div
        aria-label="Checking page permissions"
        className="min-h-[calc(100vh-7rem)] animate-pulse rounded-xl bg-muted"
      />
    );
  }

  if (status === "error") {
    return <NetworkErrorState onRetry={refetch} />;
  }

  if (role && allowedRoles.includes(role)) {
    return children;
  }

  return <AccessDeniedState description={deniedDescription} />;
}
