import type { CarePlan, CarePlanPayload } from "../recovery/adjust-plan/types";
import type { CareTaskCategory } from "../_shared/careTeamTypes";

export type CareTask = {
  id: string;
  label: string;
  category: CareTaskCategory;
  frequency: string;
  instructions: string;
  dosage?: string;
  duration?: string;
  dueDate?: string;
  priority?: string;
};

const CATEGORY_TO_TASK_TYPE: Partial<Record<CareTaskCategory, string>> = {
  "Vital Check": "monitoring",
  "Lab Test": "laboratory",
  "Home Care": "home-care",
  "Warning Sign": "warning",
  "Symptom Log": "symptom-log",
  Activity: "activity",
  Other: "other",
};

const TASK_TYPE_TO_CATEGORY: Record<string, CareTaskCategory> = {
  monitoring: "Vital Check",
  lab: "Lab Test",
  laboratory: "Lab Test",
  diagnostic: "Lab Test",
  "home-care": "Home Care",
  home_care: "Home Care",
  homecare: "Home Care",
  warning: "Warning Sign",
  "warning-sign": "Warning Sign",
  "symptom-log": "Symptom Log",
  symptom: "Symptom Log",
  activity: "Activity",
};

function splitFrequency(instructions = "") {
  const [first, ...rest] = instructions.split(" | ");
  return rest.length ? { frequency: first, detail: rest.join(" | ") } : { frequency: "", detail: first };
}

export function carePlanToTasks(plan: CarePlan): CareTask[] {
  const medications: CareTask[] = (plan.medications ?? []).map((medication, index) => ({
    id: `med-${index}-${medication.name}`,
    label: medication.name,
    category: "Medication",
    frequency: medication.frequency,
    instructions: medication.instructions ?? "",
    dosage: medication.dosage,
    duration: medication.duration,
  }));

  const tasks: CareTask[] = (plan.tasks ?? []).map((task, index) => {
    const { frequency, detail } = splitFrequency(task.instructions);
    return {
      id: `task-${index}-${task.title}`,
      label: task.title,
      category: TASK_TYPE_TO_CATEGORY[(task.type ?? "").toLowerCase()] ?? "Other",
      frequency: frequency || "Daily",
      instructions: detail,
      dueDate: task.dueDate,
      priority: task.priority,
    };
  });

  return [...medications, ...tasks];
}

export function tasksToCarePlanPayload(tasks: CareTask[], base: CarePlan, changeReason: string): CarePlanPayload {
  const medications = tasks
    .filter((task) => task.category === "Medication")
    .map((task) => ({ name: task.label, dosage: task.dosage ?? "", frequency: task.frequency, duration: task.duration ?? "Ongoing", instructions: task.instructions }));

  const otherTasks = tasks
    .filter((task) => task.category !== "Medication")
    .map((task) => ({
      title: task.label,
      dueDate: task.dueDate ?? "",
      status: "active",
      type: CATEGORY_TO_TASK_TYPE[task.category] ?? "other",
      priority: task.priority ?? "Routine",
      instructions: [task.frequency, task.instructions].filter(Boolean).join(" | "),
    }));

  return {
    medications,
    tasks: otherTasks,
    lifestyleRecommendations: (base.lifestyleRecommendations ?? []).map((item) =>
      typeof item === "string" ? item : [item.title, item.description].filter(Boolean).join(": "),
    ),
    monitoringFrequency: base.monitoringFrequency,
    episodeDuration: base.episodeDuration,
    changeReason,
  };
}
