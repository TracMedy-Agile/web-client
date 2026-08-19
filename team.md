# Team Management Backend Authorization Issue

Hi, please check the Team Management authorization.

The web-client allows hospitals to grant clinicians Team Management access through team permissions, but the backend currently marks Team Management endpoints as `hospital_admin only`.

## Affected endpoints

- `GET /api/v1/team/members`
- `POST /api/v1/team/members`
- `PATCH /api/v1/team/members/{id}`
- `DELETE /api/v1/team/members/{id}`
- `POST /api/v1/team/members/{id}/suspend`
- `POST /api/v1/team/members/{id}/reactivate`
- `POST /api/v1/team/members/{id}/resend-invite`
- `GET /api/v1/team/members/{id}/activity`
- `GET /api/v1/team/members/{id}/escalation-preference`
- `POST /api/v1/team/members/{id}/escalation-preference`

## Expected behavior

Clinicians should be allowed to use these endpoints when the hospital/admin grants them the required Team Management permission.

## Current behavior

Clinicians get `403 Forbidden`, so Team Management does not load for clinician accounts.
