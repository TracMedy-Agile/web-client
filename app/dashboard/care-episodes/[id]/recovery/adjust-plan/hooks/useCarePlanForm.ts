"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getCareEpisodeById } from "@/lib/api/care-episodes";
import { createCarePlanVersion, getCarePlan, updateCarePlan } from "@/lib/api/care-plan";
import { getAvailableClinicians } from "@/lib/api/clinicians";
import { createHomeCareRequest, getHomeCareServices, type HomeCareService } from "@/lib/api/home-care";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import type {
  CarePlan,
  CarePlanForm,
  CarePlanMonitoringRule,
  CarePlanPayload,
  Clinician,
  HomeCareOrder,
  LabTest,
  MonitoringItem,
  Recommendation,
  WarningSign,
} from "../types";

const isoToday = new Date().toISOString().slice(0, 10);
const rowId = (prefix: string, index: number) => `${prefix}-${index + 1}`;

function emptyForm(startDate = isoToday, episodeDuration = 1): CarePlanForm {
  return {
    id: "",
    version: 1,
    isActive: true,
    createdAt: "",
    medications: [],
    labTests: [],
    monitoring: [],
    homeCare: [],
    lifestyle: [],
    warningSigns: [],
    patientNotification: false,
    monitoringFrequency: "",
    episodeDuration: Math.max(episodeDuration, 1),
    startDate,
    changeReasons: [],
    additionalReason: "",
  };
}

function splitInstructions(instructions = "") {
  const [first, ...rest] = instructions.split(" | ");
  return { first, rest: rest.join(" | ") };
}

const HOME_CARE_DETAILS_PREFIX = "Home care details:";
const MONITORING_DETAILS_PREFIX = "Monitoring criteria:";

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function monitoringUnit(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("pressure")) return "mmHg";
  if (normalized.includes("temperature")) return "Celsius";
  if (normalized.includes("sugar") || normalized.includes("glucose")) return "mg/dL";
  if (normalized.includes("weight")) return "kg";
  if (normalized.includes("oxygen")) return "%";
  if (normalized.includes("heart")) return "bpm";
  return "";
}
function monitoringDefaults(name: string): Omit<MonitoringItem, "id" | "name" | "frequency" | "cadence"> {
  const normalized = name.toLowerCase();
  const type: MonitoringItem["type"] = normalized.includes("walk") || normalized.includes("exercise") || normalized.includes("activity")
    ? "Activity"
    : normalized.includes("pressure") || normalized.includes("heart") || normalized.includes("temperature") || normalized.includes("weight") || normalized.includes("sugar") || normalized.includes("oxygen")
      ? "Vital Sign"
      : "Symptom";
  return {
    type,
    priority: "High Priority",
    criticalLow: "",
    criticalHigh: "",
    criticalUnit: monitoringUnit(name),
    severityThreshold: "Moderate",
    persistenceReports: "",
    minimumCompletion: "",
    missedSessions: "",
    worseningTrend: true,
    decliningPerformance: false,
    missingDataRule: "Alert after 24 hours",
    trendRules: [],
  };
}

function parseMonitoringInstructions(name: string, instructions = "") {
  const lines = instructions.split("\n");
  const primary = splitInstructions(lines.find((line) => !line.startsWith(MONITORING_DETAILS_PREFIX)) ?? "");
  const defaults = monitoringDefaults(name);
  const metadataLine = lines.find((line) => line.startsWith(MONITORING_DETAILS_PREFIX));
  if (!metadataLine) return { ...defaults, frequency: primary.first, cadence: primary.rest };
  try {
    const metadata = recordValue(JSON.parse(metadataLine.slice(MONITORING_DETAILS_PREFIX.length).trim()));
    if (!metadata) return { ...defaults, frequency: primary.first, cadence: primary.rest };
    return {
      ...defaults,
      ...metadata,
      type: metadata.type === "Vital Sign" || metadata.type === "Symptom" || metadata.type === "Activity" ? metadata.type : defaults.type,
      priority: typeof metadata.priority === "string" ? metadata.priority : defaults.priority,
      frequency: primary.first,
      cadence: primary.rest,
      trendRules: Array.isArray(metadata.trendRules) ? metadata.trendRules.filter((rule) => recordValue(rule)).map((rule, index) => {
        const value = recordValue(rule) ?? {};
        return {
          id: typeof value.id === "string" ? value.id : rowId("rule", index),
          condition: typeof value.condition === "string" ? value.condition : "Rapid Increase",
          threshold: typeof value.threshold === "string" ? value.threshold : "",
          unit: typeof value.unit === "string" ? value.unit : "mmHg",
          window: typeof value.window === "string" ? value.window : "24 hours",
        };
      }) : [],
    } as Omit<MonitoringItem, "id" | "name">;
  } catch {
    return { ...defaults, frequency: primary.first, cadence: primary.rest };
  }
}

