"use client";

import { useEffect, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  Activity,
  CalendarDays,
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  FileText,
  Clock3,
  Loader2,
  Sheet,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  downloadServerReportExport,
  getReportCatalog,
  getExportDateRange,
  type ReportsSnapshot,
  type FacilityReportExportId,
  type ReportCatalogEntry,
} from "@/lib/api/reports";
import { cn } from "@/lib/utils";
import {
  type OutputFormat,
  type ReportType,
} from "../report-export";

export type { ReportType } from "../report-export";

interface ExportReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPeriod: string;
  initialReportType?: ReportType;
  snapshot: ReportsSnapshot | null;
}

interface ReportDefinition {
  type: ReportType;
  title: string;
  description: string;
  scope: "ENTITY-SCOPED" | "FACILITY-SCOPED";
  icon: typeof FileText;
}

const REPORTS: ReportDefinition[] = [
  {
    type: "closed-episode",
    title: "Patient Closed Episode Summary",
    description: "Recovery handoff for a closed care episode",
    scope: "ENTITY-SCOPED",
    icon: FileText,
  },
  {
    type: "connected-patients",
    title: "Connected Patients Report",
    description: "Approved patient connections for this facility",
    scope: "FACILITY-SCOPED",
    icon: Users,
  },
  {
    type: "active-care-episodes",
    title: "Active Care Episodes Report",
    description: "Facility-wide active care episode list",
    scope: "FACILITY-SCOPED",
    icon: Activity,
  },
  {
    type: "pending-care-episodes",
    title: "Pending Care Episodes Report",
    description: "Facility-wide pending-action episode list",
    scope: "FACILITY-SCOPED",
    icon: Clock3,
  },
  {
    type: "closed-care-episodes",
    title: "Closed Care Episodes Report",
    description: "Facility-wide closed care episode list",
    scope: "FACILITY-SCOPED",
    icon: FileText,
  },
  {
    type: "alert-response",
    title: "Alert Response Performance",
    description: "Facility-wide alert triage timing and SLA",
    scope: "FACILITY-SCOPED",
    icon: TriangleAlert,
  },
  {
    type: "appointment-activity",
    title: "Appointment Activity Report",
    description: "Facility-wide bookings, attendance and cancellations",
    scope: "FACILITY-SCOPED",
    icon: CalendarDays,
  },
  {
    type: "clinician-workload",
    title: "Clinician Workload Report",
    description: "Single clinician or aggregated across the facility",
    scope: "FACILITY-SCOPED",
    icon: Users,
  },
];

const TIME_RANGES = ["Last 7 days", "Last 30 days", "Last 90 days", "Last 12 months"];

const SERVER_REPORT_IDS: Partial<Record<ReportType, ReportCatalogEntry["report"]>> = {
  "closed-episode": "patient_closed_episode_summary",
  "connected-patients": "connected_patients",
  "active-care-episodes": "active_care_episodes",
  "pending-care-episodes": "pending_care_episodes",
  "closed-care-episodes": "closed_care_episodes",
  "alert-response": "alert_response",
  "appointment-activity": "appointment_activity",
  "clinician-workload": "clinician_workload",
};

const FALLBACK_FORMATS: Record<ReportType, OutputFormat[]> = {
  "closed-episode": ["PDF"],
  "connected-patients": ["Excel"],
  "active-care-episodes": ["Excel"],
  "pending-care-episodes": ["Excel"],
  "closed-care-episodes": ["Excel"],
  "alert-response": ["PDF", "Excel", "CSV"],
  "appointment-activity": ["PDF", "Excel", "CSV"],
  "clinician-workload": ["PDF", "Excel"],
};

const FACILITY_REPORT_IDS: Partial<Record<ReportType, FacilityReportExportId>> = {
  "connected-patients": "connected_patients",
  "active-care-episodes": "active_care_episodes",
  "pending-care-episodes": "pending_care_episodes",
  "closed-care-episodes": "closed_care_episodes",
};

const DETAIL_OPTIONS: Partial<Record<Exclude<ReportType, "closed-episode">, string[]>> = {
  "alert-response": ["Response time trend", "Breakdown by severity", "Per-clinician breakdown"],
  "appointment-activity": ["No-shows & cancellations", "Per-department breakdown", "Booking trend"],
  "clinician-workload": ["Active episodes", "Open alerts", "Average response time"],
};

function formatReportDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function getScopeLabel(scope: ReportDefinition["scope"]) {
  return scope === "ENTITY-SCOPED" ? "Single care episode" : "Your facility";
}
function getDefaultIncluded(reportType?: ReportType) {
  const options = reportType && reportType !== "closed-episode" ? DETAIL_OPTIONS[reportType] ?? [] : [];
  return Object.fromEntries(
    options.map((option, index) => [option, reportType === "alert-response" ? index < 2 : true]),
  );
}

function ReportCard({ report, onSelect }: { report: ReportDefinition; onSelect: () => void }) {
  const Icon = report.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-24 w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-blue-600">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{report.title}</span>
        <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{report.description}</span>
        <span className="mt-1.5 block text-[10px] tracking-wide text-muted-foreground/75">{getScopeLabel(report.scope)}</span>
      </span>
    </button>
  );
}

function OutputFormatPicker({
  value,
  onChange,
  allowedFormats,
  excelOnly = false,
}: {
  value: OutputFormat;
  onChange: (format: OutputFormat) => void;
  allowedFormats?: OutputFormat[];
  excelOnly?: boolean;
}) {
  const formats: Array<{ value: OutputFormat; icon: typeof FileDown }> = allowedFormats?.length
    ? allowedFormats.map((format) => ({
        value: format,
        icon: format === "Excel" ? FileSpreadsheet : format === "CSV" ? Sheet : FileDown,
      }))
    : excelOnly
    ? [{ value: "Excel", icon: FileSpreadsheet }]
    : [
        { value: "PDF", icon: FileDown },
        { value: "CSV", icon: Sheet },
        { value: "Excel", icon: FileSpreadsheet },
      ];

  return (
    <fieldset>
      <legend className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Output Format
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {formats.map(({ value: format, icon: Icon }) => (
          <button
            key={format}
            type="button"
            aria-pressed={value === format}
            onClick={() => onChange(format)}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === format
                ? "border-primary bg-blue-100 text-primary"
                : "border-muted-foreground/40 bg-card text-muted-foreground hover:border-primary/50",
            )}
          >
            <Icon className="h-4 w-4" />
            {format}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${label}: ${checked ? "included" : "excluded"}`}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          checked ? "bg-primary" : "bg-slate-200",
        )}
      >
        <span
          className={cn(
            "absolute left-0 top-0.5 h-5 w-5 rounded-full bg-card shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs text-muted-foreground">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-lg border border-input bg-card px-3 pr-10 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </span>
    </label>
  );
}

function getExportErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to generate the report.";
  const normalized = message.toLowerCase();
  if (normalized.includes("forbidden") || normalized.includes("permission") || normalized.includes("unauthorized")) {
    return "You do not have permission to export this report.";
  }
  if (normalized.includes("invalid") || normalized.includes("unsupported") || normalized.includes("filter") || normalized.includes("date")) {
    return "Review the selected date range or filters and try again.";
  }
  if (normalized.includes("not found") || normalized.includes("unavailable")) {
    return "This report is currently unavailable.";
  }
  if (normalized.includes("empty") || normalized.includes("no data") || normalized.includes("no records")) {
    return "No records match the selected range or filters.";
  }
  return `Export failed: ${message}`;
}

export default function ExportReportModal({
  open,
  onOpenChange,
  defaultPeriod,
  initialReportType,
  snapshot,
}: ExportReportModalProps) {
  const [selectedType, setSelectedType] = useState<ReportType | null>(initialReportType ?? null);
  const [format, setFormat] = useState<OutputFormat>("PDF");
  const [timeRange, setTimeRange] = useState(
    defaultPeriod === "7 days" ? "Last 7 days" : "Last 30 days",
  );
  const [episodeId, setEpisodeId] = useState("");
  const [clinicianId, setClinicianId] = useState("all");
  const [included, setIncluded] = useState<Record<string, boolean>>(
    () => getDefaultIncluded(initialReportType),
  );
  const [validationError, setValidationError] = useState("");
  const [generated, setGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [reportCatalog, setReportCatalog] = useState<ReportCatalogEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    getReportCatalog().then((catalog) => {
      if (active) setReportCatalog(catalog);
    }).catch(() => {
      if (active) setReportCatalog([]);
    });
    return () => {
      active = false;
    };
  }, [open]);

  function resetDetailState(reportType?: ReportType) {
    setFormat(reportType && FACILITY_REPORT_IDS[reportType] ? "Excel" : "PDF");
    setEpisodeId("");
    setClinicianId("all");
    setValidationError("");
    setGenerated(false);
    setIncluded(getDefaultIncluded(reportType));
  }

  function selectReport(reportType: ReportType) {
    setSelectedType(reportType);
    setTimeRange(defaultPeriod === "7 days" ? "Last 7 days" : "Last 30 days");
    resetDetailState(reportType);
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      window.setTimeout(() => {
        setSelectedType(initialReportType ?? null);
        resetDetailState(initialReportType);
      }, 150);
    }
  }

  async function handleGenerate() {
    if (!selectedType) return;
    if (selectedType === "closed-episode" && !episodeId) {
      setValidationError("Select a closed care episode to generate this report.");
      return;
    }

    setIsGenerating(true);
    setValidationError("");

    try {
      const exportRange = getExportDateRange(timeRange);
      const serverReport = SERVER_REPORT_IDS[selectedType];
      if (!serverReport) throw new Error("This report is unavailable.");
      const formatValue = format === "Excel" ? "xlsx" : format === "CSV" ? "csv" : "pdf";
      await downloadServerReportExport(exportRange, {
        report: serverReport,
        format: formatValue,
        filters: selectedType === "closed-episode" ? { episodeId } : undefined,
      });

      capturePostHogEvent("reports_exported", {
        report_type: selectedType,
        format: format.toLowerCase(),
        time_range: timeRange,
        facility_id: snapshot?.facility.id,
      });
      if (selectedType === "clinician-workload") {
        capturePostHogEvent("clinician_workload_exported", {
          report_type: "clinician_workload",
          format: format.toLowerCase(),
          time_range: timeRange,
          facility_id: snapshot?.facility.id,
        });
      }
      setGenerated(true);
      window.setTimeout(() => setGenerated(false), 1600);
    } catch (error) {
      setValidationError(getExportErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  }

  const selectedReport = REPORTS.find((report) => report.type === selectedType);
  const selectedBackendReport = selectedType ? SERVER_REPORT_IDS[selectedType] : undefined;
  const catalogEntry = reportCatalog.find((entry) => entry.report === selectedBackendReport);
  const allowedFormats = catalogEntry?.formats.map((format): OutputFormat =>
    format === "xlsx" ? "Excel" : format === "csv" ? "CSV" : "PDF",
  ) ?? (selectedType ? FALLBACK_FORMATS[selectedType] : undefined);
  const detailOptions =
    selectedType && selectedType !== "closed-episode" ? DETAIL_OPTIONS[selectedType] ?? [] : [];
  const closedEpisodes = snapshot?.careEpisodes.filter((episode) => episode.status === "closed") ?? [];
  const isEmptyClosedReport = selectedType === "closed-episode" && closedEpisodes.length === 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby="report-dialog-description"
          className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-card shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <header className="flex items-start gap-3 border-b border-border bg-primary/[0.025] px-6 py-5">
            {selectedReport ? (
              <button
                type="button"
                aria-label="Back to report selection"
                onClick={() => setSelectedType(null)}
                className="mt-0.5 rounded-md text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : null}
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-xl font-semibold text-foreground">
                {selectedReport?.title ?? "Export Report"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                id="report-dialog-description"
                className="mt-0.5 text-xs text-muted-foreground"
              >
                {selectedReport
                  ? `${selectedReport.scope === "ENTITY-SCOPED" ? "Single care episode" : "Your facility"} · ${selectedReport.description}`
                  : "Generate clinical and operational reports"}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="ml-auto rounded-md p-1 text-foreground/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="h-5 w-5" />
              <span className="sr-only">Close export report</span>
            </DialogPrimitive.Close>
          </header>

          {!selectedReport ? (
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-foreground">
                Clinical Reports
              </p>
              <div className="max-w-xs">
                <ReportCard report={REPORTS[0]} onSelect={() => selectReport(REPORTS[0].type)} />
              </div>
              <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.08em] text-foreground">
                Patient &amp; Care Episode Reports
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {REPORTS.slice(1, 5).map((report) => (
                  <ReportCard key={report.type} report={report} onSelect={() => selectReport(report.type)} />
                ))}
              </div>
              <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.08em] text-foreground">
                Operational Reports
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {REPORTS.slice(5).map((report) => (
                  <ReportCard key={report.type} report={report} onSelect={() => selectReport(report.type)} />
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-[66vh] space-y-5 overflow-y-auto px-6 py-5">
                {selectedType === "closed-episode" ? (
                  <div>
                    <label
                      htmlFor="report-episode-scope"
                      className="mb-3 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      Scope
                    </label>
                    <select
                      id="report-episode-scope"
                      value={episodeId}
                      onChange={(event) => {
                        setEpisodeId(event.target.value);
                        if (validationError) setValidationError("");
                      }}
                      className="h-11 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Select a closed care episode</option>
                      {closedEpisodes.map((episode) => (
                        <option key={episode.id} value={episode.id}>
                          {episode.id} · {episode.diagnosis}
                        </option>
                      ))}
                    </select>
                    {closedEpisodes.length === 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        No closed care episodes match the selected reporting period.
                      </p>
                    ) : null}
                    <div className="mt-4 rounded-lg border border-border bg-primary/[0.025] px-3 py-2.5 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Reporting period:</span>{" "}
                      {formatReportDate(getExportDateRange(timeRange).dateFrom)} – {formatReportDate(getExportDateRange(timeRange).dateTo)}
                    </div>
                  </div>
                ) : (
                  <>
                    {selectedType === "clinician-workload" ? (
                      <div>
                        <SelectField label="Clinician" value={clinicianId} onChange={setClinicianId}>
                          <option value="all">All clinicians (aggregated)</option>
                          {snapshot?.clinicians.map((clinician) => (
                            <option key={clinician.id} value={clinician.id}>{clinician.name}</option>
                          ))}
                        </SelectField>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {clinicianId === "all"
                            ? "Aggregated report across facility clinicians."
                            : "Individual clinician workload report."}
                        </p>
                       </div>
                    ) : (
                      <p className="rounded-lg border border-border bg-card px-3 py-3 text-xs text-muted-foreground">
                        This report is restricted to {snapshot?.facility.name ?? "your authenticated facility"}.
                      </p>
                    )}
                    <SelectField label="Time Range (required)" value={timeRange} onChange={setTimeRange}>
                      {TIME_RANGES.map((range) => <option key={range}>{range}</option>)}
                    </SelectField>
                    <div className="rounded-lg border border-border bg-primary/[0.025] px-3 py-2.5 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Reporting period:</span>{" "}
                      {formatReportDate(getExportDateRange(timeRange).dateFrom)} – {formatReportDate(getExportDateRange(timeRange).dateTo)}
                    </div>
                    {detailOptions.length > 0 ? (
                      <div className="border-y border-border py-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Include in Report
                        </p>
                        {detailOptions.map((option) => (
                          <ToggleRow
                            key={option}
                            label={option}
                            checked={Boolean(included[option])}
                            onCheckedChange={(checked) =>
                              setIncluded((current) => ({ ...current, [option]: checked }))
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                  </>
                )}

                <OutputFormatPicker
                  value={format}
                  onChange={setFormat}
                  allowedFormats={allowedFormats}
                  excelOnly={Boolean(selectedType && FACILITY_REPORT_IDS[selectedType])}
                />

                {validationError ? (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-600"
                  >
                    <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]">
                      !
                    </span>
                    {validationError}
                  </p>
                ) : null}
              </div>

              <footer className="flex items-center justify-end gap-6 border-t border-border bg-primary/[0.025] px-6 py-4">
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="text-sm font-semibold text-slate-600 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating || isEmptyClosedReport}
                  className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isGenerating ? "Generating…" : generated ? "Report Generated" : "Generate Report"}
                </button>
              </footer>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}




