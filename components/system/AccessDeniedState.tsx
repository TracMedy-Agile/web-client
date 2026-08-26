"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LayoutGrid, LockKeyhole, UserRound } from "lucide-react";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

type AccessDeniedStateProps = {
  description?: string;
};

export default function AccessDeniedState({
  description = "This area is restricted to authorized personnel only.",
}: AccessDeniedStateProps) {
  useEffect(() => {
    capturePostHogEvent("access_denied_viewed");
  }, []);

  return (
    <section
      aria-labelledby="access-denied-title"
      className="flex min-h-full items-center justify-center px-2 py-8 md:px-6"
    >
      <div className="flex min-h-[470px] w-full max-w-2xl flex-col items-center justify-center rounded-xl bg-card px-6 py-12 text-center shadow-[0_12px_36px_rgba(15,39,71,0.04)] md:min-h-[610px]">
        <div className="relative mb-10 flex h-32 w-32 items-center justify-center rounded-2xl border border-border bg-card shadow-md">
          <LockKeyhole className="h-14 w-14 text-primary" strokeWidth={2.2} />
          <span className="absolute bottom-8 right-7 flex h-7 w-7 items-center justify-center rounded-full border-4 border-card bg-primary text-primary-foreground">
            <UserRound className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          <span
            aria-hidden="true"
            className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full border-4 border-card bg-destructive text-sm font-bold text-destructive-foreground"
          >
            !
          </span>
        </div>

        <h2 id="access-denied-title" className="text-2xl font-bold text-foreground md:text-[28px]">
          Access Restricted
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
          You do not have permission to access this page.
          <br />
          {description}
        </p>

        <Link
          href="/dashboard"
          onClick={() => capturePostHogEvent("access_denied_returned")}
          className="mt-10 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
        >
          <LayoutGrid className="h-5 w-5" />
          Return To Dashboard
        </Link>
      </div>
    </section>
  );
}
