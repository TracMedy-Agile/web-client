import { getAccessToken } from '@/lib/services/auth/cookie-storage.server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get('facilityId')
    const date = searchParams.get('date')

    if (!facilityId || !date) {
      return NextResponse.json({ message: 'Missing facilityId or date' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL
    if (!baseUrl) {
      return NextResponse.json({ message: 'API URL is not configured' }, { status: 500 })
    }

    const token = await getAccessToken()
    const backendUrl = new URL('/appointments/calendar', baseUrl)
    backendUrl.searchParams.set('facilityId', facilityId)
    backendUrl.searchParams.set('date', date)

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      cache: 'no-store',
    })

    const data = await response.json().catch(() => null)
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
