"use client";

import type { ReactNode } from "react";
import { useDashboardUser } from "@/components/auth/DashboardUserProvider";
import type { UserRole } from "@/lib/types/auth";

export function RoleGate({
  allowedRoles,
  children,
  fallback = null,
}: {
  allowedRoles: readonly UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { role, status } = useDashboardUser();
  if (status !== "ready" || !role || !allowedRoles.includes(role)) return fallback;
  return children;
}

export default RoleGate;
