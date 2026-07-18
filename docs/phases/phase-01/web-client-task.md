# Phase 01 — Auth & Onboarding Web Client Tasks

## Status: Done ✅

## Pages Built
- [x] Register → /register
- [x] Login → /login
- [x] Verify Email (OTP) → /verify-email
- [x] Forgot Password → /forgot-password
- [x] Email Sent Confirmation → /forgot-password/confirmation
- [x] Reset Password → /reset-password

## API Endpoints Used
- POST /auth/hospital/register — register hospital staff
- POST /auth/hospital/login — login hospital staff
- POST /auth/verify-otp — verify OTP
- POST /auth/resend-otp — resend OTP
- POST /auth/forgot-password — request password reset
- POST /auth/reset-password — reset password
- GET /facilities/lookup/{tracId} — auto-fill hospital name

## Components Created
- app/(auth)/register/page.tsx
- app/(auth)/login/page.tsx
- app/(auth)/verify-email/page.tsx
- app/(auth)/forgot-password/page.tsx
- app/(auth)/forgot-password/confirmation/page.tsx
- app/(auth)/reset-password/page.tsx
- app/api/auth/set-tokens/route.ts — httpOnly cookie handler
- app/api/auth/get-token/route.ts — token retrieval
- middleware.ts — route protection

## Known Issues / Blockers
- Hospital register name field missing (waiting for Kingsley)
- Reset password email link points to wrong URL (temporary redirect created)

## Notes
- Auth uses httpOnly cookies for token storage
- Role-based redirect after login (clinician/hospital_admin → /dashboard, tracmedy_admin → /admin/dashboard)
