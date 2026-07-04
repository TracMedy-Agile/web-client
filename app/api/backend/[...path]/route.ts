import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

const BASE = process.env.NEXT_PUBLIC_API_URL

type BackendRouteContext = {
  params: Promise<{ path: string[] }>
}

function buildTargetUrl(path: string[], request: NextRequest) {
  if (!BASE) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured')
  }

  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE
  const targetPath = path.map(encodeURIComponent).join('/')
  return `${base}/${targetPath}${request.nextUrl.search}`
}

function buildForwardHeaders(request: NextRequest, accessToken?: string) {
  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  const accept = request.headers.get('accept')

  if (contentType) headers.set('Content-Type', contentType)
  if (accept) headers.set('Accept', accept)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  return headers
}

async function proxyRequest(request: NextRequest, context: BackendRouteContext) {
  const { path } = await context.params
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('accessToken')?.value
  const method = request.method.toUpperCase()
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text()

  const response = await fetch(buildTargetUrl(path, request), {
    method,
    headers: buildForwardHeaders(request, accessToken),
    body,
    cache: 'no-store',
  })

  const responseHeaders = new Headers()
  const contentType = response.headers.get('content-type')
  if (contentType) responseHeaders.set('Content-Type', contentType)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export async function GET(request: NextRequest, context: BackendRouteContext) {
  return proxyRequest(request, context)
}

export async function POST(request: NextRequest, context: BackendRouteContext) {
  return proxyRequest(request, context)
}

export async function PUT(request: NextRequest, context: BackendRouteContext) {
  return proxyRequest(request, context)
}

export async function PATCH(request: NextRequest, context: BackendRouteContext) {
  return proxyRequest(request, context)
}

export async function DELETE(request: NextRequest, context: BackendRouteContext) {
  return proxyRequest(request, context)
}
