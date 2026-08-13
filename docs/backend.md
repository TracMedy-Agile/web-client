# Backend Work Required for Built Hospital Screens

The published staging OpenAPI contract was re-audited on 2026-08-12. This file lists only missing backend contracts, backend contract gaps, or runtime backend issues affecting built hospital web-client screens.

## Dashboard

- **Recovery Trend time-series endpoint needed:** The dashboard design needs a true Recovery Trend chart contract with daily/period labels, active patient recovery scores, and facility mean recovery scores. Current available endpoints do not provide this exact time-series data: `GET /api/v1/forecasts/facility/summary` returns aggregate forecast KPIs only, and `GET /api/v1/analytics/readmission-trend` returns readmission trend rather than recovery-score trend. Please expose a dashboard recovery trend endpoint, for example `GET /api/v1/forecasts/facility/recovery-trend?range=7d|30d`, returning points like `{ label, active, mean }` or the backend-preferred equivalent.

## Settings
- Facility/hospital settings update endpoint for Phase 08 Hospital Profile: logo URL/upload association, hospital name, address, contact email, contact phone, and timezone. The web client can currently read facility details from `GET /api/v1/auth/hospital`, but no facility settings update contract exists.
- Facility care-configuration settings endpoint for default episode duration, auto-close inactive episodes, clinician approval requirement, and critical-alert escalation roles. The current appointment capacity endpoint still documents safe defaults until settings exist.
- Notification preferences are connected through profile endpoints, but hospital/facility-level notification policy persistence is not available if these preferences should apply to the whole workspace rather than the current user.
- Security settings endpoints for two-factor authentication, session timeout, max login attempts, active-session listing, and log out all devices. Only password change is currently available and connected through `POST /api/v1/auth/change-password`.
- Integrations endpoints for EHR connection status/connect/disconnect and API key reveal, regenerate, revoke, and audit trail.
- Appointment settings endpoint for default appointment duration, check-in window, late check-in grace period, daily facility capacity, virtual consultation enablement, clinician assignment requirement, and auto-confirm follow-ups.
- Production subscription/billing summary endpoint with current billing period, estimated invoice total, payment method, usage cards, lifecycle status, and renewal date. `GET /api/v1/subscriptions/me` exists and is connected, but it is documented as a stub returning the free plan by default.
- Billing invoice endpoints for listing invoices with filters/pagination, viewing invoice detail, downloading server-generated invoice files, paying outstanding/overdue invoices, retrying failed payments, updating payment method, and cancelling subscription.
- Settings-level roles and permissions endpoints for default role access, permission policy toggles, workspace administration grant/edit table, permission dependency rules, and saving role-policy defaults. Team member permission fields exist in the Team Management contract, but there is no dedicated Settings role-policy/defaults contract.


## Team Management


- **Team Management clinician permission enforcement needed:** The OpenAPI contract currently marks Team Management routes as `hospital_admin only`, including `GET /api/v1/team/members`, `POST /api/v1/team/members`, `PATCH /api/v1/team/members/{id}`, suspend/reactivate/delete, activity, resend-invite, and escalation-preference routes. The web-client permission model allows hospitals to grant clinicians access to Team Management through team permissions. Backend should authorize clinicians based on those granted permissions/facility policy instead of blocking all non-admin staff when permission is enabled.
- **Team member ID mismatch:** `GET /api/v1/team/members` can return rows with an `id` value like `legacy-cmqv2qopz00004c3sl0sm31fd`, but mutation endpoints expect the real Staff member ID. Example failing request: `PATCH /api/v1/team/members/legacy-cmqv2qopz00004c3sl0sm31fd` returns `404 Team member not found`. Ensure the list endpoint returns the same Staff member `id` accepted by `PATCH /team/members/{id}`, `POST /team/members/{id}/suspend`, `POST /team/members/{id}/reactivate`, `DELETE /team/members/{id}`, `POST /team/members/{id}/resend-invite`, and escalation preference routes. The web client already passes the row `id` from `GET /team/members`; it cannot safely edit legacy/fallback IDs that the backend does not accept.

## Audit Log

- **Clinician access policy confirmation needed:** `GET /api/v1/facilities/audit-logs?page=1&limit=6` works for `hospital_admin`, but returns `403 Forbidden resource` for clinicians. If clinicians should be allowed to view audit logs when the hospital grants them audit access, backend needs to support clinician access based on team permissions/facility policy. If audit logs are intentionally hospital-admin only, this is expected and the web client will show an access-denied state for clinicians.
