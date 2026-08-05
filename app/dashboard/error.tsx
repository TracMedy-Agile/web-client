"use client";

import NetworkErrorState from "@/components/system/NetworkErrorState";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <NetworkErrorState onRetry={reset} />;
}
