'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiForgotPassword } from '@/lib/api/auth'
import Image from 'next/image'

function TracmedyLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className=" flex items-center justify-center">
       <Image src="/tracmedy_logo.svg" alt="Tracmedy Logo" width={40} height={40}  />
      </div>
      <span className="text-xl font-bold text-primary tracking-[0.2em]">TRACMEDY</span>
    </div>
  )
}

function validateEmail(value: string): string {
  if (!value.trim()) return 'Email address is required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Please enter a valid email address.'
  return ''
}

export default function ForgotPasswordPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [apiError, setApiError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleBlur = () => {
    setFieldError(validateEmail(email))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validateEmail(email)
    if (err) { setFieldError(err); return }
    setFieldError('')
    setApiError('')
    setIsLoading(true)
    try {
      const result = await apiForgotPassword({ email: email.trim() })
      if (!result.ok) {
        setApiError(result.message)
        return
      }
      router.push(`/hospital/email-sent?email=${encodeURIComponent(email.trim())}`)
    } catch {
      setApiError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const hasFieldError = !!fieldError
  const inputBorderClass = hasFieldError
    ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
    : 'border-gray-200 focus:border-primary focus:ring-primary/20'

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — form ── */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        <div className="p-8">
          <TracmedyLogo />
        </div>

        <div className="flex-1 flex items-center justify-center px-8 pb-16">
          <div className="w-full max-w-md">
           

            <h2 className="text-3xl font-bold text-gray-900 mb-3 text-center">Forgot Password?</h2>
            <p className="text-gray-400 text-sm mb-10 leading-relaxed text-center">
              Don&apos;t worry, it happens. Enter your registered email address and we&apos;ll send you a secure link to reset your password.
            </p>

            {/* API error banner */}
            {apiError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
                <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-red-600 text-xs leading-relaxed">{apiError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Email field */}
              <div>
                <label htmlFor="email" className="block text-center md:text-left text-sm font-bold text-gray-800 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </span>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="staff@tracmedy.org"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (fieldError) setFieldError(validateEmail(e.target.value))
                    }}
                    onBlur={handleBlur}
                    aria-invalid={hasFieldError}
                    aria-describedby={hasFieldError ? 'email-error' : undefined}
                    className={`w-full pl-11 pr-4 py-3.5 border-2 rounded-xl text-gray-600 placeholder:text-gray-300 focus:outline-none focus:ring-2 transition-colors ${inputBorderClass}`}
                  />
                </div>
                {hasFieldError && (
                  <p id="email-error" className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                    <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {fieldError}
                  </p>
                )}
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-white py-4 rounded-xl font-semibold text-base hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                    Sending…
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>

            <p className="text-center mt-6 text-sm ">
             
              <Link href="/hospital/login" className=" font-bold hover:underline">
                Back To Log in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* ── Right panel — illustration ── */}
<div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center relative overflow-hidden">
  <Image 
    src="/forgot_password.png" 
    alt="Forgot Password" 
    fill
    className="object-cover"
  />
</div>
    </div>
  )
}