function serializeMonitoringInstructions(item: MonitoringItem) {
  const metadata = {
    type: item.type,
    priority: item.priority,
    criticalLow: item.criticalLow,
    criticalHigh: item.criticalHigh,
    criticalUnit: item.criticalUnit,
    severityThreshold: item.severityThreshold,
    persistenceReports: item.persistenceReports,
    minimumCompletion: item.minimumCompletion,
    missedSessions: item.missedSessions,
    worseningTrend: item.worseningTrend,
    decliningPerformance: item.decliningPerformance,
    missingDataRule: item.missingDataRule,
    trendRules: item.trendRules,
  };
  return [
    [item.frequency, item.cadence].filter(Boolean).join(" | "),
    `${MONITORING_DETAILS_PREFIX} ${JSON.stringify(metadata)}`,
  ].filter(Boolean).join("\n");
}

const VITAL_METRICS: Record<string, string> = {
  "blood pressure": "bp_systolic",
  "heart rate": "heart_rate",
  temperature: "temperature",
  "blood sugar": "glucose",
  weight: "weight",
  "oxygen saturation": "spo2",
};

function metricKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseNumber(value: string) {
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumberAt(value: string, index: number) {
  const matches = value.match(/-?\d+(?:\.\d+)?/g) ?? [];
  const parsed = Number(matches[index]);
  return Number.isFinite(parsed) ? parsed : null;
}

function prioritySeverity(priority: string): string {
  const normalized = priority.toLowerCase();
  if (normalized.includes("urgent")) return "critical";
  if (normalized.includes("high")) return "high";
  return "moderate";
}

function symptomSeverityThreshold(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("severe")) return { max: 7, severity: "critical" };
  if (normalized.includes("moderate")) return { max: 4, severity: "high" };
  return { max: 2, severity: "moderate" };
}

function warningForItem(item: MonitoringItem, warningSigns: WarningSign[]) {
  const normalizedName = item.name.trim().toLowerCase();
  return warningSigns.find((warning) => {
    const title = warning.title.trim().toLowerCase();
    const detail = warning.detail.trim().toLowerCase();
    return (title ? title.includes(normalizedName) || normalizedName.includes(title) : false) || (detail ? detail.includes(normalizedName) : false);
  });
}

function warningMessage(item: MonitoringItem, warningSigns: WarningSign[]) {
  const warning = warningForItem(item, warningSigns);
  return warning?.title.trim() || `${item.name} outside target range`;
}

function responseInstruction(item: MonitoringItem, warningSigns: WarningSign[]) {
  const warning = warningForItem(item, warningSigns);
  const response = [warning?.detail, warning?.response].filter(Boolean).join(" ").trim();
  return response || item.missingDataRule || null;
}

function monitoringRule(
  item: MonitoringItem,
  metric: string,
  min: number | null,
  max: number | null,
  warningSigns: WarningSign[],
  suffix: string,
): CarePlanMonitoringRule | null {
  if (min === null && max === null) return null;
  return {
    id: `${item.id}-${suffix}`,
    type: item.type === "Vital Sign" ? "vital" : item.type.toLowerCase(),
    metric,
    min,
    max,
    severity: prioritySeverity(item.priority),
    warningMessage: warningMessage(item, warningSigns),
    responseInstruction: responseInstruction(item, warningSigns),
    frequency: item.frequency,
    cadence: item.cadence,
    taskId: item.id,
  };
}

