export type EncounterType = "Outpatient" | "Inpatient" | "Emergency" | "Telehealth";

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
  encounterType: EncounterType;
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

export type PatientReviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episodeId: string | null;
  onActionComplete?: (result: { id: string; status: string }) => void;
};
