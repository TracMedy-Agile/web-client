import { storeTokens, type AuthTokens } from '@/lib/services/auth/cookie-storage.server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL;
const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;

type JsonRecord = Record<string, unknown>;
type HeadersWithSetCookie = Headers & { getSetCookie?: () => string[] };

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function payloadData(payload: unknown) {
  const root = asRecord(payload);
  return asRecord(root?.data) ?? root;
}

function splitSetCookieHeader(header: string) {
  return header.split(/,(?=\s*[^;,\s]+=)/).map((value) => value.trim()).filter(Boolean);
}

function getSetCookieHeaders(headers: Headers) {
  const withSetCookie = headers as HeadersWithSetCookie;
  if (typeof withSetCookie.getSetCookie === 'function') {
    return withSetCookie.getSetCookie();
  }

  const combinedHeader = headers.get('set-cookie');
  return combinedHeader ? splitSetCookieHeader(combinedHeader) : [];
}

function cookieValue(headers: Headers, cookieName: string) {
  for (const header of getSetCookieHeaders(headers)) {
    const pair = header.split(';')[0] ?? '';
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex <= 0) continue;

    const name = pair.slice(0, separatorIndex).trim();
    if (name !== cookieName) continue;

    return pair.slice(separatorIndex + 1).trim();
  }
  return '';
}

function tokenFromPayload(payload: unknown, key: 'accessToken' | 'refreshToken') {
  const data = payloadData(payload);
  return stringValue(data?.[key]);
}

function parseTokens(response: Response, payload: unknown): AuthTokens | null {
  const accessToken = cookieValue(response.headers, 'accessToken') || tokenFromPayload(payload, 'accessToken');
  const refreshToken = cookieValue(response.headers, 'refreshToken') || tokenFromPayload(payload, 'refreshToken');
  const expiresIn = numberValue(payloadData(payload)?.expiresIn) ?? ACCESS_TOKEN_MAX_AGE_SECONDS;

  if (!accessToken || !refreshToken) return null;

  return {
    accessToken,
    refreshToken,
    expiresIn,
  };
}

function responseUser(payload: unknown) {
  const data = payloadData(payload);
  return asRecord(data?.user) ?? null;
}

function backendMessage(payload: unknown, status: number) {
  const root = asRecord(payload);
  const data = payloadData(payload);
  const message = stringValue(root?.message) || stringValue(data?.message) || stringValue(root?.error);
  if (message) return message;
  if (status === 401) return 'Invalid email or password';
  if (status === 423) return 'Your account has been locked. Please try again later or contact support.';
  if (status === 429) return 'Too many login attempts. Please try again later.';
  return 'Unable to sign in. Please try again.';
}

async function readJson(response: Response) {
  return await response.json().catch(() => null) as unknown;
}

export async function POST(request: Request) {
  if (!API_BASE) {
    return Response.json({ ok: false, message: 'Authentication service is not configured.' }, { status: 500 });
  }

  const body: unknown = await request.json().catch(() => null);
  const credentials = asRecord(body);
  const email = stringValue(credentials?.email);
  const password = stringValue(credentials?.password);

  if (!email || !password) {
    return Response.json({ ok: false, message: 'Email and password are required.' }, { status: 400 });
  }

  try {
    const response = await fetch(`${API_BASE}/auth/hospital/login`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({ email, password }),
    });

    const payload = await readJson(response);

    if (!response.ok) {
      return Response.json(
        { ok: false, message: backendMessage(payload, response.status) },
        { status: response.status },
      );
    }

    const tokens = parseTokens(response, payload);
    if (!tokens) {
      return Response.json(
        { ok: false, message: 'Login succeeded but session cookies were not returned by the API.' },
        { status: 502 },
      );
    }

    await storeTokens(tokens);

    return Response.json({
      ok: true,
      user: responseUser(payload),
      expiresIn: tokens.expiresIn,
    });
  } catch {
    return Response.json({ ok: false, message: 'Network error. Please check your connection.' }, { status: 503 });
  }
}