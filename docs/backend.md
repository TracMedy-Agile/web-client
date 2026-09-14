# Backend Gaps Blocking Web-Client Screens

Re-audited 2026-08-27, most recently against the `feat(phase-12.6): notify patient on call start and expose appointment avatars` commit, which also (undocumented in its own message) finished scoping `GET /care-episodes/{id}/medications/adherence` to the episode and added `source` to `MedicationAdherenceDto` — the Medication & Adherence panel's "who added this" badge was already built in the frontend and dormant waiting on this field; it now works with no further UI changes needed. This tracks backend contract gaps and bugs that affect *built* hospital web-client screens — written for whoever is working on web-client, not the backend team. Fixed entries are removed outright rather than kept as a changelog. Re-check an entry against current backend code before assuming it's still open — fixes can land at any time.

---

## Care Episode → Insights: Patient Notes panel

**What you'll see:** the panel correctly shows nothing for check-ins where the patient didn't type a note — don't mistake this for broken, it's accurate. But if a patient reports typing a note and it's still not showing:

**Why:** confirmed live — a check-in submitted with free text in the note field came back from `GET /care-episodes/{id}/checkins` with `notes: null`. Re-verified the full path end to end: `CreateCheckinDto.notes` validation, `patientCheckIn.create()`'s write, and `getCheckinsHistory()`'s read all correctly pass `notes` through with no bug. The web-client's read side (`buildPatientNotes`, and `getCareEpisodeCheckins`'s mapping) is also clean — it even scans every check-in in history, not just the latest. Both repos are clear; if this persists, the check-in request itself isn't including `notes` in its payload, which can only be a mobile-app issue.

**Frontend status:** nothing to fix — confirmed correct on both read and write paths in this repo.

**Blocked on:** a mobile-app-side investigation into whether the check-in submission actually sends `notes`. Nothing left to check in `Back-end` or `web-client`.

---

## Team → Permissions: Connected Patients / Alerts / Messages checkboxes still do nothing

**What you'll see:** the current Team Management contract stores Connected Patients, Care Episodes, Alerts, and Messages as the shared `care_episode` permission. Removing that bundle removes access to the associated screens.

**Why:** no route in `facility.controller.ts`, `alerts.controller.ts`, or `messaging.controller.ts` has independent permission values for these screens. The Team edit UI therefore maps the four related checkboxes to `care_episode` until the backend publishes dedicated permissions.

**Frontend status:** Connected Patients, Alerts, and Messages are now guarded client-side and display the standard Access Restricted state when the clinician lacks the saved bundle permission. The auth parser reads the backend's `facilityStaffMember.permissions` response, and the permission guard maps `care_episode` to the bundled screens.

**Blocked on:** backend adding independent permission values and route enforcement if Connected Patients, Alerts, or Messages must be revocable separately rather than as one shared care-episode bundle.
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
