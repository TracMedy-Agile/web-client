'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function RedirectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  useEffect(() => {
    router.replace(`/hospital/reset-password?token=${token}`)
  }, [token, router])

  return null
}

export default function ResetPasswordRedirect() {
  return (
    <Suspense>
      <RedirectContent />
    </Suspense>
  )
}