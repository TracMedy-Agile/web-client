import type { components } from '@/docs/types/api'
import type { SafeUser } from '@/lib/types/auth'
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
type AcceptInviteResult = components['schemas']['AcceptInviteResultDto']

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
  post<{ userId: string; registrationToken: string }>('/auth/hospital/register', data)

export type HospitalLoginSession = {
  user: SafeUser | null
  expiresIn: number
}

export async function apiHospitalLogin(data: { email: string; password: string }): Promise<ApiResult<HospitalLoginSession>> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    const json = await readJson(res)

    if (res.ok && json?.ok === true) {
      return {
        ok: true,
        data: {
          user: (json.user ?? null) as SafeUser | null,
          expiresIn: typeof json.expiresIn === 'number' ? json.expiresIn : 15 * 60,
        },
      }
    }

    const message = typeof json?.message === 'string' && json.message.trim()
      ? json.message
      : res.status === 401
        ? 'Invalid email or password'
        : 'Something went wrong. Please try again.'

    return {
      ok: false,
      code: typeof json?.code === 'string' ? json.code : `HTTP_${res.status}`,
      message,
      statusCode: typeof json?.statusCode === 'number' ? json.statusCode : res.status,
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


export const apiVerifyOtp = (data: { registrationToken: string; otp: string }) =>
  post('/auth/verify-otp', data)

export const apiResendOtp = (data: { registrationToken: string }) =>
  post('/auth/resend-otp', data)

export const apiForgotPassword = (data: { email: string }) =>
  post('/auth/forgot-password', data)

export const apiResetPassword = (data: { token: string; newPassword: string }) =>
  post('/auth/reset-password', data)


export async function apiAcceptTeamInvite(data: components['schemas']['AcceptInviteDto']): Promise<ApiResult<AcceptInviteResult>> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/team/members/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await readJson(res)

    if (res.ok) {
      return { ok: true, data: (json?.data ?? json) as AcceptInviteResult }
    }

    const code: string = json?.message ?? 'UNKNOWN_ERROR'
    return {
      ok: false,
      code,
      message: json?.message ?? 'Unable to accept this invite. Please request a new invitation.',
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

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
}

export const apiSubmitWaitlist = (data: { fullName: string; email: string; phone: string }) =>
  post<{ message: string }>('/waitlist/submit', data)

