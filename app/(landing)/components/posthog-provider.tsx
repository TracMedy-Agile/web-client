"use client";

import { useEffect } from "react";
import { initPostHog } from "@/lib/analytics/posthog";

type PostHogProviderProps = {
  children: React.ReactNode;
};

export function PostHogProvider({ children }: PostHogProviderProps) {
  useEffect(() => {
    initPostHog();
  }, []);

  return <>{children}</>;
}