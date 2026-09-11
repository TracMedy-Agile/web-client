"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  FlaskConical,
  HeartPulse,
  MessageSquare,
  Plus,
  Scale,
  Sparkles,
  TestTube2,
  Thermometer,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  generateEpisodeInsight,
  getLatestRecoverySummary,
  type EpisodeInsightPayload,
} from "@/lib/api/ai";
import { cn } from "@/lib/utils";
import {
  asRecord,
  getCareEpisodeById,
  getCareEpisodeCheckins,
  getCareEpisodeDailyVitals,
  getCareEpisodeLabResults,
  getCareEpisodeMedia,
  getCareEpisodeMedicationAdherence,
  getCareEpisodeMedicationLogs,
  getCareEpisodeTimelinePage,
  updateLabResultStatus,
  getNumber,
  getString,
  type ApiRecord,
  type CareEpisodeDetail,
  type CheckInHistoryRecord,
  type DailyVitalsRecord,
  type EpisodeLabResult,
  type EpisodeMediaItem,
  type MedicationAdherenceRecord,
  type MedicationLogHistory,
  type TimelineEventRecord,
} from "@/lib/api/care-episodes";
import { CareEpisodeSubHeader, SubHeaderSkeleton } from "../_shared/SubHeader";
import { MediaViewerModal, type MediaViewerData } from "../components/MediaViewerModal";
import {
  BIOMETRIC_METRICS,
  BIOMETRIC_RANGES,
  buildBiometricData,
  formatRelativeTime,
  formatTime,
  type BiometricMetric,
  type BiometricPoint,
  type BiometricRange,
} from "../_shared/utils";

type VitalStatus = "NORMAL" | "ELEVATED" | "LOW" | "--";

type VitalCard = {
  key: string;
  label: string;
  Icon: LucideIcon;
  unit: string;
  display: string;
  status: VitalStatus;
  time: string;
};

type VitalDef = {
  key: string;
  label: string;
  Icon: LucideIcon;
  unit: string;
  resolve: (checkin: ApiRecord) => { display: string; status: VitalStatus } | null;
};

const VITAL_DEFS: VitalDef[] = [
  {
    key: "heartRate",
    label: "Heart Rate",
    Icon: HeartPulse,
    unit: "bpm",
    resolve: (vitals) => {
      const value = getNumber(vitals, ["heart_rate", "heartRate", "hr", "pulse"]);
      if (value === null) return null;
      return { display: String(value), status: value < 60 ? "LOW" : value > 100 ? "ELEVATED" : "NORMAL" };
    },
  },
  {
    key: "bloodPressure",
    label: "Blood Pressure",
    Icon: Activity,
    unit: "mmHg",
    resolve: (vitals) => {
      const systolic = getNumber(vitals, ["bp_systolic", "bloodPressureSystolic", "systolic", "bpSystolic"]);
      const diastolic = getNumber(vitals, ["bp_diastolic", "bloodPressureDiastolic", "diastolic", "bpDiastolic"]);
      if (systolic === null && diastolic === null) return null;
      const status: VitalStatus = systolic === null ? "NORMAL" : systolic < 90 ? "LOW" : systolic >= 130 ? "ELEVATED" : "NORMAL";
      return { display: `${systolic ?? "--"}/${diastolic ?? "--"}`, status };
    },
  },
  {
    key: "spo2",
    label: "SpO₂",
    Icon: TestTube2,
    unit: "%",
    resolve: (vitals) => {
      const value = getNumber(vitals, ["spo2", "oxygenSaturation", "spO2"]);
      if (value === null) return null;
      return { display: String(value), status: value < 95 ? "LOW" : "NORMAL" };
    },
  },
  {
    key: "temperature",
    label: "Temperature",
    Icon: Thermometer,
    unit: "°C",
    resolve: (vitals) => {
      const value = getNumber(vitals, ["temperature", "temp"]);
      if (value === null) return null;
      return { display: value.toFixed(1), status: value < 36.1 ? "LOW" : value > 37.5 ? "ELEVATED" : "NORMAL" };
    },
  },
  {
    key: "weight",
    label: "Weight",
    Icon: Scale,
    unit: "kg",
    resolve: (vitals) => {
      const value = getNumber(vitals, ["weight", "weightKg"]);
      if (value === null) return null;
      return { display: String(value), status: "NORMAL" };
    },
  },
  {
    key: "respiratoryRate",
    label: "Respiratory Rate",
    Icon: Wind,
    unit: "breaths/min",
    resolve: (vitals) => {
      const value = getNumber(vitals, ["respiratory_rate", "respiratoryRate", "respRate", "breathingRate"]);
      if (value === null) return null;
      return { display: String(value), status: value < 12 ? "LOW" : value > 20 ? "ELEVATED" : "NORMAL" };
    },
  },
  {
    key: "bloodSugar",
    label: "Blood Sugar Level",
    Icon: FlaskConical,
    unit: "mg/dL",
    resolve: (vitals) => {
      const value = getNumber(vitals, ["blood_sugar", "bloodSugar", "bloodGlucose", "glucose"]);
      if (value === null) return null;
      return { display: String(value), status: value < 70 ? "LOW" : value > 140 ? "ELEVATED" : "NORMAL" };
    },
  },
  {
    key: "urineOutput",
    label: "Urine Output",
    Icon: TestTube2,
    unit: "mL/day",
    resolve: (vitals) => {
      const value = getNumber(vitals, ["urineOutput", "urineOutputMl"]);
      if (value === null) return null;
      return { display: String(value), status: "NORMAL" };
    },
  },
];

const VITAL_STATUS_BADGE: Record<VitalStatus, string> = {
  NORMAL: "bg-slate-100 text-slate-700",
  ELEVATED: "bg-red-50 text-red-500",
  LOW: "bg-blue-50 text-primary",
  "--": "bg-slate-100 text-slate-500",
};

const VITAL_STATUS_LABEL: Record<VitalStatus, string> = {
  NORMAL: "Normal",
  ELEVATED: "Elevated",
  LOW: "Low",
  "--": "--",
};

