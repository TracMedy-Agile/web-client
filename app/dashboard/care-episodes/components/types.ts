export type EncounterType = "Outpatient" | "Inpatient" | "Emergency" | "Telehealth";

export type DischargeStatus = "Outpatient" | "Admitted" | "Discharged" | "Under Observation";

export type FollowUpTrigger = "Outpatient" | "Scheduled" | "As Needed" | "Urgent";

export type ConditionSeverity = "Mild" | "Moderate" | "Severe";

export type ClinicalConcern = "None" | "Mild" | "Moderate" | "High";

export type FollowUpDuration = "1 Week" | "2 Weeks" | "1 Month" | "2 Months" | "3 Months" | "6 Months";

export type CareEpisodeReason =
  | "Medication monitoring"
  | "Post-surgical recovery"
  | "Symptom monitoring"
  | "Chronic disease management";

export type AddPatientFormData = {
  patientName: string;
  phoneNumber: string;
  tracmedyPatientId: string;
  clinicianName: string;
  consultationDate: string;
  encounterType: EncounterType;
  dischargeStatus: DischargeStatus;
  followUpTrigger: FollowUpTrigger;
  diagnosis: string;
  clinicianNotes: string;
  conditionSeverity: ConditionSeverity;
  clinicalConcern: ClinicalConcern;
  followUpDuration: FollowUpDuration;
  reasons: CareEpisodeReason[];
};

export type AddPatientModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilityId: string;
  onCreated: () => void;
};

export type SeverityTrend = "Improving" | "Stable" | "Worsening";

export type PendingReviewStatus = "Pending Review" | "No Further Action" | "Open";

export type PendingReviewEpisode = {
  id: string;
  patientName: string;
  patientCode: string;
  diagnosis: string;
  primaryProvider: string;
  encounterType: string;
  consultationDate: string;
  dischargeStatus: string;
  followUpTrigger: string;
  severityTrend: SeverityTrend;
  clinicalConcern: ClinicalConcern;
  clinicianNotes: string;
  createdAt: string;
  createdBy: string;
  status: PendingReviewStatus;
};

export type PatientReviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episodeId: string | null;
  onActionComplete?: (result: { id: string; status: PendingReviewStatus }) => void;
};
