"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getCareEpisodeById } from "@/lib/api/care-episodes";
import { createCarePlanVersion, getCarePlan, updateCarePlan } from "@/lib/api/care-plan";
import { getAvailableClinicians } from "@/lib/api/clinicians";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import type {
  CarePlan,
  CarePlanForm,
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
        service: task.title,
        priority: task.priority || "Routine",
        frequency: details.frequency || plan.monitoringFrequency || "Daily",
        startDate: task.dueDate?.slice(0, 10) ?? "",
        duration: details.duration,
        numberOfVisits: details.numberOfVisits,
        instructions: details.instructions,
        fulfillmentMethod: details.fulfillmentMethod,
        clinicianId: details.clinicianId,
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
      const parsed = splitInstructions(task.instructions);
      monitoring.push({
        id: rowId("monitoring", index),
        name: task.title,
        frequency: parsed.first || plan.monitoringFrequency || "",
        cadence: parsed.rest,
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
      ...form.monitoring.map((item) => ({ title: item.name, dueDate: "", status: "active", type: "monitoring", priority: "Routine", instructions: [item.frequency, item.cadence].filter(Boolean).join(" | ") })),
      ...form.homeCare.map((order) => ({ title: order.service, dueDate: order.startDate, status: "pending", type: "home-care", priority: order.priority, instructions: serializeHomeCareInstructions(order) })),
      ...form.warningSigns.map((warning) => ({ title: warning.title, dueDate: "", status: "active", type: "warning", priority: "Urgent", instructions: [warning.detail, warning.response].filter(Boolean).join(" | ") })),
    ],
    lifestyleRecommendations: form.lifestyle.map((item) => [item.title, item.description].filter(Boolean).join(": ")),
    monitoringFrequency: form.monitoringFrequency,
    episodeDuration: String(form.episodeDuration),
    changeReason: reason,
  };
}

export function useCarePlanForm(episodeId: string) {
  const [form, setForm] = useState<CarePlanForm>(() => emptyForm());
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [patient, setPatient] = useState({ name: "Patient", id: "--" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saveMode, setSaveMode] = useState<"patch" | "post" | null>(null);
  const [initialForm, setInitialForm] = useState(() => JSON.stringify(emptyForm()));

  useEffect(() => {
    if (!episodeId) return;
    let active = true;
    Promise.allSettled([getCarePlan(episodeId), getAvailableClinicians(), getCareEpisodeById(episodeId)]).then(([plan, staff, episode]) => {
      if (!active) return;
      const episodeValue = episode.status === "fulfilled" ? episode.value : null;
      const startDate = episodeValue?.createdAt?.slice(0, 10) || isoToday;
      const duration = episodeValue?.expectedDurationDays ?? 1;

      if (episodeValue?.patient) {
        setPatient({
          name: episodeValue.patient.name || "Patient",
          id: episodeValue.patient.hospitalId || episodeValue.patientId || "--",
        });
      }
      if (staff.status === "fulfilled") setClinicians(staff.value);

      if (plan.status === "fulfilled") {
        const next = normalizeCarePlan(plan.value, startDate, duration);
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
    const reason = [selected, modalReason.trim()].filter(Boolean).join(" — ");
    if (!reason) throw new Error("Change reason is required.");
    setSaveMode(mode);
    try {
      const result = mode === "patch"
        ? await updateCarePlan(episodeId, toPayload(form, reason))
        : await createCarePlanVersion(episodeId, toPayload(form, reason));
      const saved = normalizeCarePlan(result, form.startDate, form.episodeDuration);
      setForm(saved);
      setInitialForm(JSON.stringify(saved));
      capturePostHogEvent(mode === "patch" ? "care_plan_updated" : "care_plan_version_created", {
        episode_id: episodeId,
        version: saved.version,
      });
      return saved.version;
    } finally {
      setSaveMode(null);
    }
  }, [episodeId, form]);

  const reset = useCallback(() => setForm(JSON.parse(initialForm) as CarePlanForm), [initialForm]);
  return { form, setForm, clinicians, patient, error, isLoading, saveMode, isDirty, save, reset };
}
