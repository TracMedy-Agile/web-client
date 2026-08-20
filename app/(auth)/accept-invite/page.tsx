'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { apiAcceptTeamInvite } from '@/lib/api/auth'

type PasswordCheck = {
  label: string
  met: boolean
}

function AcceptInviteContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  // Personalization (hospital/inviter/role/email) is not part of the invite
  // link today — only `token` is. These fall back gracefully if backend
  // later adds them as query params instead of showing fabricated data.
  const hospitalName = searchParams.get('hospitalName') ?? ''
  const inviterName = searchParams.get('inviterName') ?? ''
  const role = searchParams.get('role') ?? ''
  const invitedEmail = searchParams.get('email') ?? ''

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const checks = useMemo<PasswordCheck[]>(() => [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'One uppercase', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
  ], [password])

  const passwordsMatch = password.length > 0 && password === confirmPassword
  const canSubmit = Boolean(token) && name.trim().length >= 2
    && checks.every((check) => check.met) && passwordsMatch && agreedToTerms

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setApiError('')
    setSuccessMessage('')

    if (!token) {
      setApiError('This invite link is missing its token. Please use the link from your email.')
      return
    }

    if (!canSubmit) return

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

  const heading = hospitalName ? `Join ${hospitalName} on Tracmedy` : 'Join Tracmedy'
  const description = inviterName && hospitalName && role
    ? (
      <>
        <span className="font-bold text-primary">{inviterName}</span> has invited you to join{' '}
        <span className="font-bold text-primary">{hospitalName}</span> on Tracmedy as a{' '}
        <span className="font-bold text-primary">{role}</span>. Create your password below to activate your account.
      </>
    )
    : 'You have been invited to join Tracmedy. Create your password below to activate your account.'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 flex items-center justify-center">
            <Image src="/tracmedy_logo.svg" alt="Tracmedy Logo" width={36} height={36} />
          </div>
          <span className="text-lg font-bold text-primary tracking-[0.2em]">TRACMEDY</span>
        </div>

        {successMessage ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-6 text-center">
            <p className="text-sm font-bold text-emerald-700">{successMessage}</p>
            <Link href="/login" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary/90">
              Go to login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{heading}</h1>
            <p className="text-sm leading-relaxed text-gray-600 mb-4">{description}</p>

            {invitedEmail ? (
              <div className="flex items-center gap-2 mb-6 text-xs text-gray-500">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
                Invitation sent to: <span className="font-semibold text-gray-700">{invitedEmail}</span>
              </div>
            ) : null}

            <h2 className="text-center text-base font-bold text-gray-900 mb-5">Activate Your Account</h2>

            {apiError ? (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
                <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-red-600 text-xs leading-relaxed">{apiError}</p>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="invite-name" className="block text-sm font-bold text-gray-800 mb-2">Full name</label>
                <input
                  id="invite-name"
                  type="text"
                  placeholder="Dr Hannah"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>

              {invitedEmail ? (
                <div>
                  <label htmlFor="invite-email" className="block text-sm font-bold text-gray-800 mb-2">Verified email</label>
                  <div className="relative">
                    <input
                      id="invite-email"
                      type="email"
                      value={invitedEmail}
                      readOnly
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 pr-10"
                    />
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.7 7.7-5.5 5.5a1 1 0 0 1-1.4 0l-2.5-2.5a1 1 0 1 1 1.4-1.4l1.8 1.8 4.8-4.8a1 1 0 0 1 1.4 1.4Z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="invite-password" className="block text-sm font-bold text-gray-800 mb-2">Create password</label>
                  <input
                    id="invite-password"
                    type="password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="invite-confirm-password" className="block text-sm font-bold text-gray-800 mb-2">Confirm password</label>
                  <input
                    id="invite-confirm-password"
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  {confirmPassword.length > 0 && !passwordsMatch ? (
                    <p className="mt-1.5 text-xs text-red-500">Passwords do not match.</p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-primary/5 px-4 py-3">
                {checks.map((check) => (
                  <div key={check.label} className="flex items-center gap-2 text-xs">
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${check.met ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 text-transparent'}`}>
                      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className={check.met ? 'text-emerald-700 font-medium' : 'text-gray-500'}>{check.label}</span>
                  </div>
                ))}
              </div>

              <label className="flex items-start gap-2.5 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(event) => setAgreedToTerms(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                />
                <span>
                  I agree to the{' '}
                  <Link href="#" className="font-bold text-primary underline">Terms of Service</Link>{' '}
                  and{' '}
                  <Link href="#" className="font-bold text-primary underline">Privacy Policy</Link>.
                </span>
              </label>

              <button
                type="submit"
                disabled={isLoading || !canSubmit}
                className="w-full bg-primary text-white py-3.5 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Activating...' : 'Activate My Account'}
              </button>

              <p className="text-center text-sm text-gray-500">
                Already activated?{' '}
                <Link href="/login" className="font-bold text-primary hover:underline">Sign in</Link>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-100"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>}>
      <AcceptInviteContent />
    </Suspense>
  )
}
