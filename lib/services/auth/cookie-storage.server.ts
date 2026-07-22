import { cookies } from 'next/headers'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

const ACCESS_TOKEN_COOKIE = 'accessToken'
const REFRESH_TOKEN_COOKIE = 'refreshToken'
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7

function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}

export async function storeTokens({ accessToken, refreshToken, expiresIn }: AuthTokens) {
  const cookieStore = await cookies()

  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, getCookieOptions(expiresIn))
  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, getCookieOptions(REFRESH_TOKEN_MAX_AGE))
}

export async function getAccessToken() {
  const cookieStore = await cookies()
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value
}

export async function getRefreshToken() {
  const cookieStore = await cookies()
  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value
}

export async function deleteTokens() {
  const cookieStore = await cookies()
  cookieStore.delete(ACCESS_TOKEN_COOKIE)
  cookieStore.delete(REFRESH_TOKEN_COOKIE)
}
