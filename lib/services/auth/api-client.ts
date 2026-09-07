const BASE = process.env.NEXT_PUBLIC_API_URL
let refreshPromise: Promise<boolean> | null = null

async function getAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      return cookieStore.get('__Host-accessToken')?.value ?? null
    } catch {
      return null
    }
  }

  try {
    const res = await fetch('/api/auth/get-token')
    const { accessToken } = await res.json()
    return typeof accessToken === 'string' ? accessToken : null
  } catch {
    return null
  }
}

async function refreshAccessToken() {
  if (refreshPromise === null) {
    refreshPromise = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

async function request(path: string, options?: RequestInit, allowRefresh = true) {
  const headers = new Headers(options?.headers)
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData

  if (!headers.has('Content-Type') && !isFormData) {
    headers.set('Content-Type', 'application/json')
  }

  const token = await getAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
    if (allowRefresh && await refreshAccessToken()) {
      return request(path, options, false)
    }
    window.dispatchEvent(new Event('tracmedy:session-expired'))
  }

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
