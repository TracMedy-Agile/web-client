"use client";

import { useEffect } from "react";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

export default function LandingPageTracker() {
  useEffect(() => {
    capturePostHogEvent("landing_page_viewed");
  }, []);

  return null;
}