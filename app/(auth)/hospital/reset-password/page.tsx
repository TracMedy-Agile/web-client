'use client'

import { Suspense, useState, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiResetPassword } from '@/lib/api/auth'
import Image from 'next/image'

// ── Types ────────────────────────────────────────────────────────────────────

type ApiError = 'AUTH_TOKEN_EXPIRED' | 'GENERIC'

// ── Helpers ──────────────────────────────────────────────────────────────────

function TracmedyLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center">
       <Image 
               src="/tracmedy_logo.svg" 
               alt="Tracmedy Logo" 
               width={40}
               height={40}
               className="object-contain"
             />
      </div>
      <span className="text-xl font-bold text-primary tracking-[0.2em]">TRACMEDY</span>
    </div>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// ── Password strength ─────────────────────────────────────────────────────────

type StrengthLevel = 0 | 1 | 2 | 3 | 4

const STRENGTH_CONFIG: Record<
  StrengthLevel,
  { label: string; color: string; bars: number }
> = {
  0: { label: '',        color: 'bg-gray-200',   bars: 0 },
  1: { label: 'Weak',    color: 'bg-red-500',    bars: 1 },
  2: { label: 'Fair',    color: 'bg-orange-400', bars: 2 },
  3: { label: 'Good',    color: 'bg-yellow-400', bars: 3 },
  4: { label: 'Strong',  color: 'bg-green-500',  bars: 4 },
}

