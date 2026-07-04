const BASE = process.env.NEXT_PUBLIC_API_URL
const INTERNAL_API_PREFIX = '/api/backend'

async function getServerAccessToken() {
  if (typeof window !== 'undefined') return null

  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    return cookieStore.get('accessToken')?.value ?? null
  } catch {
    return null
  }
}

function getRequestUrl(path: string) {
  if (typeof window !== 'undefined') {
    return `${INTERNAL_API_PREFIX}${path}`
  }

  return `${BASE}${path}`
}

async function request(path: string, options?: RequestInit) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...options?.headers,
  })

  const token = await getServerAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(getRequestUrl(path), {
    ...options,
    credentials: 'include',
    headers,
  })
  return res
}

export const apiClient = Object.assign(request, {
  post(path: string, body: unknown, options?: RequestInit) {
    return request(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
})
