"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getCareEpisodeById } from "@/lib/api/care-episodes";
import { createCarePlanVersion, getCarePlan, updateCarePlan } from "@/lib/api/care-plan";
import { getAvailableClinicians } from "@/lib/api/clinicians";
import type { CarePlan, CarePlanForm, CarePlanPayload, Clinician, HomeCareOrder, LabTest, MonitoringItem, Recommendation, WarningSign } from "../types";

const isoToday = new Date().toISOString().slice(0, 10);
const id = (prefix: string, index = 0) => `${prefix}-${index}-${Math.random().toString(36).slice(2, 7)}`;

const previewForm: CarePlanForm = {
  id: "preview",
  version: 3,
  isActive: true,
  createdAt: "2026-04-22T10:00:00Z",
  medications: [
    { id: "med-1", name: "Furosemide", dosage: "40 mg", frequency: "BID", duration: "30 days", instructions: "Take with food in the morning and early afternoon." },
    { id: "med-2", name: "Lisinopril", dosage: "10 mg", frequency: "Daily PM", duration: "Ongoing", instructions: "Monitor BP weekly; report dizziness." },
    { id: "med-3", name: "Carvedilol", dosage: "6.25 mg", frequency: "BID", duration: "Ongoing", instructions: "Take with meals to reduce orthostatic hypotension." },
  ],
  labTests: [
    { id: "lab-1", name: "BNP", priority: "Urgent", purpose: "Monitor heart failure progression", date: "2026-06-08" },
    { id: "lab-2", name: "Basic Metabolic Panel", priority: "Routine", purpose: "Track renal function and electrolytes on diuretic therapy", date: "2026-06-15" },
  ],
  monitoring: [
    { id: "mon-1", name: "Blood sugar logging", frequency: "2× per day", cadence: "Daily" },
    { id: "mon-2", name: "Blood pressure logging", frequency: "Daily", cadence: "" },
    { id: "mon-3", name: "Weight measurement", frequency: "Every morning", cadence: "" },
    { id: "mon-4", name: "Oxygen saturation (SpO₂)", frequency: "3× per day", cadence: "" },
  ],
  homeCare: [{ id: "home-1", service: "Vitals Monitoring", priority: "Routine", frequency: "Daily", startDate: "", duration: 14, numberOfWeeks: 2, instructions: "", fulfillmentMethod: "hospital", clinicianId: "preview-nurse" }],
  lifestyle: [
    { id: "life-1", title: "Diet & Nutrition", summary: "Low-sodium diet", description: "Limit sodium to under 2 g per day; avoid processed meals and canned soups." },
    { id: "life-2", title: "Physical Activity", summary: "Daily light walking", description: "10–15 minutes of walking each day, increase by 5 minutes weekly as tolerated." },
    { id: "life-3", title: "Sleep & Rest", summary: "Consistent sleep schedule", description: "Aim for 7–8 hours of sleep with elevated head position to reduce nocturnal dyspnea." },
  ],
  warningSigns: [
    { id: "warn-1", title: "Sudden weight gain", detail: ">1 kg in 24h", response: "Contact care team immediately and reduce fluid intake." },
    { id: "warn-2", title: "Shortness of breath", detail: "At rest or worsening orthopnea", response: "Call clinician or go to nearest emergency department." },
  ],
  patientNotification: true,
  monitoringFrequency: "Daily",
  episodeDuration: 30,
  startDate: "2026-04-12",
  changeReasons: [],
  additionalReason: "",
};

const previewClinicians: Clinician[] = [
  { id: "preview-nurse", name: "Nurse A. Bella", role: "Community Health Nurse" },
  { id: "preview-nurse-2", name: "Chinwe Okafor", role: "Registered Nurse" },
  { id: "preview-physio", name: "David Mensah", role: "Physiotherapist" },
];

function splitInstructions(instructions = "") {
  const [first, ...rest] = instructions.split(" | ");
  return { first, rest: rest.join(" | ") };
}

function normalizeCarePlan(plan: CarePlan): CarePlanForm {
  const labTests: LabTest[] = [];
  const monitoring: MonitoringItem[] = [];
  const homeCare: HomeCareOrder[] = [];
  const warningSigns: WarningSign[] = [];

  for (const [index, task] of (plan.tasks ?? []).entries()) {
    const type = task.type?.toLowerCase();
    if (["lab", "laboratory", "diagnostic"].includes(type ?? "")) {
      labTests.push({ id: id("lab", index), name: task.title, priority: task.priority?.toLowerCase() === "urgent" ? "Urgent" : "Routine", purpose: task.instructions ?? "", date: task.dueDate?.slice(0, 10) ?? "" });
    } else if (type === "monitoring") {
      const parsed = splitInstructions(task.instructions);
      monitoring.push({ id: id("mon", index), name: task.title, frequency: parsed.first || plan.monitoringFrequency || "Daily", cadence: parsed.rest });
    } else if (["home-care", "home_care", "homecare"].includes(type ?? "")) {
      homeCare.push({ id: id("home", index), service: task.title, priority: task.priority || "Routine", frequency: plan.monitoringFrequency || "Daily", startDate: task.dueDate?.slice(0, 10) ?? "", duration: 14, numberOfWeeks: 2, instructions: task.instructions ?? "", fulfillmentMethod: "hospital", clinicianId: "" });
    } else if (["warning", "warning-sign"].includes(type ?? "")) {
      const parsed = splitInstructions(task.instructions);
      warningSigns.push({ id: id("warn", index), title: task.title, detail: parsed.first, response: parsed.rest || parsed.first });
    }
  }

  const lifestyle: Recommendation[] = (plan.lifestyleRecommendations ?? []).map((item, index) => {
    if (typeof item === "string") return { id: id("life", index), title: ["Diet & Nutrition", "Physical Activity", "Sleep & Rest"][index] ?? "Lifestyle", summary: "", description: item };
    return { id: id("life", index), title: item.title, summary: "", description: item.description };
  });
  const duration = Number.parseInt(plan.episodeDuration, 10);

  return {
    ...previewForm,
    id: plan.id,
    version: plan.version || 1,
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    medications: (plan.medications ?? []).map((medication, index) => ({ id: id("med", index), ...medication, instructions: medication.instructions ?? "" })),
    labTests: labTests.length ? labTests : previewForm.labTests,
    monitoring: monitoring.length ? monitoring : previewForm.monitoring,
    homeCare: homeCare.length ? homeCare : previewForm.homeCare,
    lifestyle: lifestyle.length ? lifestyle : previewForm.lifestyle,
    warningSigns: warningSigns.length ? warningSigns : previewForm.warningSigns,
    monitoringFrequency: plan.monitoringFrequency || "Daily",
    episodeDuration: Number.isFinite(duration) ? duration : 30,
    changeReasons: [],
    additionalReason: "",
  };
}