const CRITERIA: Array<{ label: string; test: (p: string) => boolean }> = [
  { label: 'At least 8 characters',       test: (p) => p.length >= 8 },
  { label: 'Uppercase letter (A–Z)',       test: (p) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter (a–z)',       test: (p) => /[a-z]/.test(p) },
  { label: 'Number (0–9)',                 test: (p) => /\d/.test(p) },
  { label: 'Special character (!@#…)',     test: (p) => /[^A-Za-z0-9]/.test(p) },
]

function usePasswordStrength(password: string) {
  return useMemo<StrengthLevel>(() => {
    if (!password) return 0
    const met = CRITERIA.filter((c) => c.test(password)).length
    if (met <= 1) return 1
    if (met === 2) return 2
    if (met <= 4) return 3
    return 4
  }, [password])
}


// ── Expired token state ───────────────────────────────────────────────────────

function TokenExpiredState() {
  return (
    <div className="w-full max-w-md text-center">
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
      </div>
      <h2 className="text-3xl font-bold text-gray-900 mb-3">Link Expired</h2>
      <p className="text-gray-400 text-sm leading-relaxed mb-8">
        This password reset link has expired. Reset links are only valid for{' '}
        <span className="font-semibold text-gray-600">24 hours</span>. Please
        request a new one to continue.
      </p>
      <Link
        href="/hospital/forgot-password"
        className="w-full bg-primary text-white py-4 rounded-xl font-semibold text-base hover:opacity-90 transition-opacity flex items-center justify-center"
      >
        Request New Reset Link
      </Link>
      <div className="mt-5">
        <Link href="/hospital/login" className="text-sm font-bold text-gray-700 hover:text-primary transition-colors">
          Back To Login
        </Link>
      </div>
    </div>
  )
}

// ── Main content (needs Suspense for useSearchParams) ─────────────────────────

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew]                 = useState(false)
  const [showConfirm, setShowConfirm]         = useState(false)
  const [errors, setErrors]                   = useState<{ new?: string; confirm?: string }>({})
  const [apiError, setApiError]               = useState<ApiError | null>(null)
  const [isLoading, setIsLoading]             = useState(false)

  const strength = usePasswordStrength(newPassword)
  const strengthCfg = STRENGTH_CONFIG[strength]

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    const next: typeof errors = {}
    if (!newPassword) {
      next.new = 'New password is required.'
    } else if (newPassword.length < 8) {
      next.new = 'Password must be at least 8 characters.'
    }
    if (!confirmPassword) {
      next.confirm = 'Please confirm your password.'
    } else if (confirmPassword !== newPassword) {
      next.confirm = 'Passwords do not match.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setApiError(null)
    setIsLoading(true)
    try {
      const result = await apiResetPassword({ token, newPassword })
      if (!result.ok) {
        if (result.code === 'AUTH_TOKEN_EXPIRED') {
          setApiError('AUTH_TOKEN_EXPIRED')
          return
        }
        setApiError('GENERIC')
        return
      }
      router.push('/hospital/login?message=password-reset-success')
    } catch {
      setApiError('GENERIC')
    } finally {
      setIsLoading(false)
    }
  }

  // Expired token — render dedicated state
  if (apiError === 'AUTH_TOKEN_EXPIRED') {
    return (
      <div className="min-h-screen flex">
        <div className="w-full lg:w-1/2 flex flex-col bg-white">
          <div className="p-8"><TracmedyLogo /></div>
          <div className="flex-1 flex items-center justify-center px-8 pb-16">
            <TokenExpiredState />
          </div>
        </div>
        <LeftPanel />
      </div>
    )
  }

  // ── Field helpers ────────────────────────────────────────────────────────────
  const fieldClass = (hasError: boolean) =>
    [
      'w-full pl-11 pr-12 py-3.5 border-2 rounded-xl text-gray-600 placeholder:text-gray-300',
      'focus:outline-none focus:ring-2 transition-colors',
      hasError
        ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
        : 'border-gray-200 focus:border-primary focus:ring-primary/20',
    ].join(' ')

  return (
    <div className="min-h-screen flex">
    

      <LeftPanel />
        {/* ── Left panel — form ── */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        <div className="p-8"><TracmedyLogo /></div>

        <div className="flex-1 flex items-center justify-center px-8 pb-16">
          <div className="w-full max-w-md">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Reset Password</h2>
            <p className="text-gray-400 text-sm mb-10 leading-relaxed">
              Create a strong new password for your Tracmedy account.
            </p>

            {/* Generic API error */}
            {apiError === 'GENERIC' && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
                <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-red-600 text-xs leading-relaxed">
                  Something went wrong. Please try again or{' '}
                  <Link href="/forgot-password" className="underline font-semibold">request a new link</Link>.
                </p>
              </div>
            )}

            {/* Missing / invalid token warning */}
            {!token && (
              <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-6">
                <svg className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <p className="text-yellow-700 text-xs leading-relaxed">
                  No reset token found. Please use the link from your email or{' '}
                  <Link href="/forgot-password" className="underline font-semibold">request a new one</Link>.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* New password */}
              <div>
                <label htmlFor="new-password" className="block text-sm font-bold text-gray-800 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••••••"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
                      if (errors.new) setErrors((p) => ({ ...p, new: undefined }))
                    }}
                    aria-invalid={!!errors.new}
                    aria-describedby={errors.new ? 'new-pw-error' : undefined}
                    className={fieldClass(!!errors.new)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon open={showNew} />
                  </button>
                </div>

                {/* Strength bar — only when typing */}
                {newPassword && (
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((bar) => (
                        <div
                          key={bar}
                          className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                            bar <= strengthCfg.bars ? strengthCfg.color : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {CRITERIA.map(({ label, test }) => (
                          <span
                            key={label}
                            className={`text-[10px] flex items-center gap-1 transition-colors ${
                              test(newPassword) ? 'text-green-600' : 'text-gray-400'
                            }`}
                          >
                            <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              {test(newPassword)
                                ? <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                                : <circle cx="12" cy="12" r="9" />}
                            </svg>
                            {label}
                          </span>
                        ))}
                      </div>
                      {strengthCfg.label && (
                        <span className={`text-xs font-semibold shrink-0 ml-2 ${
                          strength === 4 ? 'text-green-600'
                            : strength === 3 ? 'text-yellow-600'
                            : strength === 2 ? 'text-orange-500'
                            : 'text-red-500'
                        }`}>
                          {strengthCfg.label}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {errors.new && (
                  <p id="new-pw-error" className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                    <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {errors.new}
                  </p>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-bold text-gray-800 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </span>
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }))
                    }}
                    aria-invalid={!!errors.confirm}
                    aria-describedby={errors.confirm ? 'confirm-pw-error' : undefined}
                    className={fieldClass(!!errors.confirm)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon open={showConfirm} />
                  </button>
                </div>

                {/* Match indicator */}
                {confirmPassword && !errors.confirm && (
                  <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                    <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Passwords match
                  </p>
                )}
                {errors.confirm && (
                  <p id="confirm-pw-error" className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                    <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {errors.confirm}
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || !token}
                className="w-full bg-primary text-white py-4 rounded-xl font-semibold text-base hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                    Resetting…
                  </>
                ) : (
                  'Reset Password →'
                )}
              </button>
            </form>

            
              <div className="mt-6 text-center">
              <Link href="/hospital/login" className=" font-bold hover:underline ">
                Back To Log in
              </Link>
           </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Left panel (shared between normal + expired states) ──────────────────────

function LeftPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 relative overflow-hidden">
      <Image 
               src="/forgot_password.png" 
               alt="Forgot Password" 
               fill
               className="object-cover"
             />
    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
