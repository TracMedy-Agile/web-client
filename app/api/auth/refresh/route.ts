import { NextResponse } from 'next/server';
import { deleteTokens, getRefreshToken, storeTokens, type AuthTokens } from '@/lib/services/auth/cookie-storage.server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL;
type JsonRecord = Record<string, unknown>;
const asRecord = (value: unknown): JsonRecord | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;

function parseTokens(payload: unknown, currentRefreshToken: string): AuthTokens | null {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  if (!data || typeof data.accessToken !== 'string') return null;
  return {
    accessToken: data.accessToken,
    refreshToken: typeof data.refreshToken === 'string' ? data.refreshToken : currentRefreshToken,
    expiresIn: typeof data.expiresIn === 'number' ? data.expiresIn : 15 * 60,
  };
}
async function refreshSession() {
  const refreshToken = await getRefreshToken();
  if (refreshToken === undefined) throw new Error('Refresh unavailable');
  if (API_BASE === undefined) throw new Error('Refresh unavailable');
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ refreshToken }),
  });
  const payload: unknown = await response.json().catch(() => null);
  const tokens = parseTokens(payload, refreshToken);
  if (response.ok === false) throw new Error('Refresh failed');
  if (tokens === null) throw new Error('Refresh failed');
  await storeTokens(tokens);
}
export async function POST() {
  try {
    await refreshSession();
    return Response.json({ ok: true });
  } catch {
    await deleteTokens();
    return Response.json({ ok: false }, { status: 401 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get('redirect') ?? '/dashboard';
  const destination = requested.startsWith('/dashboard') ? requested : '/dashboard';
  try {
    await refreshSession();
    return NextResponse.redirect(new URL(destination, request.url));
  } catch {
    await deleteTokens();
    return NextResponse.redirect(new URL('/session-expired', request.url));
  }
}
