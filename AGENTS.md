# Tracmedy Web Client Agent

**Jurisdiction:** `web-client/` only
**Stack:** Next.js 14+ App Router + TypeScript strict + Tailwind CSS
**Source of global rules:** `AGENTS.md`

---

## Required Reading Before Any Task

- `AGENTS.md` — global rules
- `docs/phases/phase-XX/web-client-task.md` — your task list for the current phase (substitute XX with the phase number)
- `posthog-events.json` — all event names
- Design files in `docs/designs/web-client/` for the page being built

---

## MANDATORY — Read Before Any Action

Before making ANY edit, creation, or deletion:

1. Read this entire AGENTS.md file
2. Read docs/phases/phase-XX/web-client-task.md for current phase
3. Read ../Back-end/openapi.yaml for API reference
4. Read design files in docs/designs/phase-XX/ if doing UI work

Never skip this step. If you have not read these files, stop and read them first.

## Architecture Rules

### Auth

- JWT in httpOnly cookies — never localStorage
- Auth middleware protects all dashboard routes
- Role-based redirects enforced: clinician → dashboard, hospital_admin → dashboard
- Only authenticated + authorized users can access protected routes

### Design Tokens

- Primary: `#023E8A`
- Secondary: `#90E0EF`
- Font: Inter / sans-serif
- No hardcoded color hex values outside design token configuration
- Match Figma/design spec exactly (layout, spacing, shadows, border radius)

### Analytics

- Every page view and meaningful action fires a PostHog event
- Use event names from `posthog-events.json` only
- Events: `waitlist_submitted`, `appointment_booked`, `care_episode_created`, etc.

### Accessibility

- Non-negotiable: all interactive elements must be keyboard accessible
- Proper ARIA labels on all interactive elements
- Color contrast ratios meeting WCAG AA minimum

### Type Safety

- No `any` — use `unknown` and narrow explicitly
- Shared types from `docs/types/` when available
- **API types must be imported from `docs/types/api.ts`** — this file is auto-generated from `Back-end/openapi.yaml` via `npx openapi-typescript`. Never hand-write API request/response types
- Run `npx openapi-typescript ../Back-end/openapi.yaml -o ../docs/types/api.ts` locally if the spec has changed before starting any integration work

---

## Definition of Done

- Page matches design spec exactly
- `tsc --noEmit` passes
- All PostHog events fire for tracked actions
- Auth middleware correctly protects routes
- No tokens in localStorage verified
- Keyboard navigation works on all interactive elements

---

## Task Completion Protocol

When you finish all tasks assigned to you for the current phase, you MUST do the following **in order**:

1. **Cross-check every task** — Re-read `docs/phases/phase-XX/web-client-task.md` and `docs/phases/phase-XX/brief.md`. Verify that each task's acceptance criterion (the "Done when" statement) is met against the page you built, referencing the Figma design data and design files in `docs/designs/web-client/`. If anything is missing or incomplete, fix it before proceeding.

2. **Cross-check the Web Client Definition of Done** above — confirm every item is satisfied: page matches design spec, `tsc --noEmit` passes, PostHog events fire, auth middleware correctly protects routes, no tokens in localStorage.

3. **Mark tasks as complete** — Edit `web-client-task.md` and change every task bullet from `- [ ]` to `- [x]`. Do this only for tasks whose acceptance criteria you have verified.

4. **Run type checking** — Run `tsc --noEmit` across the entire `web-client/` project. If type errors exist, fix them before proceeding.

5. **Run lint** — Run the Next.js lint command and fix all warnings.

6. **Append completion note** — Add an entry to `docs/phases/phase-XX/brief.md` under `## Completion Notes` stating what pages and components you built, which files were created or modified, and any caveats the QA agent or Orchestrator should know.

7. **Signal completion** — Notify the Orchestrator that your tasks are done and QA can begin their review.

The Orchestrator will verify that all task checkboxes are `[x]` before advancing to QA review. If any `- [ ]` remains in `web-client-task.md`, your handshake will be reje

## API Reference

The full API specification is available at:

- Local file: ../Back-end/openapi.yaml
- Live Swagger UI: https://back-end-staging-d6f0.up.railway.app/api/docs
- Live OpenAPI JSON: https://back-end-staging-d6f0.up.railway.app/api/docs-json

When building any feature that needs API integration:

1. Check ../Back-end/openapi.yaml for the exact endpoint
2. Use the request/response shapes from the spec
3. Never guess endpoint names or response shapes

