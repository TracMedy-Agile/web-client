import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function getRoleFromAccessToken(accessToken: string) {
  try {
    const encodedPayload = accessToken.split('.')[1]
    if (!encodedPayload) return null
    const normalized = encodedPayload.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload: unknown = JSON.parse(atob(padded))
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'role' in payload &&
      typeof payload.role === 'string'
    ) {
      return payload.role
    }
  } catch {
    return null
  }
  return null
}

// This dashboard is staff-only. Patients use the mobile app exclusively, and tracmedy_admin
// has its own separate dashboard outside this app — neither role belongs here.
const STAFF_ROLES = ['clinician', 'hospital_admin']

function getAllowedRoles(pathname: string): readonly string[] {
  if (
    pathname.startsWith('/dashboard/audit-logs') ||
    pathname.startsWith('/dashboard/team')
  ) {
    return ['hospital_admin']
  }

  if (
    pathname.startsWith('/dashboard/messages') ||
    /^\/dashboard\/care-episodes\/[^/]+\/(?:insights|assessment|assessment-history|care-plan)(?:\/|$)/.test(pathname) ||
    /^\/dashboard\/care-episodes\/[^/]+\/recovery\/(?:adjust-plan|send-instruction)(?:\/|$)/.test(pathname)
  ) {
    return ['clinician']
  }

  return STAFF_ROLES
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const accessToken = request.cookies.get('accessToken')?.value
  const refreshToken = request.cookies.get('refreshToken')?.value
  if (pathname.startsWith('/dashboard') && !accessToken) {
    if (refreshToken) {
      const refreshUrl = new URL('/api/auth/refresh', request.url)
      refreshUrl.searchParams.set('redirect', `${pathname}${request.nextUrl.search}`)
      return NextResponse.redirect(refreshUrl)
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname.startsWith('/dashboard') && accessToken) {
    const allowedRoles = getAllowedRoles(pathname)
    const role = getRoleFromAccessToken(accessToken)
    if (role && !allowedRoles.includes(role)) {
      return NextResponse.rewrite(new URL('/dashboard/access-denied', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
