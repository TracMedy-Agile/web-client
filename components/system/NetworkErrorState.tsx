"use client";

import { useEffect, useState } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

type NetworkErrorStateProps = {
  onRetry?: () => void | Promise<void>;
};

export default function NetworkErrorState({ onRetry }: NetworkErrorStateProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    capturePostHogEvent("network_error_viewed");
  }, []);

  async function retryConnection() {
    setIsRetrying(true);
    capturePostHogEvent("network_retry_clicked");
    try {
      await onRetry?.();
    } finally {
      setIsRetrying(false);
    }
  }

  function reloadPage() {
    capturePostHogEvent("network_reload_clicked");
    window.location.reload();
  }

  return (
    <section
      aria-labelledby="network-error-title"
      className="flex min-h-full items-center justify-center px-2 py-8 md:px-6"
    >
      <div className="flex min-h-[470px] w-full max-w-2xl flex-col items-center justify-center rounded-xl bg-card px-6 py-12 text-center shadow-[0_12px_36px_rgba(15,39,71,0.04)] md:min-h-[610px]">
        <div className="mb-9 flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-muted bg-card shadow-sm">
          <WifiOff className="h-12 w-12 text-primary" strokeWidth={2.4} />
        </div>

        <h2 id="network-error-title" className="text-2xl font-bold text-foreground md:text-[28px]">
          Connection Interrupted
        </h2>
        <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground md:text-lg">
          We are unable to reach the servers.
          <br />
          Please check your internet connection and try again
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <button
            type="button"
            onClick={() => void retryConnection()}
            disabled={isRetrying}
            className="inline-flex h-12 min-w-40 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70"
          >
            {isRetrying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Retry Connection
          </button>
          <button
            type="button"
            onClick={reloadPage}
            className="inline-flex h-12 min-w-40 items-center justify-center rounded-xl border border-primary/55 bg-card px-6 text-sm font-bold text-muted-foreground transition hover:bg-muted"
          >
            Reload Page
          </button>
        </div>
      </div>
    </section>
  );
}
