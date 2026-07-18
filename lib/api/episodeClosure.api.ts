import type { Assessment } from "@/app/dashboard/care-episodes/[id]/_shared/careTeamTypes";
import type { ClosedEpisodeRecord } from "@/app/dashboard/care-episodes/[id]/_shared/episodeClosureTypes";

const FAKE_DELAY_MS = 500;

function delay<T>(value: T, ms = FAKE_DELAY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const MOCK_ASSESSMENT_HISTORY: Assessment[] = [
  { id: "assess-1", episodeId: "", date: "2026-04-24T08:20:00", escalationStatus: "Escalated", outcome: "No Escalation", clinicianNotes: "Patient meets discharge criteria. Vitals stable.", clinicianName: "Dr. Emeka Nwosu" },
  { id: "assess-2", episodeId: "", date: "2026-04-24T16:02:00", escalationStatus: "Stable", outcome: "No Escalation", clinicianNotes: "Adherence improving, BP normalising.", clinicianName: "Dr. Fatima Bello" },
  { id: "assess-3", episodeId: "", date: "2026-04-23T06:42:00", escalationStatus: "Stable", outcome: "No Escalation", clinicianNotes: "Responding well to medication adjustment.", clinicianName: "Dr. Chinedu Obi" },
  { id: "assess-4", episodeId: "", date: "2026-04-22T01:09:00", escalationStatus: "Delayed Recovery", outcome: "No Escalation", clinicianNotes: "SpO2 drop + weight gain. Possible fluid overload.", clinicianName: "Dr. Emeka Nwosu" },
  { id: "assess-5", episodeId: "", date: "2026-04-22T23:49:00", escalationStatus: "Improving", outcome: "Care Plan Adjustment", clinicianNotes: "Vitals within range. Adherence adequate.", clinicianName: "Dr. Chinedu Obi" },
  { id: "assess-6", episodeId: "", date: "2026-04-21T04:15:00", escalationStatus: "Escalated", outcome: "Escalated", clinicianNotes: "Initial post-admission assessment. Care plan activated.", clinicianName: "Dr. Chinedu Obi" },
];

export async function getClosedEpisodeSummary(episodeId: string): Promise<ClosedEpisodeRecord> {
  // TODO: replace with real API call once staging endpoint is confirmed (e.g. GET /care-episodes/:id/closure-summary)
  return delay({
    episodeId,
    patient: {
      name: "Amara Okonkwo",
      patientCode: "#PT-8234",
      age: 28,
      gender: "Female",
      episodeCode: "CE-4612",
      diagnosisTag: "Post-Appendectomy",
      closedDate: "2026-04-24",
    },
    overview: {
      facility: "Anchor Health And Medical Clinic — Lagos",
      assignedClinician: "Dr. Adaeze Okafor",
      diagnosis: "Post-discharge recovery",
      openedDate: "2026-04-10",
      closedDate: "2026-04-24",
      totalDurationDays: 14,
      closureReason: "Recovery completed",
      outcome: "Recovered",
      carePhaseAtClosure: "Recovery",
    },
    closureRecord: {
      closedBy: "Dr. Adaeze Okafor",
      closedByRole: "Doctor",
      closureDateTime: "2026-04-24T16:48:00",
      closureReason: "Recovery completed",
      finalNotes: "Episode closed following clinician review. Patient meets discharge criteria with stable vitals and confirmed adherence.",
      auditRef: "AUD-4612-CLS",
    },
    aiClosureSummary: {
      statusBadge: "Recovery Completed",
      frozenAtLabel: "Frozen at closure · Apr 24, 2026",
      narrative:
        "Patient successfully completed a 14 day post-appendectomy monitoring episode. Recovery milestones were achieved within the expected timeframe. Medication adherence remained high at 94%, check-in completion reached 96%, and symptom burden steadily declined throughout the episode.\n\nOne elevated blood pressure alert and one missed medication event required intervention during the episode. Both were resolved following clinician review and care plan adjustment. No emergency escalations, specialist referrals, or readmissions occurred.",
      medicationAdherencePercent: 94,
      checkInCompletionPercent: 96,
      emergencyEscalations: 0,
      monitoringDays: { completed: 14, total: 14 },
    },
    intelligenceSummary: {
      riskTrend: { opening: 62, closing: 18, improvementPercent: 71 },
      alertSummary: { totalAlerts: 8, critical: 2, moderate: 4, low: 2, resolved: { count: 8, total: 8 } },
      clinicalActivity: { assessments: 6, carePlanAdjustments: 2, specialistEscalations: 0, emergencyEscalations: 0, interventionsLogged: 3 },
    },
    assessmentHistory: MOCK_ASSESSMENT_HISTORY.map((assessment) => ({ ...assessment, episodeId })),
    carePlanHistory: [
      {
        version: "CP-v1",
        title: "Initial Recovery Plan",
        status: "Superseded",
        date: "2026-04-10T09:14:00",
        author: "Dr. Adaeze Okafor",
        description: "Initial post-discharge monitoring plan. Daily vitals, medication schedule, and activity restrictions established.",
      },
      {
        version: "CP-v2",
        title: "Adjusted Medication Plan",
        status: "Updated",
        date: "2026-04-18T11:43:00",
        author: "Dr. Reyes",
        description: "Furosemide increased to 80mg following SpO2 decline. Daily weight monitoring added. Sodium restriction reinforced.",
      },
      {
        version: "CP-v3",
        title: "Closure Plan",
        status: "Completed",
        date: "2026-04-24T00:00:00",
        author: "Dr. Adaeze Okafor",
        description: "Tapered monitoring frequency, discharge education completed, outpatient follow-up scheduled for May 8, 2026.",
      },
    ],
    interventionsLog: [
      { id: "int-1", intervention: "Medication adjustment", description: "Furosemide increased to 80mg", date: "2026-04-16", clinicianName: "Dr. Reyes", linkedTrigger: "Risk signal — elevated BP trend" },
      { id: "int-2", intervention: "Care plan update", description: "Weight monitoring frequency increased", date: "2026-04-19", clinicianName: "Nurse Patel", linkedTrigger: "Milestone — 7-day check-in" },
      { id: "int-3", intervention: "Patient instruction sent", description: "Sodium restriction reminder", date: "2026-04-22", clinicianName: "Dr. Adaeze Okafor", linkedTrigger: "Alert — missed evening check-in" },
    ],
    careTimeline: [
      { id: "tl-1", title: "Critical SpO2 submitted: 88%", description: "Below threshold for >10 min", status: "Critical", type: "Alert", source: "System", date: "2026-04-24", time: "14:32" },
      { id: "tl-2", title: "Symptom check-in completed", description: "Mild fatigue, no chest pain", status: "Completed", type: "Check-in", source: "Patient App", date: "2026-04-24", time: "13:15" },
      { id: "tl-3", title: "Care plan updated by Dr. Okafor", description: "Increased Furosemide to 40mg BID", status: "Completed", type: "Clinician", source: "Clinician", date: "2026-04-24", time: "11:42" },
      { id: "tl-4", title: "Morning Lisinopril missed", description: "Patient did not confirm morning dose", status: "Missed", type: "Medication", source: "Patient App", date: "2026-04-24", time: "08:00" },
    ],
    closureArtifacts: {
      finalClinicalAssessment: { label: "Final Clinical Assessment", value: "Stable", detail: "Apr 24, 2026" },
      finalCarePlanVersion: { label: "Final Care Plan Version", value: "CP-v3", detail: "Closure Plan" },
      finalRecoveryStatus: { label: "Final Recovery Status", value: "On Track", detail: "Recovered" },
      finalRiskScore: { label: "Final Risk Score", value: "18", detail: "Low risk" },
      finalPatientInstructions: {
        label: "Final Patient Instructions",
        value: "Discharge education completed.",
        detail: "Outpatient follow-up scheduled May 8, 2026. Medication taper plan provided.",
      },
    },
  });
}