function buildMonitoringRules(items: MonitoringItem[], warningSigns: WarningSign[]): CarePlanMonitoringRule[] {
  return items.flatMap((item) => {
    if (item.type === "Vital Sign") {
      if (item.name === "Blood Pressure") {
        return [
          monitoringRule(item, "bp_systolic", parseNumberAt(item.criticalLow, 0), parseNumberAt(item.criticalHigh, 0), warningSigns, "bp-systolic"),
          monitoringRule(item, "bp_diastolic", parseNumberAt(item.criticalLow, 1), parseNumberAt(item.criticalHigh, 1), warningSigns, "bp-diastolic"),
        ].filter((rule): rule is CarePlanMonitoringRule => rule !== null);
      }

      const metric = VITAL_METRICS[item.name] ?? metricKey(item.name);
      return [monitoringRule(item, metric, parseNumber(item.criticalLow), parseNumber(item.criticalHigh), warningSigns, metric)]
        .filter((rule): rule is CarePlanMonitoringRule => rule !== null);
    }

    if (item.type === "Symptom") {
      const threshold = symptomSeverityThreshold(item.severityThreshold);
      return [{
        id: `${item.id}-symptom-severity`,
        type: "symptom",
        metric: metricKey(item.name),
        min: null,
        max: threshold.max,
        severity: threshold.severity,
        warningMessage: warningMessage(item, warningSigns),
        responseInstruction: responseInstruction(item, warningSigns),
        frequency: item.frequency,
        cadence: item.persistenceReports ? `${item.persistenceReports} consecutive reports` : item.cadence,
        taskId: item.id,
      }];
    }

    return [monitoringRule(item, metricKey(item.name), parseNumber(item.minimumCompletion), null, warningSigns, "task-completion")]
      .filter((rule): rule is CarePlanMonitoringRule => rule !== null);
  });
}

function parseHomeCareInstructions(value = "") {
  const lines = value.split("\n");
  const detailsLine = lines.find((line) => line.startsWith(HOME_CARE_DETAILS_PREFIX));
  const details = new Map<string, string>();
  if (detailsLine) {
    for (const entry of detailsLine.slice(HOME_CARE_DETAILS_PREFIX.length).split(";")) {
      const [key, ...rest] = entry.trim().split("=");
      if (key && rest.length > 0) details.set(key, rest.join("=").trim());
    }
  }
  const number = (key: string, fallback: number) => {
    const parsed = Number(details.get(key));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    instructions: lines.filter((line) => !line.startsWith(HOME_CARE_DETAILS_PREFIX)).join("\n").trim(),
    frequency: details.get("frequency") || "Daily",
    duration: number("durationDays", 14),
    numberOfVisits: number("visits", 1),
    fulfillmentMethod: details.get("fulfillment") === "network" ? "network" as const : "hospital" as const,
    clinicianId: details.get("clinicianId") || "",
  };
}

function serializeHomeCareInstructions(order: HomeCareOrder) {
  const details = [
    `frequency=${order.frequency}`,
    `durationDays=${order.duration}`,
    `visits=${order.numberOfVisits}`,
    `fulfillment=${order.fulfillmentMethod}`,
    ...(order.clinicianId ? [`clinicianId=${order.clinicianId}`] : []),
  ].join("; ");
  return [order.instructions.trim(), `${HOME_CARE_DETAILS_PREFIX} ${details}`].filter(Boolean).join("\n");
}

function normalizeCarePlan(plan: CarePlan, startDate: string, expectedDurationDays: number): CarePlanForm {
  const labTests: LabTest[] = [];
  const monitoring: MonitoringItem[] = [];
  const homeCare: HomeCareOrder[] = [];
  const warningSigns: WarningSign[] = [];

  for (const [index, task] of (plan.tasks ?? []).entries()) {
    const type = task.type?.toLowerCase() ?? "";
    if (["lab", "laboratory", "diagnostic"].includes(type)) {
      labTests.push({
        id: rowId("lab", index),
        name: task.title,
        priority: task.priority?.toLowerCase() === "urgent" ? "Urgent" : "Routine",
        purpose: task.instructions ?? "",
        date: task.dueDate?.slice(0, 10) ?? "",
      });
    } else if (["home-care", "home_care", "homecare"].includes(type)) {
      const details = parseHomeCareInstructions(task.instructions);
      homeCare.push({
        id: rowId("home", index),
        serviceId: "",
        service: task.title,
        priority: task.priority || "Routine",
        frequency: details.frequency || plan.monitoringFrequency || "Daily",
        startDate: task.dueDate?.slice(0, 10) ?? "",
        duration: details.duration,
        numberOfVisits: details.numberOfVisits,
        instructions: details.instructions,
        fulfillmentMethod: details.fulfillmentMethod,
        clinicianId: details.clinicianId,
        isNew: false,
      });
    } else if (["warning", "warning-sign", "warning_sign"].includes(type)) {
      const parsed = splitInstructions(task.instructions);
      warningSigns.push({
        id: rowId("warn", index),
        title: task.title,
        detail: parsed.first,
        response: parsed.rest,
      });
    } else {
      const parsed = parseMonitoringInstructions(task.title, task.instructions);
      monitoring.push({
        id: rowId("monitoring", index),
        name: task.title,
        ...parsed,
        frequency: parsed.frequency || plan.monitoringFrequency || "",
      });
    }
  }

  const lifestyle: Recommendation[] = (plan.lifestyleRecommendations ?? []).map((item, index) =>
    typeof item === "string"
      ? { id: rowId("lifestyle", index), title: "Lifestyle", summary: "", description: item }
      : { id: rowId("lifestyle", index), title: item.title, summary: "", description: item.description },
  );
  const parsedDuration = Number.parseInt(plan.episodeDuration ?? "", 10);

  return {
    ...emptyForm(startDate, Number.isFinite(parsedDuration) ? parsedDuration : expectedDurationDays),
    id: plan.id,
    version: plan.version || 1,
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    medications: (plan.medications ?? []).map((medication, index) => ({
      id: rowId("medication", index),
      ...medication,
      instructions: medication.instructions ?? "",
    })),
    labTests,
    monitoring,
    homeCare,
    lifestyle,
    warningSigns,
    monitoringFrequency: plan.monitoringFrequency ?? "",
  };
}

