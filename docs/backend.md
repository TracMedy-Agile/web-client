# Backend Gaps Blocking Web-Client Screens

Re-audited 2026-08-27, most recently against the `feat(phase-12.6): notify patient on call start and expose appointment avatars` commit, which also (undocumented in its own message) finished scoping `GET /care-episodes/{id}/medications/adherence` to the episode and added `source` to `MedicationAdherenceDto` — the Medication & Adherence panel's "who added this" badge was already built in the frontend and dormant waiting on this field; it now works with no further UI changes needed. This tracks backend contract gaps and bugs that affect *built* hospital web-client screens — written for whoever is working on web-client, not the backend team. Fixed entries are removed outright rather than kept as a changelog. Re-check an entry against current backend code before assuming it's still open — fixes can land at any time.

---

## `GET /auth/me` never returns a clinician's actual granted permissions — makes every permission-gated page effectively hospital_admin-only

**What you'll see:** a clinician granted `care_episode`/`appointments`/`view_all_reports`/`configure_settings` in Team Management still gets "Access Restricted" on Care Episodes, Appointments, Reports & Analytics, and Settings — regardless of what was actually granted. Only hospital_admin accounts get through. Team and Audit Log are unaffected (see why below).

**Why:** `permissions` and `accessProfile` live exclusively on `FacilityStaffMember` (`prisma/schema.prisma`), a separate model related to `User` via the `user.facilityStaffMember` relation — `User` itself has no such fields. But `AuthService.getMe()` (`auth.service.ts`) only does `this.prisma.user.findUnique({ where: { id: userId } })` with no `include` for `facilityStaffMember`, so the response the web-client uses to determine "what can I access" can never contain the clinician's actual granted permissions, no matter what Team Management saved.

**Frontend status:** nothing to fix here — `DashboardUserProvider.tsx`'s parsing logic is already correctly written to consume `permissions`/`accessProfile` from `/auth/me` the moment the backend actually sends them; there's no other endpoint a limited-access clinician can call to self-fetch this (`team.controller.ts`'s routes all require `manage_team_members` themselves, so they can't even fetch their own staff record that way). Because the data never arrives, `canAccessDashboardPermission` falls back to a hardcoded default-deny list (`STRICT_PERMISSIONS`) for `connected_patients`/`care_episode`/`appointments`/`alerts`/`messages`/`configure_settings`/`view_all_reports` — which is why those pages currently behave as blanket hospital_admin-only regardless of what's actually granted. `manage_team_members` and `audit_log` aren't in that fallback list, so Team/Audit Log pass through instead of denying — that's why the symptom looks inconsistent ("some pages denied, some not") rather than uniformly broken.

**Blocked on:** `getMe()` needs `include: { facilityStaffMember: true }` and to return `permissions`/`accessProfile` from it (alongside the existing `role`, etc.) in the `/auth/me` response.

---

## Care Episode → Insights: Patient Notes panel

**What you'll see:** the panel correctly shows nothing for check-ins where the patient didn't type a note — don't mistake this for broken, it's accurate. But if a patient reports typing a note and it's still not showing:

**Why:** confirmed live — a check-in submitted with free text in the note field came back from `GET /care-episodes/{id}/checkins` with `notes: null`. Re-verified the full path end to end: `CreateCheckinDto.notes` validation, `patientCheckIn.create()`'s write, and `getCheckinsHistory()`'s read all correctly pass `notes` through with no bug. The web-client's read side (`buildPatientNotes`, and `getCareEpisodeCheckins`'s mapping) is also clean — it even scans every check-in in history, not just the latest. Both repos are clear; if this persists, the check-in request itself isn't including `notes` in its payload, which can only be a mobile-app issue.

**Frontend status:** nothing to fix — confirmed correct on both read and write paths in this repo.

**Blocked on:** a mobile-app-side investigation into whether the check-in submission actually sends `notes`. Nothing left to check in `Back-end` or `web-client`.

---

