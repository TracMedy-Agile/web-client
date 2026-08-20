# Backend Gaps Blocking Web-Client Screens

Re-audited 2026-08-19. This tracks backend contract gaps and bugs that affect *built* hospital web-client screens — written for whoever is working on web-client, not the backend team. Each entry leads with what you'll actually see on the screen, then the backend reason, then what (if anything) to do about it. Re-check an entry against current backend code before assuming it's still open — several already got fixed mid-session (see "Resolved" at the bottom).

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

## Appointment Details: Patient Information card

**What you'll see:** the "Age / Gender" field always renders `--`, even though Name/Email/Phone show correctly for the same patient.

**Why:** `GET /appointments/{id}` (`appointment.service.ts:368`, `findOne`) selects only `{ id, name, email, phone }` on the patient relation — `dateOfBirth`/`gender` are never fetched, so the API response genuinely has no value to render. Confirmed this against the live Prisma query, not just the (stale) published OpenAPI spec, which doesn't even document a `patient` object on this endpoint at all.

**Frontend status:** nothing to fix — this is a missing field in the API response.

**Blocked on:** adding `dateOfBirth`/`gender` to that `select` (both fields already exist on the user model and are used elsewhere, e.g. `PatientIdentityDto`).

---

## Team → Permissions (Invite/Edit member, member profile tab)

**What you'll see:** unchecking "Manage Patients," "View Care Episodes," "Acknowledge alerts," etc. for a staff member has no effect — they can still access Connected Patients, Care Episodes, Appointments, Alerts, Messages, and Reports/Analytics regardless of what's unchecked. Only removing Team Management or Audit Log access actually produces Access Denied.

**Why:** the enforcement mechanism (`TeamPermissionGuard`) works correctly, but `@TeamPermissionRequired(...)` is only wired onto two controllers — `team.controller.ts` and `audit.controller.ts`. The other three grantable permissions (`care_episode`, `appointments`, `view_all_reports`) are stored on the staff record but never checked by any route.

**Frontend status:** nothing to fix on our end — the checkboxes correctly send the right values, the backend just doesn't act on most of them yet. Separately (not backend's problem, just worth knowing): the "Clinical Care" group shows 9 checkboxes that all collapse onto the single `care_episode` value — there's no way to make "Acknowledge alerts" independent of "View alerts" until the permission model itself gets more granular, which isn't currently planned.

**Blocked on:** backend adding `@TeamPermissionRequired(TeamPermission.CARE_EPISODE)` / `.APPOINTMENTS` / `.VIEW_ALL_REPORTS` to the relevant controllers.

---

## Anywhere a clinician's photo/initials show (Team, Care Team, Reports, appointment scheduling)

**What you'll see:** only the *logged-in* user's own avatar (top-right Navbar) can ever show a real photo. Every other clinician — Team list, Care Team member cards, Clinician Workload/Reports, appointment scheduling pickers — always shows initials, even for clinicians who've uploaded a profile photo.

**Why:** `User.avatarUrl` exists and is populated (confirmed in `schema.prisma`, returned by `/auth/me` and `/profile/me`), but every endpoint that lists *other* clinicians drops it in mapping — `ClinicianListItemDto`/`ClinicianProfileResponseDto` (`clinicians.service.ts`, `mapClinicianListItem`) and `CareTeamMemberDto` have no `avatarUrl` field at all, even though the underlying query already fetches the full user row.

**Frontend status:** the Navbar fix (own avatar) is done and live. No further frontend work possible until the other DTOs carry the field.

**Blocked on:** backend adding `avatarUrl` to those three DTOs — this is a mapping-layer omission, not a new query, so should be a quick fix.

---

## Team → Add New Team Member: invite email link is broken, and the page can't be personalized

**What you'll see:** a new team member gets an invite email, but clicking "Accept Invitation" in it 404s instead of opening the activation page.

**Why:** `team.service.ts:474` builds the link as `${FRONTEND_URL}/team/accept?token=...`, but the page actually lives at `/accept-invite` (`app/(auth)/accept-invite/page.tsx`) — the path was never updated to match. Separately, the email template itself (`team-invite.html`) has `{{Inviter Name}}` and `{{Role}}` placeholders in its copy that are never filled in — `sendInviteEmail()` only passes `userEmail`, `inviteLink`, `hospitalName` as template variables, so those two placeholders render literally in the sent email.

**Frontend status:** the activation page at `/accept-invite` is built and matches the `team-invite.png` design (full name, verified email, live password-strength checklist, terms checkbox). It reads `hospitalName`, `inviterName`, `role`, and `email` as optional query params on the link and renders the personalized header/verified-email field when they're present — but degrades to generic copy when they're not (which is always, today), since the invite link only ever carries `?token=`. There's also no `GET`-by-token endpoint to fetch invite context another way, so this can't be fixed from the frontend alone.

**Blocked on:** (1) fixing the link path in `team.service.ts:474` to `/accept-invite?token=...`; (2) either adding `hospitalName`, `inviterName`, `role`, `email` as query params on that link, or exposing a public `GET /team/members/invite/:token` lookup, so the activation page can show the real inviter/hospital/role instead of the generic fallback; (3) fixing the unused `{{Inviter Name}}`/`{{Role}}` placeholders in `team-invite.html` so they don't render literally in the email itself.

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
