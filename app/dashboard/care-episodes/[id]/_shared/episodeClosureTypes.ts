import type { Assessment } from "./careTeamTypes";

export type ClosureReason =
  | "Recovery completed"
  | "Transferred"
  | "Patient discontinued"
  | "Lost to follow-up"
  | "Deceased"
  | "Administrative closure";

export type EpisodeClosureSummary = {
  checkInCompletion: { completed: number; total: number };
  goalAchievementPercent: number;
  missedTasksCount: number;
  closureReason: ClosureReason | "";
  finalClinicalSummary: string;
};

export type ClosedPatientInfo = {
  name: string;
  patientCode: string;
  age: number;
  gender: string;
  episodeCode: string;
  diagnosisTag: string;
  closedDate: string;
};

export type ClosedEpisodeOverview = {
  facility: string;
  assignedClinician: string;
  diagnosis: string;
  openedDate: string;
  closedDate: string;
  totalDurationDays: number;
  closureReason: ClosureReason;
  outcome: string;
  carePhaseAtClosure: string;
};

export type ClosureRecord = {
  closedBy: string;
  closedByRole: string;
  closureDateTime: string;
  closureReason: ClosureReason;
  finalNotes: string;
  auditRef: string;
};

export type AIClosureSummary = {
  statusBadge: string;
  frozenAtLabel: string;
  narrative: string;
  medicationAdherencePercent: number;
  checkInCompletionPercent: number;
  emergencyEscalations: number;
  monitoringDays: { completed: number; total: number };
};

export type RiskTrendSummary = {
  opening: number;
  closing: number;
  improvementPercent: number;
};

export type AlertSummary = {
  totalAlerts: number;
  critical: number;
  moderate: number;
  low: number;
  resolved: { count: number; total: number };
};

export type ClinicalActivitySummary = {
  assessments: number;
  carePlanAdjustments: number;
  specialistEscalations: number;
  emergencyEscalations: number;
  interventionsLogged: number;
};

export type EpisodeIntelligenceSummary = {
  riskTrend: RiskTrendSummary;
  alertSummary: AlertSummary;
  clinicalActivity: ClinicalActivitySummary;
};

export type ClosureCarePlanVersionStatus = "Superseded" | "Updated" | "Completed";

export type ClosureCarePlanVersion = {
  version: string;
  title: string;
  status: ClosureCarePlanVersionStatus;
  date: string;
  author: string;
  description: string;
};

export type InterventionLogEntry = {
  id: string;
  intervention: string;
  description: string;
  date: string;
  clinicianName: string;
  linkedTrigger: string;
};

export type TimelineEventType = "Alert" | "Check-in" | "Clinician" | "Medication" | "System";

export type TimelineEventStatus = "Critical" | "Completed" | "Missed" | "Pending";

export type TimelineSource = "System" | "Patient App" | "Clinician";

export type CareTimelineEvent = {
  id: string;
  title: string;
  description: string;
  status: TimelineEventStatus;
  type: TimelineEventType;
  source: TimelineSource;
  date: string;
  time: string;
};

export type ClosureArtifact = {
  label: string;
  value: string;
  detail: string;
};

export type ClosureArtifacts = {
  finalClinicalAssessment: ClosureArtifact;
  finalCarePlanVersion: ClosureArtifact;
  finalRecoveryStatus: ClosureArtifact;
  finalRiskScore: ClosureArtifact;
  finalPatientInstructions: ClosureArtifact;
};

export type ClosedEpisodeRecord = {
  episodeId: string;
  patient: ClosedPatientInfo;
  overview: ClosedEpisodeOverview;
  closureRecord: ClosureRecord;
  aiClosureSummary: AIClosureSummary;
  intelligenceSummary: EpisodeIntelligenceSummary;
  assessmentHistory: Assessment[];
  carePlanHistory: ClosureCarePlanVersion[];
  interventionsLog: InterventionLogEntry[];
  careTimeline: CareTimelineEvent[];
  closureArtifacts: ClosureArtifacts;
};
