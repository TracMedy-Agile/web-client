// Browser-side cache of the access token held in the httpOnly cookie (read via /api/auth/get-token).
// Without it every API call costs an extra round trip to Next.js just to read the same token.
// The token itself stays in memory only — never localStorage.

import { clearSharedRequests } from "@/lib/api/request-cache";

const MAX_CACHE_MS = 5 * 60_000;
const FALLBACK_CACHE_MS = 30_000;
// Stop reusing a token this long before it expires so requests never go out with a stale one.
const EXPIRY_SKEW_MS = 30_000;

let cached: { token: string; expiresAt: number } | null = null;
let inflight: Promise<string | null> | null = null;

function jwtExpiryMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const json = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function cacheUntil(token: string): number {
  const now = Date.now();
  const expiry = jwtExpiryMs(token);
  if (expiry === null) return now + FALLBACK_CACHE_MS;
  return Math.min(now + MAX_CACHE_MS, expiry - EXPIRY_SKEW_MS);
}

export async function getBrowserAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  // Concurrent callers share one in-flight lookup.
  if (inflight) return inflight;

  inflight = fetch("/api/auth/get-token", { cache: "no-store" })
    .then((response) => response.json() as Promise<{ accessToken?: unknown }>)
    .then((payload) => {
      const token = typeof payload.accessToken === "string" && payload.accessToken ? payload.accessToken : null;
      const expiresAt = token ? cacheUntil(token) : 0;
      // Signed-out (null) and near-expiry tokens are never cached.
      cached = token && expiresAt > Date.now() ? { token, expiresAt } : null;
      return token;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Forget the cached token (after a 401 or a token refresh — the user is unchanged). */
export function clearBrowserAccessToken() {
  cached = null;
}

/** Forget everything tied to the signed-in user (sign-in, sign-out, session expiry). */
export function clearSessionCaches() {
  clearBrowserAccessToken();
  clearSharedRequests();
}

if (typeof window !== "undefined") {
  window.addEventListener("tracmedy:session-expired", clearSessionCaches);
}
