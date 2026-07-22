"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";
import {
  asRecord,
  getCareEpisodeById,
  getCareEpisodeMedicationAdherence,
  getNumber,
  getString,
  type ApiRecord,
  type CareEpisodeDetail,
  type MedicationAdherenceRecord,
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
    label: "SpO2",
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
  NORMAL: "bg-[#F3F4F6] text-[#344054]",
  ELEVATED: "bg-[#FFECEC] text-[#EF4444]",
  LOW: "bg-[#E7F2FF] text-[#023E8A]",
  "--": "bg-[#F3F4F6] text-[#71809B]",
};

const VITAL_STATUS_DESCRIPTION: Record<VitalStatus, string> = {
  NORMAL: "Within expected range for this patient.",
  ELEVATED: "Above expected range — monitor closely.",
  LOW: "Below expected range — monitor closely.",
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

const DATA_SOURCES = ["Vitals", "Medication", "Clinical Media", "Symptoms", "Patient Notes", "Lab Results"];

const SUMMARY_TAGS = [
  { label: "SPO2 DECLINE", className: "bg-[#FFECEC] text-[#EF4444]" },
  { label: "MISSED MEDICATIONS", className: "bg-[#FFF4E5] text-[#F59E0B]" },
  { label: "WEIGHT GAIN", className: "bg-[#FFF4E5] text-[#F59E0B]" },
  { label: "WORSENING SYMPTOMS", className: "bg-[#FFECEC] text-[#EF4444]" },
];

const AI_SUMMARY_TEXT =
  "Recent patient data shows a rising resting heart rate trend, with readings increasing over the last 72 hours. Blood pressure remains mildly elevated, and the latest symptom logs show worsening shortness of breath and increased fatigue. Medication records show missed evening doses, while recent patient notes mention ankle swelling. One uploaded wound image is pending clinical review, and the latest lab result is awaiting interpretation.";

type SymptomTrend = "Worsening" | "Persistent" | "New" | "Improving";

const SYMPTOM_TREND_BADGE: Record<SymptomTrend, string> = {
  Worsening: "bg-[#FFECEC] text-[#EF4444]",
  Persistent: "bg-[#FFF4E5] text-[#F59E0B]",
  New: "bg-[#E7F2FF] text-[#023E8A]",
  Improving: "bg-[#DFFBF0] text-[#10B981]",
};

const SYMPTOMS: { id: string; name: string; severity: number; trend: SymptomTrend; onset: string; note: string }[] = [
  { id: "s1", name: "Shortness of breath", severity: 8, trend: "Worsening", onset: "Onset Today · 13:40", note: "Triggered after walking 50m" },
  { id: "s2", name: "Fatigue", severity: 6, trend: "Persistent", onset: "5th consecutive day reported", note: "" },
  { id: "s3", name: "Swelling (edema)", severity: 5, trend: "New", onset: "Onset Yesterday · 4:02 PM", note: "Bilateral ankle swelling" },
  { id: "s4", name: "Headache", severity: 3, trend: "Improving", onset: "Onset Yesterday · 11:30", note: "" },
];

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
  Reviewed: "bg-[#DFFBF0] text-[#10B981]",
  "Pending review": "bg-[#FFF4E5] text-[#F59E0B]",
};

function formatDateTimeLabel(value: string) {
  const parsed = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed)) return "--";
  const date = new Date(parsed);
  const datePart = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
  return `${datePart} · ${formatTime(value)}`;
}

// The care-episode API only exposes images attached to the patient's latest check-in
// (PatientCheckInDto.images) — there is no dedicated "list all clinical media" endpoint.
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
      title: `Check-in Upload ${index + 1}`,
      type: "Check-in Image",
      status: "Pending review" as const,
      priority: null,
      uploadedAt: formatDateTimeLabel(submittedAt),
      kind: "image" as const,
      captureContext: "Check-in Image",
      dateCaptured: formatDateTimeLabel(submittedAt),
      capturedAt: submittedAt,
      uploadTimestamp: submittedAt ? formatTime(submittedAt) : "--",
      patientId: patientCode,
      patientDescription: notes || "No description provided by patient.",
      imageUrl: url,
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
  Concern: "border-l-[#EF4444]",
  Observation: "border-l-[#023E8A]",
  Symptom: "border-l-[#F59E0B]",
};

const NOTE_TYPE_BADGE: Record<NoteType, string> = {
  Concern: "bg-[#FFECEC] text-[#EF4444]",
  Observation: "bg-[#E7F2FF] text-[#023E8A]",
  Symptom: "bg-[#FFF4E5] text-[#F59E0B]",
};

