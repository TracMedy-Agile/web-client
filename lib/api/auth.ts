import type { LoginResponse } from '@/lib/types/auth'
import { apiClient } from '@/lib/services/auth/api-client'

export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
  AUTH_ACCOUNT_LOCKED: 'Your account has been locked. Please try again later or contact support.',
  AUTH_OTP_EXPIRED: 'Your verification code has expired. Please request a new one.',
  AUTH_OTP_INVALID: 'Invalid verification code. Please check your email and try again.',
  AUTH_TOKEN_EXPIRED: 'This reset link has expired. Please request a new one.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  DUPLICATE_ENTRY: 'An account with this email already exists.',
}

export function getAuthErrorMessage(code: string, fallback?: string): string {
  return AUTH_ERROR_MESSAGES[code] ?? fallback ?? 'Something went wrong. Please try again.'
}

interface ApiSuccess<T> { ok: true; data: T }
interface ApiError { ok: false; code: string; message: string; statusCode: number }
export type ApiResult<T = unknown> = ApiSuccess<T> | ApiError

async function readJson(response: Response) {
  const text = await response.text()
  return text ? JSON.parse(text) : {}
}

async function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await apiClient(path, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const json = await readJson(res)

    if (res.ok) {
      return { ok: true, data: (json?.data ?? json) as T }
    }

    const code: string = json?.message ?? 'UNKNOWN_ERROR'
    return {
      ok: false,
      code,
      message: getAuthErrorMessage(code, json?.message ?? 'Something went wrong.'),
      statusCode: json?.statusCode ?? res.status,
    }
  } catch {
    return {
      ok: false,
      code: 'NETWORK_ERROR',
      message: 'Network error. Please check your connection.',
      statusCode: 0,
    }
  }
}

export const apiRegister = (data: { name: string; email: string; hospitalId: string; password: string }) =>
  post<{ userId: string }>('/auth/hospital/register', data)

export const apiLogin = (data: { email: string; password: string }) =>
  post<LoginResponse>('/auth/hospital/login', data)

export const apiVerifyOtp = (data: { userId: string; otp: string }) =>
  post('/auth/verify-otp', data)

export const apiResendOtp = (data: { userId: string }) =>
  post('/auth/resend-otp', data)

export const apiForgotPassword = (data: { email: string }) =>
  post('/auth/forgot-password', data)

export const apiResetPassword = (data: { token: string; newPassword: string }) =>
  post('/auth/reset-password', data)

export async function storeTokens(tokens: { accessToken: string; refreshToken: string; expiresIn: number }) {
  try {
    const res = await fetch('/api/auth/set-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens),
    })

    if (!res.ok) {
      console.error('Failed to store tokens:', await res.text())
    }
  } catch (err) {
    console.error('storeTokens error:', err)
  }
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
}

export const apiSubmitWaitlist = (data: { fullName: string; email: string; phone: string }) =>
  post<{ message: string }>('/waitlist/submit', data)

