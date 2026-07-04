import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('accessToken')?.value
  return Response.json({ accessToken: accessToken ?? null })
}
