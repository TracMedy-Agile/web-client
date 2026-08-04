"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Loader2, TimerOff } from "lucide-react";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

export default function SessionExpiredPage() {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    capturePostHogEvent("session_expired_viewed");
  }, []);

  async function returnToLogin() {
    setIsLeaving(true);
    capturePostHogEvent("session_login_clicked");
    try {
      await fetch("/api/auth/set-tokens", {
        method: "DELETE",
        credentials: "include",
      });
    } finally {
      window.location.replace("/login");
    }
  }

  return (
    <main className="grid min-h-screen grid-rows-[104px_1fr] bg-card font-sans lg:grid-cols-2 lg:grid-rows-1">
      <section className="bg-primary px-6 py-6 text-primary-foreground sm:px-10 lg:p-10">
        <div className="flex items-center gap-3">
          <Image src="/favicon.svg" alt="" width={40} height={40} />
          <span className="text-lg font-bold tracking-wide">TRACMEDY</span>
        </div>
      </section>

      <section className="flex items-center justify-center bg-card px-6 py-12">
        <div className="w-full max-w-lg text-center">
          <div className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-card shadow-sm">
              <TimerOff className="h-11 w-11 text-primary" strokeWidth={2} />
            </span>
            <span
              aria-hidden="true"
              className="absolute bottom-1 right-0 h-5 w-5 rounded-full border-2 border-card bg-destructive"
            />
          </div>

          <h1 className="text-2xl font-bold text-foreground md:text-[28px]">Session Expired</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground md:text-lg">
            For your security, you&apos;ve been signed out.
            <br />
            Please sign in again to continue.
          </p>

          <button
            type="button"
            onClick={() => void returnToLogin()}
            disabled={isLeaving}
            className="mt-10 inline-flex h-12 min-w-36 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70"
          >
            {isLeaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Log In Again
          </button>
        </div>
      </section>
    </main>
  );
}
