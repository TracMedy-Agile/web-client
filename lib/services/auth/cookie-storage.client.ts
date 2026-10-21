import { clearSessionCaches } from './browser-token'

export async function deleteTokens() {
  clearSessionCaches()
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }
}