'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiLogin, storeTokens } from '@/lib/api/auth'
import Image from 'next/image'


export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [keepLoggedIn, setKeepLoggedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setApiError('')
    setIsLoading(true)
    try {
      const result = await apiLogin({ email, password })
      if (!result.ok) {
        setApiError(result.message)
        return
      }
      console.log('result.data:', JSON.stringify(result.data))
      await storeTokens({
  accessToken: result.data.accessToken,
  refreshToken: result.data.refreshToken,
  expiresIn: result.data.expiresIn,
})
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — form ── */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        {/* Logo */}
        <div className="flex items-center gap-2 p-8">
          <div className="w-9 h-9 flex items-center justify-center">
            <Image src="/tracmedy_logo.svg" alt="Tracmedy Logo" width={40} height={40} />
          </div>
          <span className="text-xl font-bold text-primary tracking-[0.2em]">TRACMEDY</span>
        </div>

        {/* Form */}
        <div className="flex-1 flex items-start justify-center px-8 pb-4">
          <div className="w-full max-w-md">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-2">Welcome</h2>
            <p className="text-gray-400 text-sm text-center mb-10">
              Please enter your email and password to log in.
            </p>

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
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email Address */}
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">Email Address</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    placeholder="staff@tracmedy.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl text-gray-600 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">Password</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full pl-11 pr-12 py-3.5 border border-gray-200 rounded-xl text-gray-600 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Keep me logged in + Forgot password */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={keepLoggedIn}
                    onClick={() => setKeepLoggedIn((v) => !v)}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      keepLoggedIn ? 'bg-primary border-primary' : 'border-gray-300 bg-white'
                    }`}
                  >
                    {keepLoggedIn && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  <span className="text-sm text-gray-600">Keep me logged in</span>
                </label>
                <Link href="/hospital/forgot-password" className="text-sm text-gray-700 font-medium hover:text-primary transition-colors">
                  Forgot Password?
                </Link>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-white py-4 rounded-xl font-semibold text-base hover:opacity-90 active:opacity-80 transition-opacity mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                    Signing in…
                  </>
                ) : 'Login →'}
              </button>
            </form>

            <p className="text-center mt-6 text-gray-600 text-sm">
              Don&apos;t have an account yet?{' '}
              <Link href="/hospital/register" className="text-primary font-bold hover:underline">
                Sign up
              </Link>
            </p>

            <p className="text-center mt-8 text-xs text-gray-400 leading-relaxed max-w-sm mx-auto">
              By logging in, you agree to Tracmedy Hospital&apos;s{' '}
              <Link href="#" className="text-primary font-bold underline">
                Patient Privacy Policy
              </Link>{' '}
              and{' '}
              <Link href="#" className="text-primary font-bold underline">
                NDPR Compliance Policies
              </Link>
              . All activity is logged for security auditing.
            </p>

            {/* Footer links */}
            <div className="flex items-center justify-center gap-6 mt-8">
              <Link href="#" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary transition-colors">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                IT Support
              </Link>
              <Link href="#" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary transition-colors">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                System Status
              </Link>
            </div>
          </div>
        </div>
      </div>

    
   {/* ── Right panel — mockup ── */}
<div className="hidden lg:flex lg:w-1/2 flex-col overflow-hidden bg-linear-to-br from-[#eaecf8] via-[#dde4f5] to-[#cdd8f0]">
  <div className="px-12 pt-8 mb-0">
    <h1 className="text-5xl font-bold text-primary leading-tight mb-3">
      Post-Discharge Monitoring
    </h1>
    <p className="text-gray-500 text-lg">
      Care that follows every patient from discharge to full recovery.
    </p>
  </div>

  <div className="flex-1 flex items-end overflow-hidden">
    <Image
      src="/dashboard_mockup.png"
      alt="Dashboard Mockup"
      width={600}
      height={500}
      className="w-full object-contain object-bottom"
    />
  </div>
</div>

    </div>
  )
}
