export type Medication = { id: string; name: string; dosage: string; frequency: string; duration: string; instructions: string };
export type CarePlanTask = { title: string; dueDate: string; status: string; type?: string; priority?: string; instructions?: string };
export type LabTest = { id: string; name: string; priority: "Urgent" | "Routine"; purpose: string; date: string };
export type MonitoringItem = { id: string; name: string; frequency: string; cadence: string };
export type HomeCareOrder = {
  id: string;
  service: string;
  priority: string;
  frequency: string;
  startDate: string;
  duration: number;
  numberOfWeeks: number;
  instructions: string;
  fulfillmentMethod: "hospital" | "network";
  clinicianId: string;
};
export type Recommendation = { id: string; title: string; summary: string; description: string };
export type WarningSign = { id: string; title: string; detail: string; response: string };
export type Clinician = { id: string; name: string; role: string };

export type CarePlan = {
  id: string;
  version: number;
  medications: { name: string; dosage: string; frequency: string; duration: string; instructions?: string }[];
  tasks: CarePlanTask[];
  lifestyleRecommendations: string[] | { title: string; description: string }[];
  monitoringFrequency: string;
  episodeDuration: string;
  changeReason: string;
  isActive: boolean;
  createdAt: string;
};

export type CarePlanPayload = Omit<CarePlan, "id" | "version" | "createdAt"> & { notifyPatient?: boolean };

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
