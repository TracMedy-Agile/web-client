import { deleteTokens, getRefreshToken } from '@/lib/services/auth/cookie-storage.server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export async function POST() {
  const refreshToken = await getRefreshToken();
  let serverInvalidated = false;
  try {
    if (refreshToken !== undefined && API_BASE !== undefined) {
      const response = await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ refreshToken }),
      });
      serverInvalidated = response.ok;
    }
  } catch {
    serverInvalidated = false;
  } finally {
    await deleteTokens();
  }
  return Response.json({ ok: true, serverInvalidated });
}
