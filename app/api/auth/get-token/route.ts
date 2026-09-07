import { getAccessToken } from '@/lib/services/auth/cookie-storage.server'

export async function GET() {
  const accessToken = await getAccessToken()
  return Response.json({ accessToken: accessToken ?? null })
}