To generate fresh TypeScript types from the spec:
npx openapi-typescript ../Back-end/openapi.yaml -o lib/types/api.ts

Also create these additional files:

1. posthog-events.json in the root of web-client:
   {
   "events": {
   "landing": {
   "landing_page_viewed": "User viewed the landing page",
   "waitlist_submitted": "User submitted the waitlist form",
   "hero_signup_clicked": "User clicked Sign Up in hero section",
   "waitlist_cta_clicked": "User clicked Join Waitlist in navbar"
   },
   "auth": {
   "hospital_registered": "Hospital staff completed registration",
   "user_logged_in": "User logged in successfully",
   "user_logged_out": "User logged out"
   },
   "appointments": {
   "appointment_booked": "New appointment created",
   "appointment_confirmed": "Appointment confirmed by staff",
   "appointment_cancelled": "Appointment cancelled",
   "appointment_rescheduled": "Appointment rescheduled"
   },
   "care_episodes": {
   "care_episode_created": "New care episode created",
   "care_episode_closed": "Care episode closed",
   "care_episode_viewed": "Care episode detail viewed"
   },
   "connected_patients": {
   "patient_profile_viewed": "Patient profile viewed"
   }
   }
   }

2. docs/types/ folder - run this command to generate API types:
   npx openapi-typescript ../Back-end/openapi.yaml -o docs/types/api.ts

Do NOT change any other files.

## Common Tasks

## Before working

1. Do not change any design without my permission

## Design Files Location

Designs are organized by phase:
docs/designs/
├── phase-01/ ← Auth pages designs
├── phase-02/ ← Landing page designs
├── phase-05/ ← Appointments designs
├── phase-06/ ← Connected Patients designs
├── phase-07/ ← Care Episodes designs
├── phase-09/ ← Alerts designs
├── phase-10/ ← Messaging designs
└── phase-14/ ← Reports designs

## Design Consistency Audit

When asked to audit design consistency for a phase:

1. Read phase task file: docs/phases/phase-XX/web-client-task.md
2. Read all screenshots from docs/designs/phase-XX/
3. Compare each design against the built page
4. Check: colors, typography, layout, spacing, components, icons
5. Report inconsistencies without fixing
6. Format: File | Issue | Design | Current

When asked to fix inconsistencies:

1. Read the design file for the specific page
2. Fix only the reported inconsistencies
3. Do NOT change working functionality
4. Run npm run build after

### Check New Backend Endpoints

When asked to "check new endpoints" or "sync with backend":

1. Read ../Back-end/openapi.yaml (pull latest first)
2. Compare with all files in lib/api/
3. Find endpoints in openapi.yaml NOT yet connected in web-client
4. Check docs/phases/\*/web-client-task.md for endpoints marked ❌
5. Report:
   ✅ New endpoint available — not yet connected: GET /endpoint
   📝 File to update: lib/api/xxx.ts
   📋 Task file to update: docs/phases/phase-XX/web-client-task.md
   Do NOT change any files — report only unless told to connect.

### Fix Design Issues

When asked to "fix design" for a page:

1. Read the design file for that page
2. Read the current page code
3. Fix only visual inconsistencies
4. Do NOT change API connections or logic
5. Run npm run build after

### Build a Feature

When asked to "build [feature]":

1. Read docs/build-plan.md to find the phase
2. Read docs/phases/phase-XX/web-client-task.md
3. Read docs/designs/phase-XX/ for designs
4. Read ../Back-end/openapi.yaml for endpoints
5. Follow all rules in AGENTS.md
6. Run npm run build after

### Upadate backend.md

1. Read ../Back-end/openapi.yaml for endpoints
2. Read doc/phase for what we have built
3. Check all we have built

### API Audit

When asked to audit API connections:

1. Read ../Back-end/openapi.yaml
2. Check all pages for missing Authorization headers
3. Check response parsing (json.data.data for lists)
4. Check for mock/hardcoded data
5. Report without fixing

### Lint Fix

When asked to fix lint errors:

1. Run npm run lint
2. Fix all errors (not warnings unless asked)
3. Run npm run build
4. Confirm both pass

### PR Preparation

When asked to prepare a PR:

1. Run npm run lint — fix all errors
2. Run npm run build — fix all errors
3. Remove unused imports
4. Remove console.logs
5. git add . && git commit && git push
