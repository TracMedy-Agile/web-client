const BASE = process.env.NEXT_PUBLIC_API_URL

async function getAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      return cookieStore.get('accessToken')?.value ?? null
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

async function request(path: string, options?: RequestInit) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...options?.headers,
  })

  const token = await getAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
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