const VITAL_STATUS_DESCRIPTION: Record<VitalStatus, string> = {
  NORMAL: "Within expected range for this patient.",
  ELEVATED: "Above expected range - monitor closely.",
  LOW: "Below expected range - monitor closely.",
  "--": "No recent reading logged.",
};

function buildVitalCards(checkin: ApiRecord | null): VitalCard[] {
  const vitals = checkin ? asRecord(checkin.vitals) : null;
  const time = checkin ? formatTime(getString(checkin, ["submittedAt", "recordedAt", "timestamp", "createdAt"])) : "--";
  return VITAL_DEFS.map((def) => {
    const resolved = vitals ? def.resolve(vitals) : null;
    return {
      key: def.key,
      label: def.label,
      Icon: def.Icon,
      unit: def.unit,
      display: resolved?.display ?? "--",
      status: resolved?.status ?? "--",
      time: resolved ? time : "--",
    };
  });
}

type SymptomTrend = "Worsening" | "Persistent" | "New" | "Improving";
type SymptomItem = { id: string; name: string; severity: number; trend: SymptomTrend; onset: string; note: string };

const SYMPTOM_TREND_BADGE: Record<SymptomTrend, string> = {
  Worsening: "bg-red-50 text-red-500",
  Persistent: "bg-amber-50 text-amber-500",
  New: "bg-blue-50 text-primary",
  Improving: "bg-emerald-50 text-emerald-500",
};

function getSeverity(record: ApiRecord) {
  const numeric = getNumber(record, ["severity", "severityScore", "painScore", "score"]);
  if (numeric !== null) return Math.min(10, Math.max(0, Math.round(numeric)));
  const label = getString(record, ["severity"]).toLowerCase();
  if (label === "severe" || label === "high") return 8;
  if (label === "moderate" || label === "medium") return 5;
  if (label === "mild" || label === "low") return 3;
  return 0;
}

function getSymptomTrend(record: ApiRecord): SymptomTrend {
  const value = getString(record, ["trend", "status", "progress"]).toLowerCase();
  if (value.includes("wors")) return "Worsening";
  if (value.includes("improv") || value.includes("resolv")) return "Improving";
  if (value.includes("persist") || value.includes("ongoing")) return "Persistent";
  return "New";
}

function buildSymptoms(checkin: ApiRecord | null): SymptomItem[] {
  if (!checkin) return [];
  const raw = checkin.symptoms;
  const submittedAt = getString(checkin, ["submittedAt"]);
  const symptomsRecord = asRecord(raw);
  const entries: Array<{ fallbackName: string; value: unknown }> = Array.isArray(raw)
    ? raw.map((value, index) => ({ fallbackName: "Symptom " + (index + 1), value }))
    : symptomsRecord
      ? Object.entries(symptomsRecord).map(([fallbackName, value]) => ({ fallbackName, value }))
      : [];

  return entries.map(({ fallbackName, value }, index) => {
    if (typeof value === "string") {
      return {
        id: "symptom-" + index,
        name: value,
        severity: 0,
        trend: "New",
        onset: submittedAt ? "Reported " + formatRelativeTime(submittedAt) : "Recently reported",
        note: "",
      };
    }

    const record = asRecord(value) ?? {};
    return {
      id: getString(record, ["id"]) || "symptom-" + index,
      name: getString(record, ["name", "type", "symptom"], fallbackName.replaceAll("_", " ")),
      severity: getSeverity(record),
      trend: getSymptomTrend(record),
      onset: getString(record, ["onset", "onsetLabel"]) || (submittedAt ? "Reported " + formatRelativeTime(submittedAt) : "Recently reported"),
      note: getString(record, ["notes", "note", "description", "trigger"]),
    };
  });
}

function severityTier(severity: number) {
  if (severity >= 7) return "SEVERE";
  if (severity >= 4) return "MODERATE";
  return "MILD";
}

type ClinicalMediaItem = {
  id: string;
  title: string;
  type: string;
  status: "Reviewed" | "Pending review";
  source: "checkin" | "lab";
  sourceId: string | null;
  priority: string | null;
  uploadedAt: string;
  kind: "image" | "pdf";
  captureContext: string;
  dateCaptured: string;
  capturedAt: string;
  uploadTimestamp: string;
  patientId: string;
  patientDescription: string;
  imageUrl: string;
};

const MEDIA_STATUS_BADGE: Record<ClinicalMediaItem["status"], string> = {
  Reviewed: "bg-emerald-50 text-emerald-500",
  "Pending review": "bg-amber-50 text-amber-500",
};


function formatDateTimeLabel(value: string) {
  const parsed = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed)) return "--";
  const date = new Date(parsed);
  const datePart = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
  return `${datePart} - ${formatTime(value)}`;
}

function formatLabResultTitle(result: EpisodeLabResult) {
  return result.testName || result.labName || "Uploaded lab result";
}


// The care-episode API only exposes images attached to the patient's latest check-in
  // (PatientCheckInDto.images) - there is no dedicated "list all clinical media" endpoint.
function buildClinicalMedia(checkin: ApiRecord | null, patientCode: string): ClinicalMediaItem[] {
  if (!checkin) return [];
  const images = checkin.images;
  if (!Array.isArray(images)) return [];

  const submittedAt = getString(checkin, ["submittedAt"]);
  const notes = getString(checkin, ["notes"]);

  return images
    .filter((url): url is string => typeof url === "string" && url.length > 0)
    .map((url, index) => ({
      id: `${submittedAt || "checkin"}-${index}`,
      source: "checkin" as const,
      sourceId: null,
      title: `Check-in Upload ${index + 1}`,
      type: "Check-in Image",
      status: "Pending review" as const,
      priority: null,
      uploadedAt: formatUploadedAt(submittedAt),
      kind: "image" as const,
      captureContext: "Check-in Image",
      dateCaptured: formatDateOnly(submittedAt),
      capturedAt: submittedAt,
      uploadTimestamp: submittedAt ? formatTime(submittedAt) : "--",
      patientId: patientCode,
      patientDescription: notes || "No description provided by patient.",
      imageUrl: url,
    }));
}

