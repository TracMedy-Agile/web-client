# Phase 05 — Appointments Web Client Tasks

## Status: In Progress 🔄

## Pages Built
- [x] Appointments list (table view) → /dashboard/appointments
- [x] Appointments list (calendar daily) → /dashboard/appointments
- [x] Appointments list (calendar weekly) → /dashboard/appointments
- [x] Appointment detail → /dashboard/appointments/[id]
- [x] Virtual Consultations → /dashboard/appointments/virtual-consultations
- [x] Availability Management → /dashboard/appointments/availability

## Modals Built
- [x] Schedule Appointment Modal
- [x] Cancel Appointment Modal
- [x] Reschedule Appointment Modal
- [x] Assign Appointment Drawer
- [x] Add Clinician Schedule Modal
- [x] Add Schedule Override Modal
- [x] Clinician Profile Drawer

## API Endpoints Used
- GET /appointments — list with filters
- GET /appointments/calendar — day calendar view
- GET /appointments/pending-unassigned — unassigned queue
- GET /appointments/{id} — appointment detail
- POST /appointments — create appointment
- PATCH /appointments/{id}/confirm — confirm
- PATCH /appointments/{id}/reschedule — reschedule
- PATCH /appointments/{id}/cancel — cancel
- PATCH /appointments/{id}/no-show — no show
- PATCH /appointments/{id}/checkin — check in
- PATCH /appointments/{id}/assign — assign clinician
- GET /clinicians — list clinicians
- GET /clinicians/{id} — clinician profile
- POST /clinicians/{id}/schedule — create schedule
- POST /clinicians/{id}/override — schedule override
- GET /patients/search — search patients

## Known Issues / Blockers
- Calendar weekly view: no week endpoint, fetching 7 separate day requests
- Availability Management: waiting for pending-unassigned endpoint fixes

## Notes
- Export button generates CSV client-side
- Clinician assign requires force:true to override capacity