function toPayload(form: CarePlanForm, reason: string): CarePlanPayload {
  return {
    medications: form.medications.map((medication) => ({
      name: medication.name,
      dosage: medication.dosage,
      frequency: medication.frequency,
      duration: medication.duration,
      instructions: medication.instructions,
    })),
    tasks: [
      ...form.labTests.map((test) => ({ title: test.name, dueDate: test.date, status: "pending", type: "laboratory", priority: test.priority, instructions: test.purpose })),
      ...form.monitoring.map((item) => ({ title: item.name, dueDate: "", status: "active", type: "monitoring", priority: item.priority, instructions: serializeMonitoringInstructions(item) })),
      ...form.homeCare.map((order) => ({ title: order.service, dueDate: order.startDate, status: "pending", type: "home-care", priority: order.priority, instructions: serializeHomeCareInstructions(order) })),
      ...form.warningSigns.map((warning) => ({ title: warning.title, dueDate: "", status: "active", type: "warning", priority: "Urgent", instructions: [warning.detail, warning.response].filter(Boolean).join(" | ") })),
    ],
    lifestyleRecommendations: form.lifestyle.map((item) => [item.title, item.description].filter(Boolean).join(": ")),
    monitoringRules: buildMonitoringRules(form.monitoring, form.warningSigns),
    monitoringFrequency: form.monitoringFrequency,
    episodeDuration: String(form.episodeDuration),
    changeReason: reason,
  };
}

function attachHomeCareServices(form: CarePlanForm, services: HomeCareService[]): CarePlanForm {
  return {
    ...form,
    homeCare: form.homeCare.map((order) => {
      const normalizedName = order.service.trim().toLowerCase();
      const service = services.find((item) => item.name.trim().toLowerCase() === normalizedName);
      return service ? { ...order, serviceId: service.id, service: service.name } : order;
    }),
  };
}

function homeCareRequestNotes(order: HomeCareOrder) {
  return [
    order.instructions.trim(),
    `Priority: ${order.priority}`,
    `Frequency: ${order.frequency}`,
    `Duration: ${order.duration} days`,
    `Visits: ${order.numberOfVisits}`,
    `Fulfillment: ${order.fulfillmentMethod}`,
    order.clinicianId ? `Requested clinician: ${order.clinicianId}` : "",
  ].filter(Boolean).join("\n");
}

