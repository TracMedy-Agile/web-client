// Short-lived, opt-in request sharing: callers asking for the same key within `ttlMs`
// get the same in-flight/settled promise instead of firing duplicate requests.
// Failed requests are evicted immediately so the next caller retries.

const entries = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

export function sharedRequest<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && hit.expiresAt > now) return hit.promise as Promise<T>;

  const promise = load();
  entries.set(key, { expiresAt: now + ttlMs, promise });
  promise.catch(() => {
    if (entries.get(key)?.promise === promise) entries.delete(key);
  });
  return promise;
}

/** Drop shared entries (all, or those whose key starts with `prefix`), e.g. after a mutation. */
export function clearSharedRequests(prefix = "") {
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}