function buildMediaHistory(items: EpisodeMediaItem[], patientCode: string): ClinicalMediaItem[] {
  return items
    .filter((item) => Boolean(item.url))
    .map((item, index) => ({
      id: `${item.checkInId}-${index}`,
      source: "checkin" as const,
      sourceId: item.checkInId,
      title: item.caption || `Check-in Upload ${index + 1}`,
      type: item.type || "Check-in Image",
      status: "Pending review" as const,
      priority: null,
      uploadedAt: formatUploadedAt(item.submittedAt),
      kind: "image" as const,
      captureContext: item.type || "Check-in Image",
      dateCaptured: formatDateOnly(item.submittedAt),
      capturedAt: item.submittedAt,
      uploadTimestamp: formatTime(item.submittedAt),
      patientId: patientCode,
      patientDescription: item.caption || "No description provided by patient.",
      imageUrl: item.url ?? "",
    }));
}

function formatDateOnly(value: string) {
  const parsed = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed)) return "--";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(parsed));
}
function formatUploadedAt(value: string) {
  const parsed = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed)) return "Uploaded --";
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(parsed));
  return `Uploaded ${date} • ${formatTime(value)}`;
}

function buildLabMedia(results: EpisodeLabResult[], patientCode: string): ClinicalMediaItem[] {
  return results
    .filter((result) => Boolean(result.fileUrl))
    .map((result) => ({
      id: `lab-${result.id}`,
      source: "lab" as const,
      sourceId: result.id,
      title: formatLabResultTitle(result),
      type: "Laboratory PDF",
      status: result.status === "reviewed" || result.status === "flagged" ? "Reviewed" as const : "Pending review" as const,
      priority: null,
      uploadedAt: formatUploadedAt(result.createdAt),
      kind: "pdf" as const,
      captureContext: result.labName || "Laboratory result",
      dateCaptured: formatDateOnly(result.observedAt || result.createdAt),
      capturedAt: result.observedAt || result.createdAt,
      uploadTimestamp: result.createdAt ? formatTime(result.createdAt) : "--",
      patientId: patientCode,
      patientDescription: result.notes || "No description provided by patient.",
      imageUrl: result.fileUrl ?? "",
    }));
}
function formatCurrentLabel(capturedAt: string): string {
  const parsed = capturedAt ? Date.parse(capturedAt) : NaN;
  if (!Number.isFinite(parsed)) return "--";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(parsed)).toUpperCase();
}

function toMediaViewerData(media: ClinicalMediaItem): MediaViewerData {
  return {
    title: media.title,
    status: media.status,
    priority: media.priority,
    kind: media.kind,
    captureContext: media.captureContext,
    dateCaptured: media.dateCaptured,
    currentLabel: formatCurrentLabel(media.capturedAt),
    uploadTimestamp: media.uploadTimestamp,
    patientId: media.patientId,
    patientDescription: media.patientDescription,
    imageUrl: media.imageUrl,
  };
}

type NoteType = "Observation" | "Symptom" | "Concern";

const NOTE_TYPE_BORDER: Record<NoteType, string> = {
  Concern: "border-l-red-500",
  Observation: "border-l-primary",
  Symptom: "border-l-amber-500",
};

const NOTE_TYPE_BADGE: Record<NoteType, string> = {
  Concern: "bg-red-50 text-red-500",
  Observation: "bg-blue-50 text-primary",
  Symptom: "bg-amber-50 text-amber-500",
};

type PatientNote = { id: string; type: NoteType; text: string; linked: string; time: string };

function noteTypeFromValue(value: string): NoteType {
  const normalized = value.toLowerCase();
  if (normalized.includes("symptom")) return "Symptom";
  if (normalized.includes("concern") || normalized.includes("warning") || normalized.includes("alert")) return "Concern";
  return "Observation";
}

function buildPatientNotes(checkin: ApiRecord | null): PatientNote[] {
  if (!checkin) return [];
  const notes = getString(checkin, ["notes", "patientNotes", "patientNote", "note", "content", "text"]);
  if (!notes) return [];

  const submittedAt = getString(checkin, ["submittedAt", "createdAt", "timestamp"]);
  const noteId = getString(checkin, ["id"]) || submittedAt || "latest-note";
  const category = getString(checkin, ["noteType", "noteCategory", "category", "type"]);
  return [
    {
      id: `checkin-note-${noteId}`,
      type: noteTypeFromValue(category),
      text: notes.startsWith("\"") ? notes : `"${notes}"`,
      linked: "LATEST CHECK-IN",
      time: submittedAt ? formatRelativeTime(submittedAt) : "--",
    },
  ];
}

function noteTypeFromTimelineEvent(event: TimelineEventRecord): NoteType {
  const eventType = event.eventType.toLowerCase();
  const category = getString(event.payload, ["noteType", "noteCategory", "category", "type"]);
  if (category) return noteTypeFromValue(category);
  if (eventType.includes("symptom")) return "Symptom";
  if (eventType.includes("concern") || eventType.includes("alert")) return "Concern";
  return "Observation";
}

