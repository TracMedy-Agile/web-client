import type { PendingReviewEpisode, PendingReviewStatus } from "@/app/dashboard/care-episodes/components/types";

const FAKE_DELAY_MS = 500;

function delay<T>(value: T, ms = FAKE_DELAY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export type CreateCareEpisodePayload = {
  patientId: string;
  facilityId: string;
  patientName: string;
  phoneNumber: string;
  clinicianName: string;
  consultationDate: string;
  encounterType: string;
  dischargeStatus: string;
  followUpTrigger: string;
  diagnosis: string;
  clinicianNotes: string;
  conditionSeverity: string;
  clinicalConcern: string;
  followUpDuration: string;
  reasons: string[];
};

export const MOCK_PENDING_EPISODES: PendingReviewEpisode[] = [
  {
    id: "ep-mock-1001",
    patientName: "Amara Okonkwo",
    patientCode: "#PT-8234",
    diagnosis: "Post-Appendectomy",
    primaryProvider: "Dr. Sarah Jenkins",
    encounterType: "Out-Patient",
    consultationDate: "2023-10-23T10:30:00",
    dischargeStatus: "Requires Follow-up",
    followUpTrigger: "Chronic disease management",
    severityTrend: "Improving",
    clinicalConcern: "Moderate",
    clinicianNotes:
      "Patient reports mild localized discomfort at incision site. Ambulatory status significantly improved since initial discharge. Vital signs remain stable with normal temperature range. Recommended continued monitoring of fluid intake and light physical activity. No signs of infection noted at this stage. Plan to review progress in 48 hours.",
    createdAt: "2023-10-24T09:12:00",
    createdBy: "Dr. Sarah Jenkins",
    status: "Pending Review",
  },
  {
    id: "ep-mock-1002",
    patientName: "Tunde Bakare",
    patientCode: "#PT-6610",
    diagnosis: "Hypertension Crisis",
    primaryProvider: "Dr. Amina Yusuf",
    encounterType: "Emergency",
    consultationDate: "2023-11-02T14:05:00",
    dischargeStatus: "Admitted",
    followUpTrigger: "Urgent",
    severityTrend: "Worsening",
    clinicalConcern: "High",
    clinicianNotes:
      "Blood pressure remains elevated despite adjusted medication dosage. Patient reports intermittent headaches and blurred vision. Recommend escalation to cardiology and daily check-ins until readings stabilize.",
    createdAt: "2023-11-02T16:40:00",
    createdBy: "Dr. Amina Yusuf",
    status: "Pending Review",
  },
  {
    id: "ep-mock-1003",
    patientName: "Ngozi Eze",
    patientCode: "#PT-3391",
    diagnosis: "Diabetic Foot Ulcer",
    primaryProvider: "Dr. Chike Obi",
    encounterType: "Outpatient",
    consultationDate: "2023-09-18T11:15:00",
    dischargeStatus: "Outpatient",
    followUpTrigger: "Scheduled",
    severityTrend: "Stable",
    clinicalConcern: "Mild",
    clinicianNotes:
      "Wound is healing as expected with no signs of new infection. Blood glucose readings within target range for the past week. Continue current dressing regimen and follow up in two weeks.",
    createdAt: "2023-09-18T13:02:00",
    createdBy: "Dr. Chike Obi",
    status: "Pending Review",
  },
];

export async function createCareEpisode(payload: CreateCareEpisodePayload): Promise<{ id: string }> {
  // TODO: replace with real API call once staging endpoint is confirmed (e.g. POST /care-episodes/pending)
  console.log("[mock] createCareEpisode payload:", payload);
  return delay({ id: `ep-mock-${Date.now()}` });
}

export async function getEpisodeById(id: string): Promise<PendingReviewEpisode> {
  // TODO: replace with real API call once staging endpoint is confirmed (e.g. GET /care-episodes/:id)
  const match = MOCK_PENDING_EPISODES.find((episode) => episode.id === id);
  if (match) return delay(match);

  const fallback = MOCK_PENDING_EPISODES[hashString(id) % MOCK_PENDING_EPISODES.length];
  return delay({ ...fallback, id });
}

export async function markNoFurtherAction(id: string): Promise<{ id: string; status: PendingReviewStatus }> {
  // TODO: replace with real API call once staging endpoint is confirmed (e.g. PATCH /care-episodes/:id/no-further-action)
  console.log("[mock] markNoFurtherAction:", id);
  return delay({ id, status: "No Further Action" });
}

export async function openCareEpisode(id: string): Promise<{ id: string; status: PendingReviewStatus }> {
  // TODO: replace with real API call once staging endpoint is confirmed (e.g. PATCH /care-episodes/:id/open)
  console.log("[mock] openCareEpisode:", id);
  return delay({ id, status: "Open" });
}