## Team → Permissions: Connected Patients / Alerts / Messages checkboxes still do nothing

**What you'll see:** unchecking "Manage Patients," "Alerts," or "Messages" for a staff member has no effect — they can still access those three areas regardless. (Care Episodes, Appointments, and Reports & Analytics are enforced by the backend and gated client-side too — but see the `/auth/me` entry above: none of them actually work correctly for a limited-access clinician yet, since the client never learns what was granted. This entry covers the three that additionally have no backend enforcement at all, even once `/auth/me` is fixed.)

**Why:** no route in `facility.controller.ts`, `alerts.controller.ts`, or `messaging.controller.ts` has `@TeamPermissionRequired(...)` — unlike `care-episodes`, `appointment`, and `analytics` controllers, which got it in the Phase 12.6 pass. Separately, even if those routes were guarded, the checkboxes couldn't satisfy them: the Team edit UI collapses "Connected patients," "Alerts," and "Messages" into the single `care_episode` value on save (`TeamMemberActions.tsx`), so the backend never stores those three literal strings.

**Frontend status:** intentionally left ungated in `DashboardPermissionGuard.tsx` — blocking these pages client-side would lock clinicians out with no checkbox able to restore access, since backend enforcement doesn't exist yet either. Two related display/UX bugs fixed in the Edit Member modal and read-only Role & Access tab: (1) since these three collapse into `care_episode` on save, they were reading the literal never-stored `connected_patients`/`alerts`/`messages` keys and always showing unchecked even for a member who genuinely has `care_episode` access — both now treat them as checked whenever `care_episode` is present; (2) the four checkboxes (Connected patients/Care episodes/Alerts/Messages) are now toggled together as one linked group in the edit modal (`CARE_EPISODE_BUNDLE` in `TeamMemberActions.tsx`) — previously unchecking just one while the others stayed checked silently did nothing on save (since `care_episode` still got included via the sibling checkboxes), which looked like the uncheck reverted itself on reopen. This is the frontend's ceiling: it can make the four move honestly as a single unit, but it can't make them independently revocable — that still needs the backend to grant `care_episode` its own dedicated sub-permissions.

**Blocked on:** backend adding `@TeamPermissionRequired(TeamPermission.CARE_EPISODE)` (or new dedicated permission values) to the facilities/alerts/messaging controllers, and deciding whether "Connected patients"/"Alerts"/"Messages" should keep collapsing into `care_episode` or become independently grantable.

---

## Settings -> Hospital Profile: address saves, but facility coordinates stay null

**What you'll see:** saving the Hospital Profile persists the typed address, logo, and cover photo, but `GET /facilities/{id}` still returns `latitude: null` and `longitude: null`.

**Why:** the backend location endpoint exists and accepts coordinates (`PATCH /facilities/{id}/location`), but the current Settings screen only has a plain address text input. A typed address does not produce latitude/longitude, so the web client has no real coordinates to send.

**Frontend status:** partial wiring exists — the Settings page can store coordinates and call `PATCH /facilities/{id}/location` when an in-app address picker provides a `{ address, latitude, longitude }` selection event. Not complete until a real address picker/geocoder source exists. Currently deprioritized/on hold by product choice, not blocked on anything technical.

**Blocked on:** a product decision on how coordinates get captured (manual lat/lng inputs vs. an autocomplete + geocoding API) — see the options discussed in this session; nothing to build until that's picked.

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
| Facility care-configuration | default episode duration, auto-close inactive episodes, clinician approval requirement, critical-alert escalation roles |
| Notification preferences | connected at the user level; no facility-wide policy endpoint if that's ever needed |

Roles & Permissions (Settings) is no longer in this table — it's a deliberately static/mock policy-preview screen by design (matches the SET-12 design spec), not something waiting on a backend contract.

**Frontend status:** nothing to build against yet on any of these — they're intentionally static/mock until backend ships something.

---

## Alert resolve/escalate actions have no design spec

