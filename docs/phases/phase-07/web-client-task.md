# Phase 07 — Care Episodes Web Client Tasks

## Status: In Progress 🔄

## Pages Built
- [x] Care Episodes list → /dashboard/care-episodes
- [x] Episode Detail → /dashboard/care-episodes/[id]
- [x] Patient Insights → /dashboard/care-episodes/[id]/insights
- [x] Care Timeline → /dashboard/care-episodes/[id]/timeline
- [x] Recovery & Outcomes → /dashboard/care-episodes/[id]/recovery
- [x] Care Plan → /dashboard/care-episodes/[id]/care-plan
- [x] Care Team → /dashboard/care-episodes/[id]/care-team
- [x] Assessment → /dashboard/care-episodes/[id]/assessment

## API Endpoints Used
- GET /care-episodes — list with filters
- GET /care-episodes/{id} — full episode detail
- GET /care-episodes/{id}/timeline — paginated timeline
- GET /care-episodes/{id}/medications/adherence — medication adherence
- POST /care-episodes/{id}/upload-image — upload clinical image
- PATCH /care-episodes/{id}/close — close episode
- POST /care-episodes/pending — add to pending queue

## Known Issues / Blockers
- No GET /care-episodes/{id}/team endpoint
- No GET /care-episodes/{id}/media endpoint
- No GET /care-episodes/{id}/biometrics endpoint
- No alert acknowledgment endpoint
- Symptom tracking has no severity/trend data in API

## Notes
- AI sections are all STATIC (no API)
- Recovery chart uses mock data
- Clinical media shows images from latestCheckIn.images only
