# Phase 06 — Connected Patients Web Client Tasks

## Status: In Progress 🔄

## Pages Built
- [x] Connected Patients list → /dashboard/connected-patients
- [x] Patient Profile → /dashboard/connected-patients/[id]

## API Endpoints Used
- GET /facilities/{id}/patients — list connected patients
- GET /care-episodes — patient care episodes
- GET /appointments — patient appointments

## Known Issues / Blockers
- No GET /patients/{id} endpoint — using facility patients list
- No connection history endpoint
- Patient profile shows N/A for DOB, gender, blood group (no API)

## Notes
- Patients connect via mobile app
- facilityId from GET /auth/hospital → data.facility.id
