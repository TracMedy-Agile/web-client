export type ClinicianRole = "Doctor" | "Nurse" | "Physiotherapist" | "Pharmacist" | "Nutritionist";

export type Clinician = {
  id: string;
  name: string;
  role: ClinicianRole;
  specialty: string;
  phone: string;
  avatarUrl: string;
};

export type CareTeamMember = Clinician & {
  roleOnTeam: string;
  dateAdded: string;
};

export type EscalationStatus = "Stable" | "Improving" | "Delayed Recovery" | "Escalated";

export type AssessmentOutcome =
  | "Improving"
  | "Stable"
  | "Delayed Recovery"
  | "Deteriorating"
  | "Resolved"
  | "No Escalation"
  | "Escalated"
  | "Care Plan Adjustment";

export type Assessment = {
  id: string;
  episodeId: string;
  date: string;
  escalationStatus: EscalationStatus;
  outcome: AssessmentOutcome;
  clinicianNotes: string;
  clinicianName: string;
};

export type CarePlanVersionStatus = "active" | "previous" | "initial";

export type CarePlanVersion = {
  version: number;
  status: CarePlanVersionStatus;
  description: string;
  date: string;
  author: string;
};

export type CareTaskCategory =
  | "Medication"
  | "Vital Check"
  | "Symptom Log"
  | "Activity"
  | "Lab Test"
  | "Home Care"
  | "Warning Sign"
  | "Other";

export type CareTask = {
  id: string;
  label: string;
  category: CareTaskCategory;
  frequency: string;
  instructions: string;
};

export type AssessmentSource = {
  label: string;
  verified: boolean;
};

export type AssessmentIntelligenceCard = {
  title: string;
  confidencePercent: number | null;
  summary: string;
  sources: AssessmentSource[];
};

export type CarePlanAdherenceBreakdownItem = {
  label: string;
  positive: boolean;
};

export type AssessmentWorkspaceEntry = {
  episodeId: string;
  assessmentNumber: number;
  clinicalStatus: AssessmentIntelligenceCard;
  carePlanAdherence: AssessmentIntelligenceCard & {
    adherencePercent: number | null;
    trendLabel: string;
    trendDeltaPercent: number | null;
    breakdown: CarePlanAdherenceBreakdownItem[];
  };
  outcomeOptions: AssessmentOutcome[];
  recommendedActions: string[];
  findings: {
    symptomStatus: string;
    treatmentResponse: string;
    keyObservation: string;
    clinicalNotes: string;
  };
};
