import type { components } from "@/docs/types/api";

export type Medication = { id: string; name: string; dosage: string; frequency: string; duration: string; instructions: string };
export type CarePlanTask = { title: string; dueDate: string; status: string; type?: string; priority?: string; instructions?: string };
export type LabTest = { id: string; name: string; priority: "Urgent" | "Routine"; purpose: string; date: string };
export type MonitoringTrendRule = {
  id: string;
  condition: string;
  threshold: string;
  unit: string;
  window: string;
};
export type MonitoringItem = {
  id: string;
  type: "Vital Sign" | "Symptom" | "Activity";
  name: string;
  frequency: string;
  priority: string;
  cadence: string;
  criticalLow: string;
  criticalHigh: string;
  criticalUnit: string;
  severityThreshold: string;
  persistenceReports: string;
  minimumCompletion: string;
  missedSessions: string;
  worseningTrend: boolean;
  decliningPerformance: boolean;
  missingDataRule: string;
  trendRules: MonitoringTrendRule[];
};
export type HomeCareOrder = {
  id: string;
  serviceId: string;
  service: string;
  priority: string;
  frequency: string;
  startDate: string;
  duration: number;
  numberOfVisits: number;
  instructions: string;
  fulfillmentMethod: "hospital" | "network";
  clinicianId: string;
  isNew: boolean;
};
export type Recommendation = { id: string; title: string; summary: string; description: string };
export type WarningSign = { id: string; title: string; detail: string; response: string };
export type Clinician = { id: string; name: string; role: string };

type GeneratedCarePlan = components["schemas"]["CarePlanDto"];
type GeneratedCreateCarePlan = components["schemas"]["CreateCarePlanDto"];

// The generated schema currently describes these JSON-array fields as opaque
// objects/string arrays. These refinements mirror the backend DTO while keeping
// the API type as the source of every other field.
export type CarePlan = Omit<GeneratedCarePlan, "tasks" | "medications" | "lifestyleRecommendations"> & {
  tasks?: CarePlanTask[];
  medications?: Omit<Medication, "id">[];
  lifestyleRecommendations?: Array<string | { title: string; description: string }>;
};

export type CarePlanPayload = Omit<GeneratedCreateCarePlan, "tasks" | "medications"> & {
  tasks?: CarePlanTask[];
  medications?: Omit<Medication, "id">[];
};

export type CarePlanForm = {
  id: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  medications: Medication[];
  labTests: LabTest[];
  monitoring: MonitoringItem[];
  homeCare: HomeCareOrder[];
  lifestyle: Recommendation[];
  warningSigns: WarningSign[];
  patientNotification: boolean;
  monitoringFrequency: string;
  episodeDuration: number;
  startDate: string;
  changeReasons: string[];
  additionalReason: string;
};

export type AddTaskKind = "lab" | "monitoring" | "homeCare" | "lifestyle" | "warning";

