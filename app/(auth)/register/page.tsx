'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiRegister } from '@/lib/api/auth'
import Image from 'next/image'
// import hospital_id from '../../../../../public/id_Icon.svg'
// import hospital from "../../../../../public/hospital.svg"

type FacilityRecord = Record<string, unknown>

function asRecord(value: unknown): FacilityRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as FacilityRecord
    : null
}

function getFacilities(payload: unknown): FacilityRecord[] {
  if (Array.isArray(payload)) return payload.filter(asRecord)

  const record = asRecord(payload)
  if (!record) return []

  if (Array.isArray(record.data)) return record.data.filter(asRecord)

  const data = asRecord(record.data)
  if (data) {
    if (Array.isArray(data.items)) return data.items.filter(asRecord)
    if (Array.isArray(data.facilities)) return data.facilities.filter(asRecord)
    return [data]
  }

  if (Array.isArray(record.items)) return record.items.filter(asRecord)
  if (Array.isArray(record.facilities)) return record.facilities.filter(asRecord)

  return [record]
}

function getFacilityName(facility: FacilityRecord) {
  const name = facility.name ?? facility.facilityName ?? facility.hospitalName
  return typeof name === 'string' ? name.trim() : ''
}

export default function RegisterPage() {
  const router = useRouter()
  const lookupRequestId = useRef(0)
  const [showPassword, setShowPassword] = useState(false)
  const [hospitalId, setHospitalId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isHospitalLookupLoading, setIsHospitalLookupLoading] = useState(false)
  const [hospitalLookupError, setHospitalLookupError] = useState('')
  const [isHospitalNameAutoFilled, setIsHospitalNameAutoFilled] = useState(false)
  const [lastLookedUpHospitalId, setLastLookedUpHospitalId] = useState('')
  const [apiError, setApiError] = useState('')

  const handleHospitalIdChange = (value: string) => {
    lookupRequestId.current += 1
    setHospitalId(value)
    setHospitalLookupError('')
    setIsHospitalLookupLoading(false)

    if (value.trim() !== lastLookedUpHospitalId) {
      setLastLookedUpHospitalId('')
    }

    if (isHospitalNameAutoFilled) {
      setName('')
      setIsHospitalNameAutoFilled(false)
    }
  }
  const handleHospitalLookup = async () => {
    const tracId = hospitalId.trim()

    if (!tracId) {
      setHospitalLookupError('')
      setLastLookedUpHospitalId('')
      if (isHospitalNameAutoFilled) {
        setName('')
        setIsHospitalNameAutoFilled(false)
      }
      return
    }

    if (tracId === lastLookedUpHospitalId && isHospitalNameAutoFilled) return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) {
      setIsHospitalNameAutoFilled(false)
      setHospitalLookupError('Unable to look up this Hospital ID. Please try again.')
      return
    }

    const currentRequestId = lookupRequestId.current + 1
    lookupRequestId.current = currentRequestId
    setIsHospitalLookupLoading(true)
    setHospitalLookupError('')

    try {
      const response = await fetch(`${apiUrl}/facilities/lookup/${encodeURIComponent(tracId)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const payload = await response.json().catch(() => null)

      if (lookupRequestId.current !== currentRequestId) return

      if (!response.ok) {
        setName('')
        setIsHospitalNameAutoFilled(false)
        setLastLookedUpHospitalId('')
        setHospitalLookupError('Hospital ID not found')
        return
      }

      const facilityName = getFacilities(payload).map(getFacilityName).find(Boolean)

      if (!facilityName) {
        setName('')
        setIsHospitalNameAutoFilled(false)
        setLastLookedUpHospitalId('')
        setHospitalLookupError('Hospital ID not found')
        return
      }

      setName(facilityName)
      setIsHospitalNameAutoFilled(true)
      setLastLookedUpHospitalId(tracId)
    } catch {
      if (lookupRequestId.current !== currentRequestId) return

      setIsHospitalNameAutoFilled(false)
      setHospitalLookupError('Unable to look up this Hospital ID. Please try again.')
    } finally {
      if (lookupRequestId.current === currentRequestId) {
        setIsHospitalLookupLoading(false)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setApiError('')
    setIsLoading(true)
    try {
     const result = await apiRegister({ hospitalId, name, email, password })
      if (!result.ok) {
        setApiError(result.message)
        return
      }
      const userId = (result.data as { userId?: string })?.userId ?? ''
      router.push(`/verify-email?userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      
     {/* ── Left panel ── */}
<div className="hidden lg:flex lg:w-1/2 flex-col overflow-hidden bg-linear-to-br from-[#eaecf8] via-[#dde4f5] to-[#cdd8f0]">
  <div className="px-12 pt-12">
    <h1 className="text-lg font-bold md:text-3xl text-primary leading-tight mb-4">
      Post-Discharge Monitoring
    </h1>
    <p className="text-gray-500 text-lg mb-4">
      Care that follows every patient from discharge to full recovery.
    </p>
  </div>

  {/* Dashboard mockup */}
  <div className="flex-1 flex items-end justify-center overflow-hidden pr-8">
    <Image
      src="/dashboard.png"
      alt="Dashboard Mockup"
      width={600}
      height={500}
      className="w-full object-contain object-bottom drop-shadow-2xl"
    />
  </div>
</div>

      {/* ── Right panel ── */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        {/* Logo */}
        <div className="flex justify-end p-4 sm:p-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9  flex items-center justify-center">
            <Image src="/tracmedy_logo.svg" alt="Tracmedy Logo" width={40} height={40} />
            </div>
            <span className="text-lg font-bold md:text-xl text-primary tracking-[0.2em]">TRACMEDY</span>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-8 pb-12">
          <div className="w-full max-w-md">
            <h2 className="text-lg font-bold md:text-3xl text-gray-900 text-center mb-10">
              Create Your Account
            </h2>

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
              {/* Hospital ID */}
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">Hospital ID</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                    <Image src="/id_Icon.svg" alt="Hospital ID Icon" width={16} height={16} />
                  </span>
                  <input
                    type="text"
                    placeholder="TRAC-992-001"
                    value={hospitalId}
                    onChange={(e) => handleHospitalIdChange(e.target.value)}
                    onBlur={handleHospitalLookup}
                    className="w-full pl-11 pr-11 py-3.5 border border-gray-200 rounded-xl text-gray-600 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  {isHospitalLookupLoading && (
                    <svg
                      className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      aria-label="Looking up hospital"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                {hospitalLookupError && (
                  <p className="mt-2 text-xs text-red-600">{hospitalLookupError}</p>
                )}
              </div>

              {/* Hospital Name */}
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">Hospital Name</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                    <Image src="/hospital.svg" alt="Hospital Icon" width={16} height={16} />
                  </span>
                  <input
                    type="text"
                    placeholder="Lagos City Medical Center"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    readOnly={isHospitalNameAutoFilled}
                    className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl text-gray-600 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors read-only:bg-gray-50 read-only:cursor-default"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">Email</label>
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
                <label className="block text-sm font-bold text-gray-800 mb-2">Secure Password</label>
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
                    autoComplete="new-password"
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

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || isHospitalLookupLoading}
                className="w-full bg-primary text-white py-4 rounded-xl font-semibold text-base hover:opacity-90 active:opacity-80 transition-opacity mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                    Creating account…
                  </>
                ) : 'Create Account →'}
              </button>
            </form>

            <p className="text-center mt-6 text-gray-600 text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-primary font-bold hover:underline">
                Login
              </Link>
            </p>

            <p className="text-center mt-5 text-xs text-gray-500 leading-relaxed">
              By requesting access, you agree to our{' '}
              <Link href="#" className="text-primary font-bold underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="#" className="text-primary font-bold underline">
                NDPR Compliance Policies
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}