function buildTimelinePatientNote(event: TimelineEventRecord): PatientNote | null {
  const eventType = event.eventType.toLowerCase();
  const source = event.source.toLowerCase();
  const isPatientNoteEvent = eventType.includes("patient_note") || eventType.includes("patient-note") || eventType === "patient note";
  const isPatientSource = source.includes("patient") || source.includes("mobile") || source.includes("app");
  if (!isPatientSource && !isPatientNoteEvent) return null;

  const nestedPayload = asRecord(event.payload.data);
  const payload = nestedPayload ?? event.payload;
  const note = getString(payload, ["notes", "patientNotes", "patientNote", "note", "content", "text"])
    || (isPatientNoteEvent ? getString(payload, ["message", "description"]) : "");
  if (!note) return null;

  return {
    id: `timeline-${event.id}`,
    type: noteTypeFromTimelineEvent({ ...event, payload }),
    text: note.startsWith("\"") ? note : `"${note}"`,
    linked: isPatientNoteEvent ? "PATIENT NOTE" : eventType.includes("check") ? "CHECK-IN TIMELINE" : "CARE TIMELINE",
    time: event.timestamp ? formatRelativeTime(event.timestamp) : "--",
  };
}
function dedupePatientNotes(notes: PatientNote[]) {
  const seen = new Set<string>();
  return notes.filter((note) => {
    const key = `${note.text.toLowerCase()}-${note.time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getMedicationStatus(medication: MedicationAdherenceRecord) {
  if (medication.totalDoses > 0 && medication.takenCount >= medication.totalDoses) {
    return { label: "Completed", className: "bg-emerald-50 text-emerald-500", barColor: "var(--color-emerald-500)" };
  }
  if (medication.missedCount > 0) {
    return { label: "Missed", className: "bg-amber-50 text-amber-500", barColor: "var(--color-amber-500)" };
  }
  return { label: "Taken", className: "bg-emerald-50 text-emerald-500", barColor: "var(--color-emerald-500)" };
}

function formatMedicationSourceLabel(source?: string) {
  const normalized = source?.trim();
  if (!normalized) return "";
  const key = normalized.toLowerCase().replace(/[\s-]+/g, "_");
  const labels: Record<string, string> = {
    care_plan: "Care Plan",
    patient: "Patient-entered",
    patient_entered: "Patient-entered",
    manual: "Manual",
    clinician: "Clinician",
    medication_module: "Medication Module",
  };
  return labels[key] ?? normalized.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAiTimestamp(value?: string) {
  if (!value) return "Not generated yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function formatAiConfidence(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 100)}% confidence` : "Confidence unavailable";
}

function aiDataNoticeForInsight(insight: EpisodeInsightPayload | null | undefined) {
  if (!insight) return "AI needs more patient check-ins, vitals, medication logs, or timeline activity before it can create a reviewable suggestion.";
  if (insight.dataSufficiency === "insufficient") {
    return "AI does not have enough episode data yet. Add more check-ins, vitals, medication logs, or timeline notes to generate a reliable suggestion.";
  }
  if (insight.dataSufficiency === "partial") {
    return "AI generated this with partial episode data. More check-ins and clinical activity will improve the recommendation quality.";
  }
  return "";
}
export default function CareEpisodeInsightsPage() {
  const params = useParams<{ id: string }>();
  const episodeId = params?.id ?? "";

  const [episode, setEpisode] = useState<CareEpisodeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [medications, setMedications] = useState<MedicationAdherenceRecord[]>([]);
  const [medsLoading, setMedsLoading] = useState(true);
  const [dailyVitals, setDailyVitals] = useState<DailyVitalsRecord[]>([]);
  const [vitalsLoading, setVitalsLoading] = useState(true);
  const [checkins, setCheckins] = useState<CheckInHistoryRecord[]>([]);
  const [mediaHistory, setMediaHistory] = useState<EpisodeMediaItem[]>([]);
  const [labResults, setLabResults] = useState<EpisodeLabResult[]>([]);

  const [timelineEvents, setTimelineEvents] = useState<TimelineEventRecord[]>([]);

  const [biometricMetric, setBiometricMetric] = useState<BiometricMetric>("Blood Pressure");
  const [biometricRange, setBiometricRange] = useState<BiometricRange>("14d");
  const [metricMenuOpen, setMetricMenuOpen] = useState(false);

  const [expandedMedicationId, setExpandedMedicationId] = useState<string | null>(null);
  const [medicationLogs, setMedicationLogs] = useState<Record<string, MedicationLogHistory | "loading" | "error">>({});
  const [notesTab, setNotesTab] = useState<"All" | NoteType>("All");
  const [activeMedia, setActiveMedia] = useState<ClinicalMediaItem | null>(null);
  const [mediaStatusOverrides, setMediaStatusOverrides] = useState<Record<string, ClinicalMediaItem["status"]>>({});
  const [mediaReviewError, setMediaReviewError] = useState("");
  const [aiSummary, setAiSummary] = useState<EpisodeInsightPayload | null>(null);
  const [aiGeneratedAt, setAiGeneratedAt] = useState("");
  const [aiSuggestionId, setAiSuggestionId] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "generating" | "error">("idle");
  const [aiError, setAiError] = useState("");
  const [aiDataNotice, setAiDataNotice] = useState("");

  function toggleMedication(medicationId: string) {
    const nextExpanded = expandedMedicationId === medicationId ? null : medicationId;
    setExpandedMedicationId(nextExpanded);
    if (nextExpanded && !medicationLogs[nextExpanded]) {
      setMedicationLogs((current) => ({ ...current, [nextExpanded]: "loading" }));
      getCareEpisodeMedicationLogs(episodeId, nextExpanded)
        .then((history) => setMedicationLogs((current) => ({ ...current, [nextExpanded]: history })))
        .catch(() => setMedicationLogs((current) => ({ ...current, [nextExpanded]: "error" })));
    }
  }


  async function openClinicalMedia(media: ClinicalMediaItem) {
    setMediaReviewError("");
    if (media.status === "Pending review" && media.source === "lab" && media.sourceId) {
      try {
        const reviewed = await updateLabResultStatus(media.sourceId, { status: "reviewed" });
        setLabResults((current) => current.map((result) => result.id === reviewed.id ? reviewed : result));
      } catch (requestError) {
        setMediaReviewError(requestError instanceof Error ? requestError.message : "Unable to mark this document as reviewed.");
        return;
      }
    }

    if (media.status === "Pending review") {
      setMediaStatusOverrides((current) => ({ ...current, [media.id]: "Reviewed" }));
      setActiveMedia({ ...media, status: "Reviewed" });
      return;
    }
    setActiveMedia(media);
  }
  async function generateSummary() {
    if (!episodeId) return;
    setAiStatus("generating");
    setAiError("");
    setAiDataNotice("");
    try {
      const response = await generateEpisodeInsight(episodeId);
      if (response.status === "success" && response.insight) {
        setAiSummary(response.insight);
        setAiSuggestionId(response.suggestionId ?? null);
        setAiGeneratedAt(new Date().toISOString());
        setAiDataNotice(aiDataNoticeForInsight(response.insight));
        capturePostHogEvent("ai_insight_viewed", { source: "episode", episode_id: episodeId });
      } else {
        setAiDataNotice(aiDataNoticeForInsight(response.insight));
        setAiError("AI could not generate a usable insight from the available episode data.");
      }
    } catch (requestError) {
      setAiError(requestError instanceof Error ? requestError.message : "Unable to generate AI insight.");
    } finally {
      setAiStatus("idle");
    }
  }
  useEffect(() => {
    capturePostHogEvent("patient_insights_viewed", { episode_id: episodeId });
  }, [episodeId]);


  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;

    (async () => {
      setAiStatus("loading");
      setAiError("");
      setAiDataNotice("");
      try {
        const response = await getLatestRecoverySummary(episodeId);
        if (ignore) return;
        if (response.status === "success" && response.summary) {
          setAiSummary(response.summary);
          setAiSuggestionId(response.suggestionId ?? null);
          setAiGeneratedAt(response.generatedAt ?? "");
          setAiDataNotice(aiDataNoticeForInsight(response.summary));
          capturePostHogEvent("ai_insight_viewed", { source: "recovery_summary", episode_id: episodeId });
        } else {
          setAiSummary(null);
          setAiSuggestionId(null);
          setAiGeneratedAt("");
          setAiDataNotice(aiDataNoticeForInsight(null));
        }
      } catch (requestError) {
        if (!ignore) setAiError(requestError instanceof Error ? requestError.message : "Unable to load latest AI summary.");
      } finally {
        if (!ignore) setAiStatus("idle");
      }
    })();

    return () => {
      ignore = true;
    };
  }, [episodeId, refreshKey]);

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;

    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const detail = await getCareEpisodeById(episodeId);
        if (!ignore) setEpisode(detail);
      } catch (requestError) {
        if (!ignore) {
          setEpisode(null);
          setError(requestError instanceof Error ? requestError.message : "Failed to load care episode.");
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [episodeId, refreshKey]);

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;

    (async () => {
      const [checkinResult, mediaResult, labResultsResult, timelineResult] = await Promise.allSettled([
        getCareEpisodeCheckins(episodeId),
        getCareEpisodeMedia(episodeId),
        getCareEpisodeLabResults(episodeId),
        getCareEpisodeTimelinePage(episodeId, { limit: 100 }),
      ]);
      if (ignore) return;
      setCheckins(checkinResult.status === "fulfilled" ? checkinResult.value : []);
      setMediaHistory(mediaResult.status === "fulfilled" ? mediaResult.value : []);
      setLabResults(labResultsResult.status === "fulfilled" ? labResultsResult.value : []);
      setTimelineEvents(timelineResult.status === "fulfilled" ? timelineResult.value.data : []);
    })();

    return () => {
      ignore = true;
    };
  }, [episodeId, refreshKey]);
  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;
    const days = BIOMETRIC_RANGES.find((range) => range.key === biometricRange)?.days ?? 14;
    (async () => {
      setVitalsLoading(true);
      try {
        const records = await getCareEpisodeDailyVitals(episodeId, days);
        if (!ignore) setDailyVitals(records);
      } catch {
        if (!ignore) setDailyVitals([]);
      } finally {
        if (!ignore) setVitalsLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [biometricRange, episodeId]);

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;

    (async () => {
      setMedsLoading(true);
      try {
        const list = await getCareEpisodeMedicationAdherence(episodeId);
        if (!ignore) setMedications(list);
      } catch {
        if (!ignore) setMedications([]);
      } finally {
        if (!ignore) setMedsLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [episodeId, refreshKey]);

  const biometricData: BiometricPoint[] = useMemo(
    () => buildBiometricData(biometricMetric, dailyVitals),
    [biometricMetric, dailyVitals],
  );
  const biometricUnit = BIOMETRIC_METRICS.find((item) => item.label === biometricMetric)?.unit ?? "";

  const vitalCards = useMemo(() => buildVitalCards(episode?.latestCheckin ?? null), [episode]);
  const checkinRelativeTime = formatRelativeTime(
    getString(episode?.latestCheckin ?? null, ["submittedAt", "recordedAt", "timestamp", "createdAt"]),
  );

  const clinicalMedia = useMemo(() => {
    const patientMedia = mediaHistory.length
      ? buildMediaHistory(mediaHistory, episode?.patient?.hospitalId ?? "")
      : buildClinicalMedia(episode?.latestCheckin ?? null, episode?.patient?.hospitalId ?? "");
    const combined = [...patientMedia, ...buildLabMedia(labResults, episode?.patient?.hospitalId ?? "")];
    return combined.map((media) => {
      const override = mediaStatusOverrides[media.id];
      return override ? { ...media, status: override } : media;
    });
  }, [episode, labResults, mediaHistory, mediaStatusOverrides]);
  const patientNotes = useMemo(() => {
    const checkinNotes = checkins.flatMap((checkin) => buildPatientNotes(checkin as unknown as ApiRecord));
    const latestCheckinNotes = buildPatientNotes(episode?.latestCheckin ?? null);
    const timelineNotes = timelineEvents.map(buildTimelinePatientNote).filter((note): note is PatientNote => note !== null);
    return dedupePatientNotes([...checkinNotes, ...latestCheckinNotes, ...timelineNotes]);
  }, [checkins, episode, timelineEvents]);
  const filteredNotes = notesTab === "All" ? patientNotes : patientNotes.filter((note) => note.type === notesTab);
  const symptoms = useMemo(
    () => checkins.length
      ? checkins.flatMap((checkin) => buildSymptoms(checkin as unknown as ApiRecord))
      : buildSymptoms(episode?.latestCheckin ?? null),
    [checkins, episode],
  );

  const severeCount = symptoms.filter((symptom) => symptom.severity >= 7).length;
  const worseningCount = symptoms.filter((symptom) => symptom.trend === "Worsening").length;
  const improvingCount = symptoms.filter((symptom) => symptom.trend === "Improving").length;
  const missedDoseCount = medications.reduce((total, medication) => total + medication.missedCount, 0);
  const availableDataSources = [
    vitalCards.some((vital) => vital.display !== "--") ? "Vitals" : null,
    medications.length > 0 ? "Medication" : null,
    clinicalMedia.length > 0 ? "Clinical Media" : null,

    symptoms.length > 0 ? "Symptoms" : null,
    patientNotes.length > 0 ? "Patient Notes" : null,
  ].filter((source): source is string => Boolean(source));
  const summaryTags = [
    severeCount > 0 ? { label: "SEVERE SYMPTOMS", className: "bg-red-50 text-red-500" } : null,
    worseningCount > 0 ? { label: "WORSENING SYMPTOMS", className: "bg-red-50 text-red-500" } : null,
    missedDoseCount > 0 ? { label: "MISSED MEDICATIONS", className: "bg-amber-50 text-amber-500" } : null,
    clinicalMedia.length > 0 ? { label: "CLINICAL MEDIA", className: "bg-blue-50 text-primary" } : null,
  ].filter((tag): tag is { label: string; className: string } => Boolean(tag));
  const clinicalSummary = episode
    ? [
        (episode.patient?.name || "This patient") + " is being monitored for " + (episode.diagnosis || "an active care episode") + ".",
        episode.latestCheckin ? "The latest patient check-in was submitted " + checkinRelativeTime + "." : "No patient check-in has been submitted yet.",
        medications.length > 0 ? medications.length + " medication" + (medications.length === 1 ? " is" : "s are") + " tracked, with " + missedDoseCount + " missed dose" + (missedDoseCount === 1 ? "" : "s") + "." : "",
        symptoms.length > 0 ? symptoms.length + " symptom" + (symptoms.length === 1 ? " is" : "s are") + " currently reported." : "",
        clinicalMedia.length > 0 ? clinicalMedia.length + " image" + (clinicalMedia.length === 1 ? " is" : "s are") + " attached to the latest check-in." : "",
      ].filter(Boolean).join(" ")
    : "";
  const aiDisplaySummary = aiSummary?.summary || clinicalSummary;
  const aiKeyDrivers = aiSummary?.keyDrivers ?? [];
  const aiReviewAreas = aiSummary?.suggestedReview ?? [];

  if (isLoading && !episode) {
    return <SubHeaderSkeleton episodeId={episodeId} />;
  }

  if (error && !episode) {
    return (
      <div className="space-y-6">
        <SubHeaderSkeleton episodeId={episodeId} />
        <div className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-6 py-16 text-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm font-semibold text-red-600">{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRefreshKey((key) => key + 1)}
            className="rounded-lg border-red-300 text-red-600 hover:bg-red-100"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!episode) return null;

  return (
    <div className="space-y-6">
      <CareEpisodeSubHeader episodeId={episodeId} episode={episode} />

      <Card className="rounded-xl border-2 border-blue-200 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-base font-bold text-slate-900">AI Clinical Summary</h2>
            </div>
            <p className="text-xs font-medium text-slate-500">Generated from currently available episode data</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
            <div>
              <p className="text-sm font-medium leading-relaxed text-slate-700">{aiStatus === "loading" ? "Loading latest AI summary..." : aiDisplaySummary}</p>
              <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-primary">AI output is advisory only. Clinician review is required before care decisions.</p>
              {aiError ? <p className="mt-3 text-sm font-semibold text-red-500">{aiError}</p> : null}
              {aiDataNotice ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">{aiDataNotice}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {(aiSummary ? [{ label: aiSummary.recoveryStatus.toUpperCase(), className: "bg-blue-50 text-primary" }, { label: aiSummary.dataSufficiency.toUpperCase(), className: "bg-slate-100 text-slate-600" }] : summaryTags).map((tag) => (
                  <span key={tag.label} className={cn("rounded-full px-3 py-1 text-xs font-bold", tag.className)}>
                    {tag.label}
                  </span>
                ))}
                {aiSummary ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">{formatAiConfidence(aiSummary.confidence)}</span> : null}
              </div>
              {aiKeyDrivers.length > 0 || aiReviewAreas.length > 0 ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {aiKeyDrivers.length > 0 ? <div className="rounded-lg border border-border bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Key Drivers</p><ul className="mt-2 space-y-1 text-sm font-medium text-slate-700">{aiKeyDrivers.slice(0, 3).map((driver) => <li key={`${driver.factor}-${driver.direction}`}>- {driver.factor}: {driver.direction}{driver.evidence ? ` (${driver.evidence})` : ""}</li>)}</ul></div> : null}
                  {aiReviewAreas.length > 0 ? <div className="rounded-lg border border-border bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Suggested Review</p><ul className="mt-2 space-y-1 text-sm font-medium text-slate-700">{aiReviewAreas.slice(0, 3).map((item) => <li key={item}>- {item}</li>)}</ul></div> : null}
                </div>
              ) : null}
              <p className="mt-3 text-xs font-medium text-slate-500">Last AI update: {formatAiTimestamp(aiGeneratedAt)}{aiSuggestionId ? ` - Suggestion ${aiSuggestionId}` : ""}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  type="button"
                  disabled={aiStatus === "generating"}
                  onClick={generateSummary}
                  className="h-10 gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white hover:bg-primary/90"
                >
                  <Sparkles className="h-4 w-4" />
                  {aiStatus === "generating" ? "Generating..." : aiSummary ? "Refresh AI Summary" : "Generate AI Summary"}
                </Button>
                <Button asChild type="button" variant="outline" className="h-10 gap-2 rounded-lg px-4 text-sm font-bold">
                  <Link href={"/dashboard/care-episodes/" + episodeId + "/assessment"}>
                    <Plus className="h-4 w-4" />
                    Add Clinical Assessment
                  </Link>
                </Button>
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.04em] text-slate-500">Data Sources Integrated</p>
              <div className="grid grid-cols-2 gap-2">
                {availableDataSources.map((source) => (
                  <span key={source} className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    {source}
                  </span>
                ))}
                {availableDataSources.length === 0 ? (
                  <span className="col-span-2 text-sm font-medium text-slate-500">No integrated sources available yet.</span>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold leading-6 text-slate-900">Latest Recorded Vitals</h2>
              <p className="mt-0.5 text-xs font-medium text-slate-500">Logged via patient mobile app.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 pt-0.5 text-xs font-medium text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Last updated {checkinRelativeTime}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {vitalCards.map((vital) => (
              <div key={vital.key} className="flex min-h-[158px] flex-col rounded-lg border border-border bg-white p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary">
                    <vital.Icon className="h-4 w-4" />
                  </span>
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold leading-4", VITAL_STATUS_BADGE[vital.status])}>
                    {VITAL_STATUS_LABEL[vital.status]}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold leading-5 text-slate-700">{vital.label}</p>
                <p className="mt-0.5 text-2xl font-bold leading-8 text-slate-900">
                  {vital.display} <span className="text-xs font-medium text-slate-500">{vital.unit}</span>
                </p>
                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                  <p className="text-[11px] font-medium italic text-slate-500">{VITAL_STATUS_DESCRIPTION[vital.status]}</p>
                  <p className="shrink-0 text-right text-[11px] font-medium text-slate-500">{vital.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-bold text-slate-900">Biometric Trends</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMetricMenuOpen((open) => !open)}
                  className="flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  {biometricMetric}
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </button>
                {metricMenuOpen ? (
                  <div className="absolute right-0 z-10 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-white py-1 shadow-[0_16px_36px_rgba(15,23,42,0.16)]">
                    {BIOMETRIC_METRICS.map((metric) => (
                      <button
                        key={metric.label}
                        type="button"
                        onClick={() => {
                          setBiometricMetric(metric.label);
                          setMetricMenuOpen(false);
                        }}
                        className={cn(
                          "block w-full px-4 py-2 text-left text-sm font-medium hover:bg-slate-100",
                          biometricMetric === metric.label ? "text-primary" : "text-slate-700",
                        )}
                      >
                        {metric.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-bold">
                {BIOMETRIC_RANGES.map((range) => (
                  <button
                    key={range.key}
                    type="button"
                    onClick={() => setBiometricRange(range.key)}
                    className={cn(
                      "rounded-md px-3 py-1.5 transition-colors",
                      biometricRange === range.key ? "bg-primary text-white" : "text-slate-500 hover:text-slate-900",
                    )}
                  >
                    {range.key}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {vitalsLoading ? (
            <div className="mt-6 h-75 animate-pulse rounded-xl bg-slate-100" />
          ) : biometricData.length === 0 ? (
            <div className="mt-6 flex h-75 items-center justify-center rounded-xl border border-dashed border-border bg-slate-50 px-6 text-center">
              <p className="text-sm font-medium text-slate-500">No {biometricMetric.toLowerCase()} readings are available for this period.</p>
            </div>
          ) : (
          <div className="mt-6" style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={biometricData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="insightsBiometricFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-slate-100)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  tickFormatter={(value) => `${value} ${biometricUnit}`}
                  width={70}
                />
                <Tooltip formatter={(value) => [`${value} ${biometricUnit}`, biometricMetric]} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#insightsBiometricFill)"
                  dot={(dotProps: { cx?: number; cy?: number; payload?: BiometricPoint; index?: number }) => {
                    const { cx, cy, payload, index } = dotProps;
                    if (cx === undefined || cy === undefined) return <g key={index} />;
                    return (
                      <circle
                        key={index}
                        cx={cx}
                        cy={cy}
                        r={payload?.abnormal ? 5 : 3}
                        fill={payload?.abnormal ? "var(--color-red-500)" : "var(--color-primary)"}
                        stroke="var(--color-card)"
                        strokeWidth={1.5}
                      />
                    );
                  }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          )}

          {biometricData.length > 0 ? (
          <div className="mt-4 flex items-center gap-5 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Primary Metric
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Abnormal Spike Detected
            </span>
          </div>
          ) : null}

        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border-border bg-white shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <h2 className="text-base font-bold text-slate-900">Medication &amp; Adherence</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">Tap a medication to view side effects logged by the patient</p>

            <div className="mt-4 space-y-3">
              {medsLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-lg bg-slate-100" />
                ))
              ) : medications.length === 0 ? (
                <p className="py-6 text-center text-sm font-medium text-slate-500">No medications recorded for this episode.</p>
              ) : (
                medications.map((medication) => {
                  const status = getMedicationStatus(medication);
                  const isExpanded = expandedMedicationId === medication.medicationId;
                  return (
                    <div key={medication.medicationId} className="rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => toggleMedication(medication.medicationId)}
                        className="flex w-full flex-col gap-2 p-4 text-left"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-slate-900">
                            {medication.name}
                            {medication.dosageStrength ? (
                              <span className="ml-2 text-xs font-medium text-slate-500">{medication.dosageStrength}</span>
                            ) : null}
                          </p>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {medication.source ? (
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                                {formatMedicationSourceLabel(medication.source)}
                              </span>
                            ) : null}
                            <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", status.className)}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${medication.adherencePercentage}%`, backgroundColor: status.barColor }}
                            />
                          </div>
                          <span className="whitespace-nowrap text-xs font-bold text-slate-500">
                            {medication.adherencePercentage}% ADHERENCE
                          </span>
                        </div>
                      </button>
                      {isExpanded ? (
                        <div className="border-t border-slate-200 px-4 py-3">
                          <p className="mb-2 text-xs font-bold uppercase tracking-[0.04em] text-slate-500">
                            Dose Log History
                          </p>
                          {(() => {
                            const logState = medicationLogs[medication.medicationId];
                            if (!logState || logState === "loading") {
                              return <p className="text-sm font-medium text-slate-500">Loading dose history...</p>;
                            }
                            if (logState === "error") {
                              return <p className="text-sm font-medium text-red-500">Unable to load dose history.</p>;
                            }
                            if (logState.logs.length === 0) {
                              return <p className="text-sm font-medium text-slate-500">No doses logged yet.</p>;
                            }
                            return (
                              <ul className="space-y-2">
                                {logState.logs.map((log) => (
                                  <li key={log.id} className="flex items-start justify-between gap-3 text-sm">
                                    <div>
                                      <span className="font-semibold text-slate-900">{formatDateTimeLabel(log.loggedAt)}</span>
                                      {log.notes ? (
                                        <p className="mt-0.5 text-xs font-medium italic text-slate-500">{log.notes}</p>
                                      ) : null}
                                    </div>
                                    <span
                                      className={cn(
                                        "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase",
                                        log.action === "TAKEN"
                                          ? "bg-emerald-50 text-emerald-600"
                                          : log.action === "MISSED"
                                            ? "bg-red-50 text-red-500"
                                            : "bg-amber-50 text-amber-700",
                                      )}
                                    >
                                      {log.action}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            );
                          })()}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border bg-white shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Symptom Tracking</h2>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-primary">{symptoms.length} Active</span>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-500">Patient-reported - NRS 0-10 Pain/Severity scale</p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-red-50 py-2">
                <p className="text-lg font-bold text-red-500">{severeCount}</p>
                <p className="text-xs font-bold text-red-500">SEVERE</p>
              </div>
              <div className="rounded-lg bg-amber-50 py-2">
                <p className="text-lg font-bold text-amber-500">{worseningCount}</p>
                <p className="text-xs font-bold text-amber-500">WORSENING</p>
              </div>
              <div className="rounded-lg bg-emerald-50 py-2">
                <p className="text-lg font-bold text-emerald-500">{improvingCount}</p>
                <p className="text-xs font-bold text-emerald-500">IMPROVING</p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {symptoms.map((symptom) => (
                <div key={symptom.id}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">{symptom.name}</p>
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold", SYMPTOM_TREND_BADGE[symptom.trend])}>
                          {symptom.trend}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">{symptom.onset}</p>
                      {symptom.note ? <p className="text-xs font-medium text-slate-500">{symptom.note}</p> : null}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{symptom.severity}/10</p>
                      <p className="text-xs font-bold text-slate-500">{severityTier(symptom.severity)}</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${symptom.severity * 10}%` }}
                    />
                  </div>
                </div>
              ))}
              {symptoms.length === 0 ? (
                <p className="py-6 text-center text-sm font-medium text-slate-500">No symptoms were reported in the latest check-in.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <h2 className="text-base font-bold text-slate-900">Clinical Media</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Patient-uploaded images and laboratory documents for this care episode.</p>
          {mediaReviewError ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{mediaReviewError}</p> : null}
          {clinicalMedia.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-slate-500">No clinical media uploaded yet.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {clinicalMedia.map((media) => (
                <div key={media.id} className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="relative flex h-32 items-center justify-center overflow-hidden bg-slate-900">
                    {media.kind === "pdf" ? (
                      <FileText className="h-10 w-10 text-white/70" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={media.imageUrl} alt={media.title} className="h-full w-full object-cover" />
                    )}
                    <span className={cn("absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold", MEDIA_STATUS_BADGE[media.status])}>
                      {media.status}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-slate-900">{media.title}</p>
                    <p className="whitespace-nowrap text-[10px] font-medium text-slate-500">{media.uploadedAt}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => { void openClinicalMedia(media); }}
                        className="h-9 flex-1 rounded-lg bg-primary text-xs font-bold text-white hover:bg-primary/90"
                      >
                        View Details
                      </Button>
                      <a
                        href={media.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        aria-label={`Download ${media.title}`}
                        onClick={() => capturePostHogEvent("clinical_media_downloaded", { media_title: media.title })}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-slate-500 hover:bg-slate-50"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">Patient Notes</h2>
            <Tabs value={notesTab} onValueChange={(value) => setNotesTab(value as typeof notesTab)}>
              <TabsList className="rounded-lg bg-slate-100 p-1">
                {(["All", "Observation", "Symptom", "Concern"] as const).map((tab) => (
                  <TabsTrigger key={tab} value={tab} className="rounded-md px-3 text-xs font-bold">
                    {tab}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="mt-4 space-y-3">
            {filteredNotes.length === 0 ? (
              <p className="py-6 text-center text-sm font-medium text-slate-500">No patient notes recorded yet.</p>
            ) : null}
            {filteredNotes.map((note) => (
              <div key={note.id} className={cn("border-l-4 rounded-lg bg-slate-50 p-4", NOTE_TYPE_BORDER[note.type])}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", NOTE_TYPE_BADGE[note.type])}>
                    {note.type.toUpperCase()}
                  </span>
                  <span className="text-xs font-medium text-slate-500">{note.time}</span>
                </div>
                <p className="mt-2 text-sm font-medium italic text-slate-700">{note.text}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold", NOTE_TYPE_BADGE[note.type])}>
                    {note.linked}
                  </span>
                  <Link
                    href={`/dashboard/messages?${new URLSearchParams({
                      episodeId,
                      patientId: episode.patientId,
                      patientName: episode.patient?.name || "Patient",
                      content: note.text,
                      ...(note.type === "Symptom" ? { contextType: "symptom", contextId: note.id } : {}),
                    })}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Send Message
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <MediaViewerModal
        open={Boolean(activeMedia)}
        media={activeMedia ? toMediaViewerData(activeMedia) : null}
        onOpenChange={(open) => {
          if (!open) setActiveMedia(null);
        }}
      />
    </div>
  );
}
