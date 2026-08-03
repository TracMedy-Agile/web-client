'use client'

import { Suspense, useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiVerifyOtp, apiResendOtp } from '@/lib/api/auth'
import Image from 'next/image'

const OTP_LENGTH = 6
const RESEND_SECONDS = 30

type OtpError = 'AUTH_OTP_EXPIRED' | 'AUTH_OTP_INVALID' | 'AUTH_ACCOUNT_LOCKED' | null

const ERROR_MESSAGES: Record<NonNullable<OtpError>, string> = {
  AUTH_OTP_EXPIRED: 'Your verification code has expired. Please request a new one.',
  AUTH_OTP_INVALID: 'Invalid code. Please check your email and try again.',
  AUTH_ACCOUNT_LOCKED: 'Your account is locked due to too many attempts. Please contact support.',
}

function TracmedyLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 flex items-center justify-center">
       <Image src="/tracmedy_logo.svg" alt="Tracmedy Logo" width={40} height={40}  />
      </div>
      <span className="text-lg font-bold md:text-xl text-primary tracking-[0.2em]">TRACMEDY</span>
    </div>
  )
}

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const email = searchParams.get('email') ?? 'your email'
  const userId = searchParams.get('userId') ?? ''

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState<OtpError>(null)
  const [countdown, setCountdown] = useState(RESEND_SECONDS)
  const [isResending, setIsResending] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  const handleChange = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    setError(null)
    setDigits((prev) => {
      const next = [...prev]
      next[index] = digit
      return next
    })
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [])

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !digits[index] && index > 0) {
        setDigits((prev) => {
          const next = [...prev]
          next[index - 1] = ''
          return next
        })
        inputRefs.current[index - 1]?.focus()
      }
      if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus()
      if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus()
    },
    [digits],
  )

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    setError(null)
    const next = Array(OTP_LENGTH).fill('') as string[]
    pasted.split('').forEach((ch, i) => { next[i] = ch })
    setDigits(next)
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus()
  }, [])

  const handleResend = async () => {
    setIsResending(true)
    setError(null)
    setDigits(Array(OTP_LENGTH).fill(''))
    await apiResendOtp({ userId })
    setCountdown(RESEND_SECONDS)
    setIsResending(false)
    inputRefs.current[0]?.focus()
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const code = digits.join('')
    if (code.length < OTP_LENGTH) return
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await apiVerifyOtp({ userId, otp: code })
      if (!result.ok) {
        const known: OtpError = (
          result.code === 'AUTH_OTP_EXPIRED' ||
          result.code === 'AUTH_OTP_INVALID' ||
          result.code === 'AUTH_ACCOUNT_LOCKED'
        ) ? result.code as OtpError : 'AUTH_OTP_INVALID'
        setError(known)
        return
      }
      router.push('/login')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatted = `${String(Math.floor(countdown / 60)).padStart(2, '0')}:${String(countdown % 60).padStart(2, '0')}`
  const isFull = digits.join('').length === OTP_LENGTH
  const isExpired = error === 'AUTH_OTP_EXPIRED'
  const canResend = countdown <= 0 || isExpired

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — form ── */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        <div className="p-8">
          <TracmedyLogo />
        </div>

        <div className="flex-1 flex items-center justify-center px-4 sm:px-8 pb-16">
          <div className="w-full max-w-md">
            <h2 className="text-lg font-bold md:text-3xl text-gray-900 text-center mb-3">
              Verify Your Identity
            </h2>
            <p className="text-gray-400 text-sm text-center mb-1">
              Enter the 6-digit code sent to your email
            </p>
            <p className="text-primary text-sm font-semibold text-center mb-10 truncate px-4">
              {email}
            </p>

            <form onSubmit={handleSubmit} noValidate>
              {/* OTP boxes */}
              <div className="flex gap-3 justify-center mb-5">
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={2}
                    value={digit}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    onFocus={(e) => e.target.select()}
                    aria-label={`OTP digit ${i + 1}`}
                    className={[
                      'w-[52px] h-[60px] text-center text-2xl font-bold border-2 rounded-xl outline-none transition-all duration-150 focus:scale-105',
                      error
                        ? 'border-red-400 text-red-500 bg-red-50'
                        : digit
                          ? 'border-gray-200 text-gray-800 bg-white'
                          : 'border-gray-200 text-gray-800 bg-white focus:border-primary',
                    ].join(' ')}
                  />
                ))}
              </div>

              {/* Error banner */}
              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-red-600 text-xs leading-relaxed">{ERROR_MESSAGES[error]}</p>
                </div>
              )}

              {/* Resend row */}
              <div className="flex items-center justify-center gap-1 text-sm text-gray-400 mb-8">
                <span>Didn&apos;t receive the code?</span>
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    className="ml-1 text-primary font-bold hover:underline disabled:opacity-50 transition-opacity"
                  >
                    {isResending ? 'Sending…' : 'Resend'}
                  </button>
                ) : (
                  <span className="ml-1">
                    Resend in{' '}
                    <span className="font-bold text-primary">{formatted}</span>
                  </span>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!isFull || isSubmitting}
                className="w-full bg-primary text-white py-4 rounded-xl font-semibold text-base hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Verifying…' : 'Verify Code'}
              </button>
            </form>

            <div className="text-center mt-6">
              <Link
                href="/login"
                className="text-sm font-bold text-gray-800 hover:text-primary transition-colors"
              >
                Back To Login
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel — security illustration ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center relative overflow-hidden">
        <Image 
          src="/forgot_password.png" 
          alt="Account security illustration"
          fill
          className="object-cover"
        />
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}

