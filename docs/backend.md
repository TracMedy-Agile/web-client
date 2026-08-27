# Backend Gaps Blocking Web-Client Screens

Re-audited 2026-08-19, with a further pass removing entries confirmed fixed since. This tracks backend contract gaps and bugs that affect *built* hospital web-client screens — written for whoever is working on web-client, not the backend team. Each entry leads with what you'll actually see on the screen, then the backend reason, then what (if anything) to do about it. Re-check an entry against current backend code before assuming it's still open — this list only reflects what was verified still-broken as of the last edit; fixes can land at any time. Fixed entries are removed outright rather than kept as a changelog.

---

## Care Episode → Insights: Medication & Adherence panel

**What you'll see:** patient self-logged and manually-added medications mixed in with clinician-prescribed ones from the current care plan — the panel doesn't distinguish who added what.

**Why:** `GET /care-episodes/{id}/medications/adherence` pulls every medication belonging to the patient (`care-episodes.service.ts:1795`, `getMedicationAdherence` → `this.prisma.medication.findMany({ where: { userId: episode.patientId } })`) — no episode scope, no filter on `Medication.source` (`care_plan | patient | manual`). The response DTO doesn't even carry `source`, so there's no field to filter on client-side even as a workaround.

**Frontend status:** nothing to fix here — this is a pure data-completeness issue in the API response, not a rendering bug.

**Blocked on:** backend scoping the query to the episode and filtering `source: 'care_plan'`, plus adding `source` to `MedicationAdherenceDto` as a fallback filtering field.

---

## Care Episode → Insights: Patient Notes panel

**What you'll see:** the panel correctly shows nothing for check-ins where the patient didn't type a note — don't mistake this for broken, it's accurate. But if a patient reports typing a note and it's still not showing:

**Why:** confirmed live — a check-in submitted with free text in the note field came back from `GET /care-episodes/{id}/checkins` with `notes: null`. The data isn't reaching the database (or isn't being sent by the mobile app), so there's nothing for the panel to show. Verified this is not a frontend read/parse issue.

**Frontend status:** nothing to fix — the panel correctly reads `checkin.notes`; the field is genuinely empty in the API response.

**Blocked on:** backend/mobile investigation into whether the check-in submission is sending `notes` at all, and whether `CreateCheckinDto.notes` → `patientCheckIn.create(...)` is persisting it.

---

## Care Episode → Recovery: Daily Care Tasks checklist

**What you'll see:** paging back/forward through days, the checklist only shows real checked/unchecked state for **today** — every other day shows all tasks unchecked, even ones that really were done that day.

**Why:** there's no per-day completion history anywhere in the data model — `CarePlan.tasks` (confirmed in `schema.prisma`) is a single JSON blob where each task has one live `status`/`completedAt`, not a log. `GET /care-episodes/{id}/tasks/completion?date=` only derives same-day aggregate counts from that live state; it can't say which specific tasks were done on a past date.

**Frontend status:** already handled — the web client deliberately shows unchecked (not stale/wrong-day state) for any day except today, since that's the most honest thing it can do with the current API. No further frontend work needed until the backend adds history.

**Blocked on:** a `TaskCompletionLog`-style table (mirroring how `MedicationLog` already works — see `GET /care-episodes/{id}/medications/{medicationId}/logs`) plus an endpoint like `GET /care-episodes/{id}/tasks/completion-log?date=YYYY-MM-DD`.

---

## Team → Permissions (Invite/Edit member, member profile tab)

**What you'll see:** unchecking "Manage Patients," "View Care Episodes," "Acknowledge alerts," etc. for a staff member has no effect on the backend — they can still hit every API route regardless of what's unchecked. Only removing Team Management or Audit Log access actually produces a backend 403. As of this fix, unchecking them also no longer blocks the *page* client-side either (see Frontend status) — previously it did, and worse.