`PATCH /alerts/{id}/resolve` and `PATCH /alerts/{id}/escalate` exist and work, but there's no frontend surface for them: `EscalateCaseModal.tsx` is fully built but not imported anywhere (dead code — it used to be wired into the Alerts screen, that wiring was removed at some point), and neither `resolveAlert` nor `escalateAlert` (both already implemented in `lib/api/alerts.ts`) are called from any page.

**Why it's not just a wiring task:** the Alerts design spec (`docs/designs/phase-09/APP-04 Alerts.jpg`, `ALT-02 Review Impact.jpg`) only shows a "Review" row action leading to a read-only impact modal with "Cancel" / "Open Care Episode" buttons and the explicit note "Acknowledgement must be completed from the patient's care episode." There's no Resolve or Escalate button anywhere in the design. Building this UI now would mean inventing a flow with no spec to match — the "Do not change any design without permission" rule applies here.

**Frontend status:** blocked on a design decision, not a technical one. Needs input on: should Resolve/Escalate live in this modal, in the care episode's own alert-handling flow, or somewhere not yet designed at all?

**Blocked on:** product/design direction for where and how these two actions should appear.

---

## Newly available backend endpoints not yet connected

- `GET /forecasts/facility/summary`, `GET /forecasts/facility/recovery-trend` — facility-wide forecast rollups. Not wired up, and no design (checked `docs/designs/phase-14/RA-01 Reports & Analytics.png`, the main Reports & Analytics screen) shows a matching card or chart — the current stat cards/charts there are Avg Alert Response Time, Appointments, Active Clinicians, Alert Response Performance, Consultation Trends, and Clinician Workload. Hold off building anything against these until there's a design to match.

`GET /forecasts/episodes/{episodeId}` (+ `/refresh`) is not listed here — it matches the Recovery Probability / Risk of Deterioration / Relapse Risk Forecast cards on `docs/designs/phase-07/CE-05 Recovery & Outcome.png`, and is already fully connected in `lib/api/care-episodes.ts` (`getCareEpisodeForecast` / `refreshCareEpisodeForecast`) and rendered on `/dashboard/care-episodes/[id]/recovery`.

`GET /appointments` and `GET /appointments/{id}` now return `patientAvatarUrl` (always populated) and `clinicianAvatarUrl` (populated once assigned) — real uploaded photo, or a generated initials-style avatar (via ui-avatars.com) as fallback. Connected: `/dashboard/appointments/[id]` now renders the patient's real photo (falling back to the client-side initials circle if the field is ever empty). The appointments list and Virtual Consultations tables don't show avatars at all in their designs (plain text names only), so `clinicianAvatarUrl` and the list-level `patientAvatarUrl` have no UI slot to go into — nothing else to wire here.

Everything else the Phase 12.6 pass shipped (appointment completion, care-team add/remove, the `episodeId` alert filter, `consultationDate`/`dischargeStatus`/`followUp`, care-plan version history, task completion-log, the closure summary fields, and the full Audit Log API) is already connected in web-client — verified directly in code, not assumed.

Phase 13a landed since: mostly a new `/admin/*` module, `tracmedy_admin`-only (`admin.controller.ts`), out of scope for this app. Two things worth knowing if/when building the Audit Log screen: `AuditLogResponseDto.facilityId`/`.actorId` are now nullable (platform-level events and unknown-actor failed-login attempts can have both null) — render a fallback for those. Also confirmed the teleconsultation `endCall` authorization change (`assertClinicianCanEnd`, assigned-clinician-only) matches what `VideoCallView`'s callers already gate on, so no fix needed there; the new `/call/leave` (participant-aware leave without ending for the other party) and `/call/nudge-clinician` (patient-initiated) aren't relevant to this clinician-only web client.

Still not available: `POST /home-care/requests` still always records the authenticated caller as the patient, so a clinician still can't create a home-care order for the episode patient (`requestType: clinician_initiated` is accepted by the DTO but not honored server-side).
