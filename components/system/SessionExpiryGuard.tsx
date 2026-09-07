"use client";

import { useEffect, type ReactNode } from "react";

const SESSION_EXPIRED_EVENT = "tracmedy:session-expired";
const MAX_TIMER_DELAY = 2_147_000_000;
const REFRESH_EARLY_MS = 30_000;

function getTokenExpiration(accessToken: string) {
  try {
    const encodedPayload = accessToken.split(".")[1];
    if (!encodedPayload) return null;
    const normalized = encodedPayload.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload: unknown = JSON.parse(window.atob(padded));
    if (
      typeof payload === "object" &&
      payload !== null &&
      "exp" in payload &&
      typeof payload.exp === "number"
    ) {
      return payload.exp * 1000;
    }
  } catch {
    return null;
  }
  return null;
}

async function endExpiredSession() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } finally {
    window.location.replace("/session-expired");
  }
}

export default function SessionExpiryGuard({ children }: { children: ReactNode }) {
  useEffect(() => {
    let timer: number | undefined;
    let isActive = true;

    const handleExpiredSession = () => {
      if (isActive) void endExpiredSession();
    };

    async function refreshSession() {
      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        if (!response.ok) {
          handleExpiredSession();
          return;
        }
        await scheduleExpirationCheck();
      } catch {
        handleExpiredSession();
      }
    }

    async function scheduleExpirationCheck() {
      try {
        const response = await fetch("/api/auth/get-token", {
          credentials: "include",
          cache: "no-store",
        });
        const payload: unknown = await response.json();
        const accessToken =
          typeof payload === "object" &&
          payload !== null &&
          "accessToken" in payload &&
          typeof payload.accessToken === "string"
            ? payload.accessToken
            : null;
        if (!accessToken || !isActive) return;

        const expiration = getTokenExpiration(accessToken);
        if (!expiration) return;

        const remaining = expiration - Date.now();
        if (remaining <= REFRESH_EARLY_MS) {
          await refreshSession();
          return;
        }

        timer = window.setTimeout(
          remaining - REFRESH_EARLY_MS > MAX_TIMER_DELAY
            ? scheduleExpirationCheck
            : () => void refreshSession(),
          Math.min(remaining - REFRESH_EARLY_MS, MAX_TIMER_DELAY),
        );
      } catch {
        // Network loss is handled separately by DashboardNetworkGuard.
      }
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
    void scheduleExpirationCheck();

    return () => {
      isActive = false;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
    };
  }, []);

  return children;
}

export { SESSION_EXPIRED_EVENT };
