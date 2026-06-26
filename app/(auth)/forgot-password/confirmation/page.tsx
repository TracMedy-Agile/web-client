'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

function TracmedyLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9  flex items-center justify-center">
       <Image src="/tracmedy_logo.svg" alt="Tracmedy Logo" width={40} height={40}  />
      </div>
      <span className="text-xl font-bold text-primary tracking-[0.2em]">TRACMEDY</span>
    </div>
  )
}

function EmailSentContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  const [resendState, setResendState] = useState<'idle' | 'loading' | 'sent'>('idle')

  const handleResend = async () => {
    setResendState('loading')
    // TODO: call resend API with email
    await new Promise((r) => setTimeout(r, 800))
    setResendState('sent')
    setTimeout(() => setResendState('idle'), 4000)
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        <div className="p-8">
          <TracmedyLogo />
        </div>

        <div className="flex-1 flex items-center justify-center px-8 pb-16">
          <div className="w-full max-w-md">
           
           

            <h2 className="text-3xl font-bold text-gray-900 text-center mb-3">Email Sent</h2>
            <p className="text-gray-400 text-sm text-center leading-relaxed mb-1">
              A secure password reset link has been sent to your registered email address
            </p>
            {email && (
              <p className="text-primary text-sm font-semibold text-center mb-8 truncate px-4">
                {email}
              </p>
            )}
            {!email && <div className="mb-8" />}

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 mb-8 flex gap-3">
              <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-gray-500 text-sm leading-relaxed">
                Please check your inbox and follow the instructions. If you don&apos;t see the email
                within 5 minutes, kindly check your{' '}
                <span className="font-bold text-gray-700">spam or junk folder</span>.
              </p>
            </div>

            {/* Return to login */}
            <Link
              href="/login"
              className="w-full bg-primary text-white py-4 rounded-xl font-semibold text-base hover:opacity-90 active:opacity-80 transition-opacity flex items-center justify-center"
            >
              Return To Login
            </Link>

            {/* Resend email */}
            <div className="text-center mt-5">
              {resendState === 'sent' ? (
                <span className="text-sm text-green-600 font-medium flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Email resent successfully
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendState === 'loading'}
                  className="text-sm font-bold text-gray-800 hover:text-primary transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {resendState === 'loading' ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                      </svg>
                      Sending…
                    </>
                  ) : (
                    'Resend Email'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel — illustration ── */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden">
       <Image 
                src="/sign-in-image.png" 
                alt="sign in image" 
                fill
                className="object-cover"
              />

      </div>
    </div>
  )
}

export default function EmailSentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <EmailSentContent />
    </Suspense>
  )
}
