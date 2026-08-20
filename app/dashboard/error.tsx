"use client";

import AccessDeniedState from "@/components/system/AccessDeniedState";
import NetworkErrorState from "@/components/system/NetworkErrorState";
import { isAccessDeniedError, isNetworkError } from "@/lib/api/errors";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  if (isAccessDeniedError(error)) return <AccessDeniedState />;
  if (isNetworkError(error)) return <NetworkErrorState onRetry={reset} />;

  return (
    <section role="alert" className="flex min-h-full items-center justify-center px-2 py-8 md:px-6">
      <div className="flex min-h-[470px] w-full max-w-2xl flex-col items-center justify-center rounded-xl bg-card px-6 py-12 text-center shadow-[0_12px_36px_rgba(15,39,71,0.04)] md:min-h-[610px]">
        <h2 className="text-2xl font-bold text-foreground md:text-[28px]">Something went wrong</h2>
        <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground md:text-lg">
          The screen could not be loaded. Please try again.
        </p>
        <button type="button" onClick={reset} className="mt-10 inline-flex h-12 min-w-40 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">
          Try Again
        </button>
      </div>
    </section>
  );
}
