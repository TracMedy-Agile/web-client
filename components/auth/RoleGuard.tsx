"use client";

import type { ReactNode } from "react";
import { useDashboardUser } from "@/components/auth/DashboardUserProvider";
import NetworkErrorState from "@/components/system/NetworkErrorState";

type RoleGuardProps = {
  allowedRoles?: readonly string[];
  children: ReactNode;
  deniedDescription?: string;
};

export default function RoleGuard({ children }: RoleGuardProps) {
  const { status, refetch } = useDashboardUser();

  if (status === "loading") {
    return (
      <div
        aria-label="Checking page access"
        className="min-h-[calc(100vh-7rem)] animate-pulse rounded-xl bg-muted"
      />
    );
  }

  if (status === "error") {
    return <NetworkErrorState onRetry={refetch} />;
  }

  return children;
}