type PatientNote = { id: string; type: NoteType; text: string; linked: string; time: string };

// The API only exposes a single free-text note per check-in (PatientCheckInDto.notes) —
// there is no dedicated notes list/typing endpoint, so this surfaces the latest note as-is.
function buildPatientNotes(checkin: ApiRecord | null): PatientNote[] {
  if (!checkin) return [];
  const notes = getString(checkin, ["notes"]);
  if (!notes) return [];

  const submittedAt = getString(checkin, ["submittedAt"]);
  return [
    {
      id: submittedAt || "latest-note",
      type: "Observation",
      text: `"${notes}"`,
      linked: "LATEST CHECK-IN",
      time: submittedAt ? formatRelativeTime(submittedAt) : "--",
    },
  ];
}

function getMedicationStatus(medication: MedicationAdherenceRecord) {
  if (medication.totalDoses > 0 && medication.takenCount >= medication.totalDoses) {
    return { label: "Completed", className: "bg-[#DFFBF0] text-[#10B981]", barColor: "#10B981" };
  }
  if (medication.missedCount > 0) {
    return { label: "Missed", className: "bg-[#FFF4E5] text-[#F59E0B]", barColor: "#F59E0B" };
  }
  return { label: "Taken", className: "bg-[#DFFBF0] text-[#10B981]", barColor: "#10B981" };
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

  const [biometricMetric, setBiometricMetric] = useState<BiometricMetric>("Blood Pressure");
  const [biometricRange, setBiometricRange] = useState<BiometricRange>("14d");
  const [metricMenuOpen, setMetricMenuOpen] = useState(false);

  const [expandedMedicationId, setExpandedMedicationId] = useState<string | null>(null);
  const [notesTab, setNotesTab] = useState<"All" | NoteType>("All");
  const [activeMedia, setActiveMedia] = useState<ClinicalMediaItem | null>(null);

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
    () => buildBiometricData(biometricMetric, biometricRange, episodeId),
    [biometricMetric, biometricRange, episodeId],
  );
  const biometricUnit = BIOMETRIC_METRICS.find((item) => item.label === biometricMetric)?.unit ?? "";

  const vitalCards = useMemo(() => buildVitalCards(episode?.latestCheckin ?? null), [episode]);
  const checkinRelativeTime = formatRelativeTime(
    getString(episode?.latestCheckin ?? null, ["submittedAt", "recordedAt", "timestamp", "createdAt"]),
  );

  const clinicalMedia = useMemo(
    () => buildClinicalMedia(episode?.latestCheckin ?? null, episode?.patient?.hospitalId ?? ""),
    [episode],
  );
  const patientNotes = useMemo(() => buildPatientNotes(episode?.latestCheckin ?? null), [episode]);
  const filteredNotes = notesTab === "All" ? patientNotes : patientNotes.filter((note) => note.type === notesTab);

  const severeCount = SYMPTOMS.filter((symptom) => symptom.severity >= 7).length;
  const worseningCount = SYMPTOMS.filter((symptom) => symptom.trend === "Worsening").length;
  const improvingCount = SYMPTOMS.filter((symptom) => symptom.trend === "Improving").length;

  if (isLoading && !episode) {
    return <SubHeaderSkeleton />;
  }

  if (error && !episode) {
    return (
      <div className="space-y-6">
        <SubHeaderSkeleton />
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

      <Card className="rounded-xl border-2 border-[#BFDBFE] bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#023E8A]" />
              <h2 className="text-base font-bold text-[#111827]">AI Clinical Summary</h2>
            </div>
            <p className="text-xs font-medium text-[#71809B]">Updated 12 minutes ago • Confidence 92%</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
            <div>
              <p className="text-sm font-medium leading-relaxed text-[#344054]">{AI_SUMMARY_TEXT}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {SUMMARY_TAGS.map((tag) => (
                  <span key={tag.label} className={cn("rounded-full px-3 py-1 text-xs font-bold", tag.className)}>
                    {tag.label}
                  </span>
                ))}
              </div>
              <Button
                type="button"
                onClick={() => toast.info("Clinical assessments are coming soon.")}
                className="mt-5 h-10 gap-2 rounded-lg bg-[#023E8A] px-4 text-sm font-bold text-white hover:bg-[#023575]"
              >
                <Plus className="h-4 w-4" />
                Add Clinical Assessment
              </Button>
            </div>
            <div className="rounded-lg bg-[#F8FAFC] p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">Data Sources Integrated</p>
              <div className="grid grid-cols-2 gap-2">
                {DATA_SOURCES.map((source) => (
                  <span key={source} className="flex items-center gap-1.5 text-sm font-medium text-[#344054]">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
                    {source}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#111827]">Latest Recorded Vitals</h2>
            <p className="text-sm font-medium text-[#71809B]">Logged via patient mobile app</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#71809B]">
            <span className="h-2 w-2 rounded-full bg-[#10B981]" />
            Last updated {checkinRelativeTime}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {vitalCards.map((vital) => (
            <Card key={vital.key} className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E7F2FF] text-[#023E8A]">
                    <vital.Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", VITAL_STATUS_BADGE[vital.status])}>
                    {vital.status}
                  </span>
                </div>
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">{vital.label}</p>
                <p className="mt-1 text-2xl font-bold text-[#111827]">
                  {vital.display} <span className="text-sm font-medium text-[#71809B]">{vital.unit}</span>
                </p>
                <p className="mt-2 text-xs font-medium text-[#71809B]">{vital.time}</p>
                <p className="mt-1 text-xs font-medium text-[#71809B]">{VITAL_STATUS_DESCRIPTION[vital.status]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-bold text-[#111827]">Biometric Trends</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMetricMenuOpen((open) => !open)}
                  className="flex h-10 items-center gap-2 rounded-lg border border-[#DDE3EC] bg-white px-4 text-sm font-medium text-[#111827] hover:bg-[#F8FAFC]"
                >
                  {biometricMetric}
                  <ChevronDown className="h-4 w-4 text-[#71809B]" />
                </button>
                {metricMenuOpen ? (
                  <div className="absolute right-0 z-10 mt-2 w-44 overflow-hidden rounded-lg border border-[#DDE3EC] bg-white py-1 shadow-[0_16px_36px_rgba(15,23,42,0.16)]">
                    {BIOMETRIC_METRICS.map((metric) => (
                      <button
                        key={metric.label}
                        type="button"
                        onClick={() => {
                          setBiometricMetric(metric.label);
                          setMetricMenuOpen(false);
                        }}
                        className={cn(
                          "block w-full px-4 py-2 text-left text-sm font-medium hover:bg-[#F3F4F6]",
                          biometricMetric === metric.label ? "text-[#023E8A]" : "text-[#344054]",
                        )}
                      >
                        {metric.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex rounded-lg bg-[#F3F4F6] p-1 text-xs font-bold">
                {BIOMETRIC_RANGES.map((range) => (
                  <button
                    key={range.key}
                    type="button"
                    onClick={() => setBiometricRange(range.key)}
                    className={cn(
                      "rounded-md px-3 py-1.5 transition-colors",
                      biometricRange === range.key ? "bg-[#023E8A] text-white" : "text-[#71809B] hover:text-[#111827]",
                    )}
                  >
                    {range.key}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6" style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={biometricData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="insightsBiometricFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#023E8A" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#023E8A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#EEF1F6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#71809B", fontSize: 11 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#71809B", fontSize: 11 }}
                  tickFormatter={(value) => `${value} ${biometricUnit}`}
                  width={70}
                />
                <Tooltip formatter={(value) => [`${value} ${biometricUnit}`, biometricMetric]} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#023E8A"
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
                        fill={payload?.abnormal ? "#EF4444" : "#023E8A"}
                        stroke="#fff"
                        strokeWidth={1.5}
                      />
                    );
                  }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-center gap-5 text-xs font-medium text-[#71809B]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#023E8A]" />
              Primary Metric
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
              Abnormal Spike Detected
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <h2 className="text-base font-bold text-[#111827]">Medication &amp; Adherence</h2>
            <p className="mt-1 text-sm font-medium text-[#71809B]">Tap a medication to view side effects logged by the patient</p>

            <div className="mt-4 space-y-3">
              {medsLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-lg bg-[#F3F4F6]" />
                ))
              ) : medications.length === 0 ? (
                <p className="py-6 text-center text-sm font-medium text-[#71809B]">No medications recorded for this episode.</p>
              ) : (
                medications.map((medication) => {
                  const status = getMedicationStatus(medication);
                  const isExpanded = expandedMedicationId === medication.medicationId;
                  return (
                    <div key={medication.medicationId} className="rounded-lg border border-[#E5E7EB]">
                      <button
                        type="button"
                        onClick={() => setExpandedMedicationId(isExpanded ? null : medication.medicationId)}
                        className="flex w-full flex-col gap-2 p-4 text-left"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-[#111827]">
                            {medication.name}
                            {medication.dosageStrength ? (
                              <span className="ml-2 text-xs font-medium text-[#71809B]">{medication.dosageStrength}</span>
                            ) : null}
                          </p>
                          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", status.className)}>
                            {status.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${medication.adherencePercentage}%`, backgroundColor: status.barColor }}
                            />
                          </div>
                          <span className="whitespace-nowrap text-xs font-bold text-[#71809B]">
                            {medication.adherencePercentage}% ADHERENCE
                          </span>
                        </div>
                      </button>
                      {isExpanded ? (
                        <div className="border-t border-[#E5E7EB] px-4 py-3">
                          <p className="mb-2 text-xs font-bold uppercase tracking-[0.04em] text-[#71809B]">
                            Patient-Reported Side Effects
                          </p>
                          <p className="text-sm font-medium text-[#71809B]">
                            {medication.missedCount > 0
                              ? `${medication.missedCount} missed dose${medication.missedCount === 1 ? "" : "s"} logged. No side effects reported.`
                              : "No side effects reported."}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#111827]">Symptom Tracking</h2>
              <span className="rounded-full bg-[#E7F2FF] px-3 py-1 text-xs font-bold text-[#023E8A]">{SYMPTOMS.length} Active</span>
            </div>
            <p className="mt-1 text-sm font-medium text-[#71809B]">Patient-reported · NRS 0-10 Pain/Severity scale</p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-[#FFECEC] py-2">
                <p className="text-lg font-bold text-[#EF4444]">{severeCount}</p>
                <p className="text-xs font-bold text-[#EF4444]">SEVERE</p>
              </div>
              <div className="rounded-lg bg-[#FFF4E5] py-2">
                <p className="text-lg font-bold text-[#F59E0B]">{worseningCount}</p>
                <p className="text-xs font-bold text-[#F59E0B]">WORSENING</p>
              </div>
              <div className="rounded-lg bg-[#DFFBF0] py-2">
                <p className="text-lg font-bold text-[#10B981]">{improvingCount}</p>
                <p className="text-xs font-bold text-[#10B981]">IMPROVING</p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {SYMPTOMS.map((symptom) => (
                <div key={symptom.id}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-[#111827]">{symptom.name}</p>
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold", SYMPTOM_TREND_BADGE[symptom.trend])}>
                          {symptom.trend}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-[#71809B]">{symptom.onset}</p>
                      {symptom.note ? <p className="text-xs font-medium text-[#71809B]">{symptom.note}</p> : null}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#111827]">{symptom.severity}/10</p>
                      <p className="text-xs font-bold text-[#71809B]">{severityTier(symptom.severity)}</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                    <div
                      className="h-full rounded-full bg-[#023E8A]"
                      style={{ width: `${symptom.severity * 10}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <h2 className="text-base font-bold text-[#111827]">Clinical Media</h2>
          <p className="mt-1 text-sm font-medium text-[#71809B]">Images attached to the patient&apos;s latest check-in</p>
          {clinicalMedia.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-[#71809B]">No clinical media uploaded yet.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {clinicalMedia.map((media) => (
                <div key={media.id} className="overflow-hidden rounded-xl border border-[#E5E7EB]">
                  <div className="relative flex h-32 items-center justify-center overflow-hidden bg-[#0F172A]">
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
                    <p className="text-sm font-bold text-[#111827]">{media.title}</p>
                    <p className="text-xs font-medium text-[#71809B]">UPLOADED {media.uploadedAt}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => setActiveMedia(media)}
                        className="h-9 flex-1 rounded-lg bg-[#023E8A] text-xs font-bold text-white hover:bg-[#023575]"
                      >
                        View Details
                      </Button>
                      <a
                        href={media.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#DDE3EC] text-[#71809B] hover:bg-[#F8FAFC]"
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

      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#111827]">Patient Notes</h2>
            <Tabs value={notesTab} onValueChange={(value) => setNotesTab(value as typeof notesTab)}>
              <TabsList className="rounded-lg bg-[#F3F4F6] p-1">
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
              <p className="py-6 text-center text-sm font-medium text-[#71809B]">No patient notes recorded yet.</p>
            ) : null}
            {filteredNotes.map((note) => (
              <div key={note.id} className={cn("border-l-4 rounded-lg bg-[#F8FAFC] p-4", NOTE_TYPE_BORDER[note.type])}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", NOTE_TYPE_BADGE[note.type])}>
                    {note.type.toUpperCase()}
                  </span>
                  <span className="text-xs font-medium text-[#71809B]">{note.time}</span>
                </div>
                <p className="mt-2 text-sm font-medium italic text-[#344054]">{note.text}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold", NOTE_TYPE_BADGE[note.type])}>
                    {note.linked}
                  </span>
                  <button
                    type="button"
                    onClick={() => toast.info("Messaging is coming soon.")}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#023E8A]"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Send Message
                  </button>
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
