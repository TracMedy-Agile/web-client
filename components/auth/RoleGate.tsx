"use client";

import type { ReactNode } from "react";

export function RoleGate({
  children,
}: {
  allowedRoles?: readonly string[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return children;
}

export default RoleGate;
