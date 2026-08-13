'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { apiAcceptTeamInvite } from '@/lib/api/auth'

function AcceptInviteContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setApiError('')
    setSuccessMessage('')

    if (!token) {
      setApiError('This invite link is missing its token. Please use the link from your email.')
      return
    }

    if (password.length < 8) {
      setApiError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setApiError('Passwords do not match.')
      return
    }

    setIsLoading(true)
    try {
      const result = await apiAcceptTeamInvite({ token, name: name.trim(), password })
      if (!result.ok) {
        setApiError(result.message)
        return
      }
      setSuccessMessage(result.data.message || 'Invite accepted. You can now sign in.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        <div className="flex items-center gap-2 p-4 sm:p-8">
          <div className="w-9 h-9 flex items-center justify-center">
            <Image src="/tracmedy_logo.svg" alt="Tracmedy Logo" width={40} height={40} />
          </div>
          <span className="text-lg font-bold md:text-xl text-primary tracking-[0.2em]">TRACMEDY</span>
        </div>

        <div className="flex-1 flex items-start justify-center px-4 sm:px-8 pb-4">
          <div className="w-full max-w-md">
            <h1 className="text-lg font-bold md:text-3xl text-gray-900 text-center mb-2">Accept Team Invite</h1>
            <p className="text-gray-400 text-sm text-center mb-10">
              Set your password to activate your hospital workspace account.
            </p>

            {apiError ? (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
                <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-red-600 text-xs leading-relaxed">{apiError}</p>
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-6 text-center">
                <p className="text-sm font-bold text-emerald-700">{successMessage}</p>
                <Link href="/login" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary/90">
                  Go to login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="invite-name" className="block text-sm font-bold text-gray-800 mb-2">Full Name</label>
                  <input
                    id="invite-name"
                    type="text"
                    placeholder="Dr Hannah"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-600 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="invite-password" className="block text-sm font-bold text-gray-800 mb-2">Password</label>
                  <input
                    id="invite-password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-600 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="invite-confirm-password" className="block text-sm font-bold text-gray-800 mb-2">Confirm Password</label>
                  <input
                    id="invite-confirm-password"
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-600 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !token}
                  className="w-full bg-primary text-white py-3.5 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Accepting invite...' : 'Accept invite'}
                </button>

                <p className="text-center text-sm text-gray-500">
                  Already activated?{' '}
                  <Link href="/login" className="font-bold text-primary hover:underline">Sign in</Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/5 to-secondary/20 items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-sm">
            <Image src="/tracmedy_logo.svg" alt="Tracmedy Logo" width={56} height={56} />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Welcome to the care team</h2>
          <p className="mt-4 text-sm leading-6 text-gray-500">
            Your hospital invited you to collaborate on connected patient care, appointments, alerts, and care episodes.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-white"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>}>
      <AcceptInviteContent />
    </Suspense>
  )
}