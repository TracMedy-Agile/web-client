# Backend Work Required for Built Hospital Screens

The published staging OpenAPI contract was re-audited on 2026-08-04. Endpoints that are now published have been connected in the web client and removed from the outstanding list below.

## Care Episodes

- Recovery-probability forecast, 7-day deterioration forecast, and 30-day relapse forecast.
- Production AI recovery summary and clinical decision-support suggestions.

## Report & Analytics

- Pre-aggregated KPI and comparison-period endpoint.
- Readmission-trend and average-recovery-time analytics.
- Risk-distribution and ward-performance analytics.
- Facility-level, role-scoped clinician workload and outcome analytics.
- Server-generated, facility-scoped PDF and Excel exports if server-side generation is required for compliance. CSV remains frontend-managed.

## Team Management

- Additional facility-scoped team directory fields not exposed by the connected clinician reads: account role, ward, assigned-patient count, account status, last login, access profile, invite state, invite date, and invited-by identity.
- Invite/create a team member with email delivery, role, specialty/ward, access profile, explicit permissions, and duplicate-invite handling.
- Edit team-member identity and assignment fields.
- Suspend and reactivate a team member with actor, reason, and timestamp.
- Remove a team member with a safe conflict response when active clinical assignments must first be reassigned.
- Read and update role/permission assignments for a team member.
- Read and update WhatsApp critical-alert escalation eligibility and configuration.
- Facility-scoped member activity feed covering invitations, authentication, permission changes, assignments, status changes, and deletion.

## Audit Log

- **Staging route blocker:** `GET /api/v1/facilities/audit-logs?page=1&limit=6` currently returns `404 FACILITY_NOT_FOUND` for an authenticated `hospital_admin`. The request is being intercepted by the generic `GET /api/v1/facilities/:id` route, which treats `audit-logs` as the facility ID, so it never reaches `AuditController`. Register the static Audit Log routes before the dynamic facility route (currently `FacilitiesModule` is registered before `AuditModule`) or restructure the routes to remove the collision, then redeploy. Verify the list returns `200` and the detail route still resolves only facility-scoped entries.
- Immutable recording for sensitive reads, mutations, exports, permission changes, and denied attempts.
- Continue enforcing hospital-admin access with facility scope derived from the authenticated session. CSV export is frontend-managed.
