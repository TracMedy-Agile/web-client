import type {
  Assessment,
  AssessmentWorkspaceEntry,
  CareTeamMember,
  Clinician,
  ClinicianRole,
  EscalationStatus,
} from "@/app/dashboard/care-episodes/[id]/_shared/careTeamTypes";

const FAKE_DELAY_MS = 500;

function delay<T>(value: T, ms = FAKE_DELAY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const MOCK_DIRECTORY: Clinician[] = [
  { id: "clin-101", name: "Dr. Fatima Bello", role: "Doctor", specialty: "Cardiology", phone: "+234 803 555 0142", avatarUrl: "" },
  { id: "clin-102", name: "Dr. Marvelous Faith", role: "Doctor", specialty: "Neurology", phone: "+234 803 555 0142", avatarUrl: "" },
  { id: "clin-103", name: "Nurse Aisha Musa", role: "Nurse", specialty: "Cardiology", phone: "+234 803 555 0142", avatarUrl: "" },
  { id: "clin-104", name: "Dr. Uche Bello", role: "Doctor", specialty: "Pediatrics", phone: "+234 803 555 0142", avatarUrl: "" },
  { id: "clin-105", name: "Nurse Ngozi Okafor", role: "Nurse", specialty: "Cardiology", phone: "+234 803 555 0143", avatarUrl: "" },
  { id: "clin-106", name: "Dr. Chinedu Obi", role: "Doctor", specialty: "Internal Medicine", phone: "+234 803 555 0144", avatarUrl: "" },
  { id: "clin-107", name: "David Mensah", role: "Physiotherapist", specialty: "Rehabilitation", phone: "+234 803 555 0145", avatarUrl: "" },
];

let mockCareTeam: CareTeamMember[] = [
  { ...MOCK_DIRECTORY[0], roleOnTeam: "Attending Physician", dateAdded: "2026-04-24T09:00:00" },
  { ...MOCK_DIRECTORY[4], roleOnTeam: "Primary Nurse", dateAdded: "2026-04-24T09:00:00" },
];

const MOCK_ASSESSMENT_HISTORY: Assessment[] = [
  { id: "assess-1", episodeId: "", date: "2026-04-29T11:42:00", escalationStatus: "Delayed Recovery", outcome: "Escalated", clinicianNotes: "Patient meets all discharge criteria. Vitals stable within nominal range.", clinicianName: "Dr. Emeka Nwosu" },
  { id: "assess-2", episodeId: "", date: "2026-09-08T14:30:00", escalationStatus: "Stable", outcome: "No Escalation", clinicianNotes: "SpO2 drop detected overnight. Patient reporting mild chest discomfort.", clinicianName: "Dr. Fatima Bello" },
  { id: "assess-3", episodeId: "", date: "2026-02-01T23:27:00", escalationStatus: "Stable", outcome: "No Escalation", clinicianNotes: "Vitals showing positive trend. Mobility increased to 500m.", clinicianName: "Dr. Chinedu Obi" },
  { id: "assess-4", episodeId: "", date: "2026-10-17T17:14:00", escalationStatus: "Stable", outcome: "No Escalation", clinicianNotes: "Increased Furosemide to 80mg. Patient advised to reduce sodium urgently. Will reassess in 48h.", clinicianName: "Dr. Emeka Nwosu" },
  { id: "assess-5", episodeId: "", date: "2026-09-21T23:49:00", escalationStatus: "Improving", outcome: "Care Plan Adjustment", clinicianNotes: "Wound redness increasing — possible infection", clinicianName: "Dr. Chinedu Obi" },
];

export async function getCareTeam(episodeId: string): Promise<CareTeamMember[]> {
  // TODO: replace with real API call once staging endpoint is confirmed (e.g. GET /care-episodes/:id/care-team)
  void episodeId;
  return delay(mockCareTeam);
}

export async function addClinicianToTeam(episodeId: string, clinicianId: string): Promise<CareTeamMember> {
  // TODO: replace with real API call once staging endpoint is confirmed (e.g. POST /care-episodes/:id/care-team)
  void episodeId;
  const clinician = MOCK_DIRECTORY.find((item) => item.id === clinicianId);
  if (!clinician) throw new Error("Clinician not found.");
  if (mockCareTeam.some((member) => member.id === clinicianId)) throw new Error("Clinician is already on this care team.");

  const member: CareTeamMember = { ...clinician, roleOnTeam: clinician.role === "Nurse" ? "Care Nurse" : "Consulting Clinician", dateAdded: new Date().toISOString() };
  mockCareTeam = [...mockCareTeam, member];
  return delay(member);
}

export async function removeClinicianFromTeam(episodeId: string, clinicianId: string): Promise<{ id: string }> {
  // TODO: replace with real API call once staging endpoint is confirmed (e.g. DELETE /care-episodes/:id/care-team/:clinicianId)
  void episodeId;
  mockCareTeam = mockCareTeam.filter((member) => member.id !== clinicianId);
  return delay({ id: clinicianId });
}

export async function searchAvailableClinicians(query: string, roleFilter?: ClinicianRole | "all"): Promise<Clinician[]> {
  // TODO: replace with real API call once staging endpoint is confirmed (e.g. GET /clinicians/search)
  const normalizedQuery = query.trim().toLowerCase();
  const results = MOCK_DIRECTORY.filter((clinician) => !mockCareTeam.some((member) => member.id === clinician.id))
    .filter((clinician) => (roleFilter && roleFilter !== "all" ? clinician.role === roleFilter : true))
    .filter((clinician) =>
      normalizedQuery
        ? [clinician.name, clinician.specialty, clinician.role].some((field) => field.toLowerCase().includes(normalizedQuery))
        : true,
    );
  return delay(results);
}

export type AssessmentHistoryFilters = {
  dateFrom?: string;
  dateTo?: string;
  clinicianName?: string;
  outcome?: string;
};

export async function getAssessmentHistory(episodeId: string, filters?: AssessmentHistoryFilters): Promise<Assessment[]> {
  // TODO: replace with real API call once staging endpoint is confirmed (e.g. GET /care-episodes/:id/assessments)
  const results = MOCK_ASSESSMENT_HISTORY.map((assessment) => ({ ...assessment, episodeId })).filter((assessment) => {
    if (filters?.clinicianName && filters.clinicianName !== "all" && assessment.clinicianName !== filters.clinicianName) return false;
    if (filters?.outcome && filters.outcome !== "all" && assessment.outcome !== filters.outcome) return false;
    if (filters?.dateFrom && Date.parse(assessment.date) < Date.parse(filters.dateFrom)) return false;
    if (filters?.dateTo && Date.parse(assessment.date) > Date.parse(filters.dateTo)) return false;
    return true;
  });
  return delay(results);
}

export type SaveAssessmentPayload = {
  outcome: Assessment["outcome"];
  escalationStatus: Assessment["escalationStatus"];
  recommendedActions: string[];
  symptomStatus: string;
  treatmentResponse: string;
  keyObservation: string;
  clinicianNotes: string;
};

export async function saveAssessment(episodeId: string, payload: SaveAssessmentPayload): Promise<Assessment> {
  // TODO: replace with real API call once staging endpoint is confirmed (e.g. POST /care-episodes/:id/assessments)
  console.log("[mock] saveAssessment payload:", episodeId, payload);
  const assessment: Assessment = {
    id: `assess-mock-${Date.now()}`,
    episodeId,
    date: new Date().toISOString(),
    escalationStatus: payload.escalationStatus,
    outcome: payload.outcome,
    clinicianNotes: payload.clinicianNotes,
    clinicianName: "Dr. Emeka Nwosu",
  };
  MOCK_ASSESSMENT_HISTORY.unshift(assessment);
  return delay(assessment);
}

export async function getAssessmentWorkspace(episodeId: string): Promise<AssessmentWorkspaceEntry> {
  // TODO: replace with real API call once staging endpoint is confirmed (e.g. GET /care-episodes/:id/assessments/workspace)
  return delay({
    episodeId,
    assessmentNumber: MOCK_ASSESSMENT_HISTORY.length + 1,
    clinicalStatus: {
      title: "Clinical Status Intelligence",
      confidencePercent: 92,
      summary:
        "Patient demonstrates worsening respiratory symptoms with SpO₂ declining to 88% and recent weight gain of 1.8 kg over 48 hours. Clinical media and symptom logs suggest possible fluid retention requiring immediate review. Lab results show BNP elevation. No adverse medication reactions recorded.",
      sources: [
        { label: "Vitals", verified: true },
        { label: "Symptoms", verified: true },
        { label: "Patient Notes", verified: true },
        { label: "Clinical Media", verified: true },
        { label: "Lab Results", verified: true },
        { label: "Med Side Effects", verified: true },
      ],
    },
    carePlanAdherence: {
      title: "Care Plan Adherence Intelligence",
      confidencePercent: 96,
      summary: "Is the patient following the plan?",
      adherencePercent: 72,
      trendLabel: "Declining vs last period",
      trendDeltaPercent: -9,
      breakdown: [
        { label: "3 missed evening medications", positive: false },
        { label: "4 missed daily check-ins", positive: false },
        { label: "Exercise target at 80%", positive: true },
        { label: "Monitoring tasks at 85%", positive: true },
      ],
      sources: [
        { label: "Medication", verified: true },
        { label: "Daily Tasks", verified: true },
        { label: "Monitoring", verified: true },
        { label: "Check-ins", verified: true },
        { label: "Appointments", verified: true },
      ],
    },
    outcomeOptions: ["Improving", "Stable", "Delayed Recovery", "Deteriorating", "Resolved"],
    recommendedActions: ["Adjust Care Plan", "Schedule Follow-up", "Send Patient Instructions", "Escalate to Specialist"],
    findings: {
      symptomStatus: "Worsening",
      treatmentResponse: "Partial response",
      keyObservation: "SpO2 drop + weight gain — possible fluid over",
      clinicalNotes: "Increased Furosemide to 80mg. Patient advised to reduce sodium urgently. Will reassess in 48h.",
    },
  });
}

export type { EscalationStatus };