export function useCarePlanForm(episodeId: string) {
  const [form, setForm] = useState<CarePlanForm>(() => emptyForm());
  const [versions, setVersions] = useState<CarePlan[]>([]);
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [services, setServices] = useState<HomeCareService[]>([]);
  const [patient, setPatient] = useState({ name: "Patient", id: "--", patientId: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saveMode, setSaveMode] = useState<"patch" | "post" | null>(null);
  const [initialForm, setInitialForm] = useState(() => JSON.stringify(emptyForm()));

  useEffect(() => {
    if (!episodeId) return;
    let active = true;
    Promise.allSettled([
      getCarePlan(episodeId),
      getAvailableClinicians(),
      getCareEpisodeById(episodeId),
      getHomeCareServices(),
    ]).then(([plan, staff, episode, homeCareServices]) => {
      if (!active) return;
      const episodeValue = episode.status === "fulfilled" ? episode.value : null;
      const serviceDirectory = homeCareServices.status === "fulfilled" ? homeCareServices.value : [];
      const startDate = episodeValue?.createdAt?.slice(0, 10) || isoToday;
      const duration = episodeValue?.expectedDurationDays ?? 1;

      if (episodeValue) {
        setPatient({
          name: episodeValue.patient?.name || "Patient",
          id: episodeValue.patient?.hospitalId || episodeValue.patientId || "--",
          patientId: episodeValue.patientId,
        });
      }
      if (staff.status === "fulfilled") setClinicians(staff.value);
      setServices(serviceDirectory);

      if (plan.status === "fulfilled") {
        const next = attachHomeCareServices(normalizeCarePlan(plan.value, startDate, duration), serviceDirectory);
        setVersions(plan.value.versions);
        setForm(next);
        setInitialForm(JSON.stringify(next));
      } else {
        const next = emptyForm(startDate, duration);
        setForm(next);
        setInitialForm(JSON.stringify(next));
        setError(plan.reason instanceof Error ? plan.reason.message : "Unable to load the active care plan.");
      }
      setIsLoading(false);
    });

    return () => { active = false; };
  }, [episodeId]);

  const isDirty = useMemo(() => JSON.stringify(form) !== initialForm, [form, initialForm]);

  useEffect(() => {
    if (!isDirty) return;
    const onLinkClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

      event.preventDefault();
      event.stopPropagation();
      toast.warning("Unsaved care plan changes", {
        id: "discard-adjust-care-plan-link",
        description: "Your edits have not been saved.",
        duration: 8000,
        action: {
          label: "Discard and leave",
          onClick: () => window.location.assign(link.href),
        },
      });
    };
    document.addEventListener("click", onLinkClick, true);
    return () => document.removeEventListener("click", onLinkClick, true);
  }, [isDirty]);

  const save = useCallback(async (mode: "patch" | "post", modalReason: string) => {
    const selected = [...form.changeReasons, form.additionalReason.trim()].filter(Boolean).join("; ");
    const reason = [selected, modalReason.trim()].filter(Boolean).join(" - ");
    if (!reason) throw new Error("Change reason is required.");
    setSaveMode(mode);
    try {
      let formToSave = form;
      const newHomeCareOrders = form.homeCare.filter((order) => order.isNew && order.serviceId);
      if (newHomeCareOrders.length > 0) {
        if (!patient.patientId) throw new Error("The episode patient could not be identified for the home-care request.");

        const requestResults = await Promise.allSettled(newHomeCareOrders.map(async (order) => {
          const request = await createHomeCareRequest({
            patientId: patient.patientId,
            serviceId: order.serviceId,
            requestType: "clinician_initiated",
            episodeId,
            ...(order.startDate ? { preferredDate: `${order.startDate}T00:00:00.000Z` } : {}),
            notes: homeCareRequestNotes(order),
          });
          capturePostHogEvent("home_care_request_created", {
            episode_id: episodeId,
            patient_id: patient.patientId,
            service_id: order.serviceId,
            request_id: request.id,
            fulfillment_method: order.fulfillmentMethod,
          });
          return order.id;
        }));

        const createdOrderIds = new Set(
          requestResults
            .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
            .map((result) => result.value),
        );
        formToSave = {
          ...form,
          homeCare: form.homeCare.map((order) => createdOrderIds.has(order.id) ? { ...order, isNew: false } : order),
        };
        setForm(formToSave);

        const failedCount = requestResults.length - createdOrderIds.size;
        if (failedCount > 0) {
          throw new Error(`${failedCount} home-care request${failedCount === 1 ? "" : "s"} could not be created. Please retry.`);
        }
      }

      const result = mode === "patch"
        ? await updateCarePlan(episodeId, toPayload(formToSave, reason))
        : await createCarePlanVersion(episodeId, toPayload(formToSave, reason));
      const normalized = normalizeCarePlan(result, formToSave.startDate, formToSave.episodeDuration);
      const saved = {
        ...normalized,
        homeCare: normalized.homeCare.map((order, index) => ({
          ...order,
          serviceId: formToSave.homeCare[index]?.serviceId ?? order.serviceId,
        })),
      };
      setForm(saved);
      setInitialForm(JSON.stringify(saved));
      try {
        const refreshed = await getCarePlan(episodeId);
        setVersions(refreshed.versions);
      } catch {
        setVersions((current) => [result, ...current.filter((item) => item.id !== result.id)]);
      }
      capturePostHogEvent(mode === "patch" ? "care_plan_updated" : "care_plan_version_created", {
        episode_id: episodeId,
        version: saved.version,
      });
      return saved.version;
    } finally {
      setSaveMode(null);
    }
  }, [episodeId, form, patient.patientId]);

  const reset = useCallback(() => setForm(JSON.parse(initialForm) as CarePlanForm), [initialForm]);
  return { form, setForm, versions, clinicians, services, patient, error, isLoading, saveMode, isDirty, save, reset };
}