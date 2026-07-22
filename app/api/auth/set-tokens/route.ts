import { deleteTokens, storeTokens } from '@/lib/services/auth/cookie-storage.server'

export async function POST(request: Request) {
  const tokens = await request.json() as {
    accessToken: string
    refreshToken: string
    expiresIn: number
  }

  await storeTokens(tokens)

  return Response.json({ ok: true })
}

export async function DELETE() {
  await deleteTokens()
  return Response.json({ ok: true })
}