**Why:** the enforcement mechanism (`TeamPermissionGuard`) works correctly, but `@TeamPermissionRequired(...)` is only wired onto two controllers — `team.controller.ts` and `audit.controller.ts`. The other permissions (`care_episode`, `appointments`, `view_all_reports`, `configure_settings`) are stored on the staff record but never checked by any route.

**Frontend status:** `DashboardPermissionGuard.tsx`'s `GUARDED_ROUTES` previously blocked whole pages (Connected Patients, Care Episodes, Appointments, Alerts, Messages, Reports, Settings) based on these same unenforced permissions — and three of them (`connected_patients`, `alerts`, `messages`) could *never* be satisfied at all, because the Team edit UI collapses those specific checkboxes into the single `care_episode` value on save (`TeamMemberActions.tsx`), so the backend never stores those literal strings. Any clinician without full access was permanently locked out of those three pages, with no checkbox able to restore it. Fixed by narrowing `GUARDED_ROUTES` to only the two permissions the backend actually enforces (`manage_team_members`, `audit_log`) — everything else is intentionally left open client-side until the backend adds real checks, to match actual (unenforced) reality instead of being stricter than the backend for no security benefit. Separately (not backend's problem, just worth knowing): the "Clinical Care" group shows 9 checkboxes that all collapse onto the single `care_episode` value — there's no way to make "Acknowledge alerts" independent of "View alerts" until the permission model itself gets more granular, which isn't currently planned.

**Blocked on:** backend adding `@TeamPermissionRequired(TeamPermission.CARE_EPISODE)` / `.APPOINTMENTS` / `.VIEW_ALL_REPORTS` to the relevant controllers.

---

## Settings -> Hospital Profile: address saves, but facility coordinates stay null

**What you'll see:** saving the Hospital Profile persists the typed address, logo, and cover photo, but `GET /facilities/{id}` still returns `latitude: null` and `longitude: null`.

**Why:** the backend location endpoint exists and accepts coordinates (`PATCH /facilities/{id}/location`), but the current Settings screen only has a plain address text input. A typed address does not produce latitude/longitude, so the web client has no real coordinates to send. After verification returned null coordinates, the frontend was guarded so manual address saves do not PATCH `null` and accidentally clear facility location.

**Frontend status:** partial wiring exists. The Settings page can store coordinates and call `PATCH /facilities/{id}/location` when an in-app address picker provides a `{ address, latitude, longitude }` selection event. The task is not complete until a real address picker/geocoder source is available and `GET /facilities/{id}` returns numeric latitude/longitude after save.

**Blocked on:** adding or approving a coordinate source for the address picker. This can be either an in-app picker component that emits coordinates, or a backend/geocoding contract that converts selected addresses to coordinates. Expected verified state: `latitude` and `longitude` are numbers, not `null`.

---

## Settings pages that only show mock/static data

These pages exist in the UI (some per design files, some as placeholders) but have nothing to connect to — confirmed by searching the full OpenAPI spec, none of these paths exist at all:

| Settings page | What's missing |
|---|---|
| Security | 2FA, session timeout, max login attempts, active-session listing, log out all devices (only password change is real, via `POST /auth/change-password`) |
| Integrations | EHR connect/disconnect status, API key reveal/regenerate/revoke/audit trail |
| Appointment settings | default duration, check-in window, grace period, daily capacity, virtual-consultation toggle, auto-confirm follow-ups |
| Billing → Invoices | list/filter invoices, invoice detail, downloads, pay/retry, update payment method, cancel subscription |
| Billing → current plan | `GET /subscriptions/me` is real but documented as a stub always returning the free plan |
| Roles & Permissions (Settings) | default role access, permission policy toggles, dependency rules — the per-member permissions in Team Management are real, but there's no facility-wide policy/defaults contract |
| Facility care-configuration | default episode duration, auto-close inactive episodes, clinician approval requirement, critical-alert escalation roles |
| Notification preferences | connected at the user level; no facility-wide policy endpoint if that's ever needed |

**Frontend status:** nothing to build against yet on any of these — they're intentionally static/mock until backend ships something.