function toPayload(form: CarePlanForm, reason: string): CarePlanPayload {
  return {
    medications: form.medications.map((medication) => ({ name: medication.name, dosage: medication.dosage, frequency: medication.frequency, duration: medication.duration, instructions: medication.instructions })),
    tasks: [
      ...form.labTests.map((test) => ({ title: test.name, dueDate: test.date, status: "pending", type: "laboratory", priority: test.priority, instructions: test.purpose })),
      ...form.monitoring.map((item) => ({ title: item.name, dueDate: "", status: "active", type: "monitoring", priority: "Routine", instructions: [item.frequency, item.cadence].filter(Boolean).join(" | ") })),
      ...form.homeCare.map((order) => ({ title: order.service, dueDate: order.startDate, status: "pending", type: "home-care", priority: order.priority, instructions: order.instructions })),
      ...form.warningSigns.map((warning) => ({ title: warning.title, dueDate: "", status: "active", type: "warning", priority: "Urgent", instructions: [warning.detail, warning.response].filter(Boolean).join(" | ") })),
    ],
    lifestyleRecommendations: form.lifestyle.map(({ title, description }) => ({ title, description })),
    monitoringFrequency: form.monitoringFrequency,
    episodeDuration: String(form.episodeDuration),
    changeReason: reason,
    isActive: form.isActive,
    notifyPatient: form.patientNotification,
  };
}

export function useCarePlanForm(episodeId: string) {
  const [form, setForm] = useState<CarePlanForm>(previewForm);
  const [clinicians, setClinicians] = useState<Clinician[]>(previewClinicians);
  const [patient, setPatient] = useState({ name: "Amara Okonkwo", id: "PT-78291" });
  const [isLoading, setIsLoading] = useState(true);
  const [saveMode, setSaveMode] = useState<"patch" | "post" | null>(null);
  const [initialForm, setInitialForm] = useState(JSON.stringify(previewForm));

  useEffect(() => {
    if (!episodeId) return;
    let active = true;
    Promise.allSettled([getCarePlan(episodeId), getAvailableClinicians(), getCareEpisodeById(episodeId)]).then(([plan, staff, episode]) => {
      if (!active) return;
      const next = plan.status === "fulfilled" ? normalizeCarePlan(plan.value) : structuredClone(previewForm);
      setForm(next);
      setInitialForm(JSON.stringify(next));
      if (staff.status === "fulfilled" && staff.value.length) setClinicians(staff.value);
      if (episode.status === "fulfilled" && episode.value.patient) setPatient({ name: episode.value.patient.name || "Amara Okonkwo", id: episode.value.patient.hospitalId || episode.value.patientId || "PT-78291" });
      setIsLoading(false);
    });
    return () => { active = false; };
  }, [episodeId]);

  const isDirty = useMemo(() => JSON.stringify(form) !== initialForm, [form, initialForm]);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const onLinkClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest("a[href]");
      if (link && !window.confirm("You have unsaved changes. Leave without saving?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onLinkClick, true);
    return () => { window.removeEventListener("beforeunload", onBeforeUnload); document.removeEventListener("click", onLinkClick, true); };
  }, [isDirty]);

  const save = useCallback(async (mode: "patch" | "post", modalReason: string) => {
    const selected = [...form.changeReasons, form.additionalReason.trim()].filter(Boolean).join("; ");
    const reason = [selected, modalReason.trim()].filter(Boolean).join(" — ");
    if (!reason) throw new Error("Change reason is required");
    setSaveMode(mode);
    try {
      const result = mode === "patch" ? await updateCarePlan(episodeId, toPayload(form, reason)) : await createCarePlanVersion(episodeId, toPayload(form, reason));
      const saved = result?.id ? normalizeCarePlan(result) : { ...form, version: mode === "post" ? form.version + 1 : form.version };
      setForm(saved);
      setInitialForm(JSON.stringify(saved));
    } finally {
      setSaveMode(null);
    }
  }, [episodeId, form]);

  const reset = useCallback(() => setForm(JSON.parse(initialForm) as CarePlanForm), [initialForm]);
  return { form, setForm, clinicians, patient, isLoading, saveMode, isDirty, save, reset, isoToday };
}
