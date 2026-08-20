"use client";

import type { ReactNode } from "react";
import { useDashboardUser } from "@/components/auth/DashboardUserProvider";
import AccessDeniedState from "@/components/system/AccessDeniedState";
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

  if (status === "access-denied") {
    return <AccessDeniedState />;
  }

  if (status === "network-error") {
    return <NetworkErrorState onRetry={refetch} />;
  }

  if (status === "error") {
    return (
      <section role="alert" className="flex min-h-full items-center justify-center px-2 py-8 md:px-6">
        <div className="flex min-h-[470px] w-full max-w-2xl flex-col items-center justify-center rounded-xl bg-card px-6 py-12 text-center shadow-[0_12px_36px_rgba(15,39,71,0.04)] md:min-h-[610px]">
          <h2 className="text-2xl font-bold text-foreground md:text-[28px]">Unable to verify access</h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground md:text-lg">
            We could not confirm your workspace access right now. Please try again.
          </p>
          <button type="button" onClick={refetch} className="mt-10 inline-flex h-12 min-w-40 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">
            Try Again
          </button>
        </div>
      </section>
    );
  }

  return children;
}
