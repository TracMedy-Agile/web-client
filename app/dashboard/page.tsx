import { cookies } from 'next/headers'
import Image from 'next/image'

async function getUser() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('accessToken')?.value

  if (!accessToken) return null

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json?.data ?? null
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const user = await getUser()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className=" flex items-center justify-center mx-auto mb-6">
          <Image src="/favicon.svg" alt="Tracmedy Logo" width={40} height={40} />
        </div>
        {user && (
          <p className="text-primary font-semibold mb-2">
            Welcome, {user.name ?? user.email}
          </p>
        )}
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Dashboard
        </h1>
        <p className="text-gray-500 text-lg">
          Coming Soon — We&apos;re building something great.
        </p>
      </div>
    </div>
  )
}