import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const { accessToken, refreshToken, expiresIn } = await request.json() as {
    accessToken: string
    refreshToken: string
    expiresIn: number
  }

  const cookieStore = await cookies()
  const isProd = process.env.NODE_ENV === 'production'

  cookieStore.set('accessToken', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: expiresIn,
  })

  cookieStore.set('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  return Response.json({ ok: true })
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('accessToken')
  cookieStore.delete('refreshToken')
  return Response.json({ ok: true })
}
