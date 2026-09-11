"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  Stethoscope,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  getCareEpisodeById,
  getCareEpisodeMedicationAdherence,
  getCareEpisodeTaskCompletionLog,
  getCareEpisodeTimelinePage,
  getString,
  type CareEpisodeDetail,
  type MedicationAdherenceRecord,
  type TaskCompletionLog,
  type TimelineEventRecord,
} from "@/lib/api/care-episodes";
import { CareEpisodeSubHeader, SubHeaderSkeleton } from "../_shared/SubHeader";
import { formatTime, humanizeSlug } from "../_shared/utils";
import {
  buildMedicationCompletionTimelineEvents,
  mergeTimelineWithMedicationCompletionEvents,
} from "../_shared/taskCompletion";

type EventCategory = "critical" | "completed" | "clinician" | "missed" | "pending";

const PAGE_SIZE = 10;

type EventTypeOption = { value: string; label: string };

const EVENT_TYPE_OPTIONS: EventTypeOption[] = [
  { value: "medication_taken", label: "Medication" },
  { value: "clinical_assessment", label: "Clinical Assessment" },
  { value: "follow_up_scheduled", label: "Follow-up Appointment" },
  { value: "message_sent", label: "Messaging" },
  { value: "ai_follow_up", label: "AI Follow-up Agent" },
  { value: "alert_acknowledged", label: "Alert Acknowledged" },
];

function getEventCategory(event: TimelineEventRecord): EventCategory {
  const status = event.status.toLowerCase().replace(/[\s-]+/g, "_");
  const source = event.source.toLowerCase();
  const eventType = event.eventType.toLowerCase().replace(/[\s-]+/g, "_");

  if (eventType.includes("alert_acknowledged")) return source.includes("clinician") ? "clinician" : "completed";
  if (status === "critical" || (eventType.includes("alert") && !eventType.includes("acknowledged")) || eventType.includes("escalation")) return "critical";
  if (status === "missed" || status.includes("fail") || status.includes("not_reach")) return "missed";
  if (status === "pending") return "pending";
  if (source === "clinician" || eventType.includes("clinician")) return "clinician";
  return "completed";
}

const CATEGORY_ICON: Record<EventCategory, { Icon: typeof AlertCircle; className: string }> = {
  critical: { Icon: AlertCircle, className: "bg-destructive/10 text-destructive" },
  completed: { Icon: CheckCircle2, className: "bg-emerald-50 text-emerald-600" },
  clinician: { Icon: Stethoscope, className: "bg-primary/10 text-primary" },
  missed: { Icon: X, className: "bg-amber-50 text-amber-600" },
  pending: { Icon: Clock, className: "bg-muted text-muted-foreground" },
};

const CATEGORY_LABEL: Record<EventCategory, string> = {
  critical: "Critical",
  completed: "Completed",
  clinician: "Completed",
  missed: "Missed",
  pending: "Pending",
};

const CATEGORY_BADGE: Record<EventCategory, string> = {
  critical: "bg-destructive/10 text-destructive",
  completed: "bg-emerald-50 text-emerald-600",
  clinician: "bg-emerald-50 text-emerald-600",
  missed: "bg-amber-50 text-amber-600",
  pending: "bg-muted text-muted-foreground",
};

const SOURCE_LABEL: Record<string, string> = {
  system: "System",
  patient: "Patient",
  patient_app: "Patient App",
  patientapp: "Patient App",
  clinician: "Clinician",
  ai_follow_up: "AI Follow-up Agent",
  ai_follow_up_agent: "AI Follow-up Agent",
  ai_followup_agent: "AI Follow-up Agent",
  appointment_module: "Appointment",
};

function getSourceLabel(source: string) {
  const key = source.toLowerCase().replace(/[\s-]+/g, "_");
  return SOURCE_LABEL[key] ?? (humanizeSlug(source) || "System");
}

function hasMeaningfulTimelineValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasMeaningfulTimelineValue);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).some(hasMeaningfulTimelineValue);
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return Boolean(normalized) && !["0", "false", "none", "null", "n/a", "na"].includes(normalized);
  }
  return false;
}

function getPositiveSummaryCount(summary: string, terms: string[]) {
  for (const term of terms) {
    const match = summary.match(new RegExp("(\\d+)\\s+" + term));
    if (match) return Number(match[1]) > 0;
  }
  return null;
}

function getCheckinTitle(payload: Record<string, unknown>, summary: string) {
  const symptomsFromPayload = ["symptoms", "symptomCount", "symptomsCount"].some((key) => hasMeaningfulTimelineValue(payload[key]));
  const vitalsFromPayload = ["vitals", "vitalCount", "vitalsCount"].some((key) => hasMeaningfulTimelineValue(payload[key]));
  const symptomsFromSummary = getPositiveSummaryCount(summary, ["symptoms?", "symptom"]);
  const vitalsFromSummary = getPositiveSummaryCount(summary, ["vitals?", "vital"]);
  const hasSymptoms = symptomsFromPayload || symptomsFromSummary === true ||
    (symptomsFromSummary === null && summary.includes("symptom") && !summary.includes("no symptom"));
  const hasVitals = vitalsFromPayload || vitalsFromSummary === true ||
    (vitalsFromSummary === null && summary.includes("vital") && !summary.includes("no vital"));

  if (hasSymptoms && hasVitals) return "Symptom and vitals check-in submitted";
  if (hasSymptoms) return "Symptom check-in submitted";
  if (hasVitals) return "Vitals submitted";
  return "Daily check-in submitted";
}

function getEventTypeLabel(eventType: string) {
  const key = eventType.toLowerCase().replace(/[\s-]+/g, "_");
  if (key.includes("patient_note")) return "Patient Note";
  if (key.includes("checkin") || key.includes("check_in")) return "Check-in";
  if (key.includes("medication")) return "Medication";
  if (key.includes("clinical_assessment") || key.includes("assessment")) return "Clinical Assessment";
  if (key.includes("follow_up") || key.includes("followup")) return "Follow-up";
  if (key.includes("message")) return "Messaging";
  if (key.includes("ai_follow")) return "Follow-up";
  if (key.includes("alert")) return "Alert";
  return humanizeSlug(eventType) || "Update";
}
function getEventTitle(event: TimelineEventRecord) {
  const eventType = event.eventType.toLowerCase().replace(/[\s-]+/g, "_");
  const payload = event.payload;
  const payloadSummary = getString(payload, ["message", "title", "details", "description", "summary"]);
  const summary = `${eventType} ${payloadSummary}`.toLowerCase();

  if (eventType.includes("patient_note")) return "Patient note added";
  if (eventType.includes("message")) return "Message sent";
  if (eventType.includes("checkin") || eventType.includes("check_in") || summary.includes("daily check-in") || summary.includes("daily check in")) {
    return getCheckinTitle(payload, summary);
  }
  if (eventType.includes("clinical_assessment") || eventType.includes("assessment")) return "Clinical assessment recorded";
  if (eventType.includes("follow_up") || eventType.includes("followup")) return "Follow-up appointment scheduled";
  if (eventType.includes("medication")) return "Medication recorded";
  if (eventType.includes("ai_follow")) {
    const status = event.status.toLowerCase().replace(/[\s-]+/g, "_");
    return ["failed", "missed", "not_reached", "unsuccessful"].some((value) => status.includes(value))
      ? "AI follow-up unsuccessful"
      : "AI follow-up completed";
  }
  if (eventType.includes("alert") && eventType.includes("acknowledged")) return "Alert acknowledged";
  return humanizeSlug(event.eventType) || "Update";
}

function getEventStatusLabel(event: TimelineEventRecord, category: EventCategory) {
  const status = event.status.toLowerCase().replace(/[\s-]+/g, "_");
  const eventType = event.eventType.toLowerCase().replace(/[\s-]+/g, "_");
  if (eventType.includes("ai_follow") && (status.includes("failed") || status.includes("missed") || status.includes("not_reach") || status.includes("unsuccessful"))) {
    return "Not reached";
  }
  if (eventType.includes("alert_acknowledged")) return "Completed";
  return CATEGORY_LABEL[category];
}
function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getGroupLabel(timestamp: string) {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return "Earlier";
  const date = new Date(parsed);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date).toUpperCase();
}

export default function CareEpisodeTimelinePage() {
  const params = useParams<{ id: string }>();
  const episodeId = params?.id ?? "";

  const [episode, setEpisode] = useState<CareEpisodeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [events, setEvents] = useState<TimelineEventRecord[]>([]);
  const [medicationRecords, setMedicationRecords] = useState<MedicationAdherenceRecord[]>([]);
  const [taskCompletionLog, setTaskCompletionLog] = useState<TaskCompletionLog | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Unfiltered snapshot used only to populate the filter dropdowns with the full set of
  // known statuses/event types/sources, independent of whatever filters/page are active.
  const [filterOptionEvents, setFilterOptionEvents] = useState<TimelineEventRecord[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [eventTypeFilter, setEventTypeFilter] = useState("Event Types");
  const [sourceFilter, setSourceFilter] = useState("Source");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (episodeId) capturePostHogEvent("care_timeline_viewed", { episode_id: episodeId });
  }, [episodeId]);

  useEffect(() => {
    if (!episodeId || (statusFilter === "All Status" && eventTypeFilter === "Event Types" && sourceFilter === "Source" && !dateFilter)) return;
    capturePostHogEvent("care_timeline_filtered", {
      episode_id: episodeId,
      status: statusFilter,
      event_type: eventTypeFilter,
      source: sourceFilter,
      date: dateFilter || undefined,
    });
  }, [dateFilter, episodeId, eventTypeFilter, sourceFilter, statusFilter]);

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
    getCareEpisodeMedicationAdherence(episodeId)
      .then((records) => {
        if (!ignore) setMedicationRecords(records);
      })
      .catch(() => {
        if (!ignore) setMedicationRecords([]);
      });
    return () => {
      ignore = true;
    };
  }, [episodeId, refreshKey]);

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;
    const selectedDate = dateFilter || localDateKey(new Date());
    getCareEpisodeTaskCompletionLog(episodeId, selectedDate)
      .then((log) => {
        if (!ignore) setTaskCompletionLog(log);
      })
      .catch(() => {
        if (!ignore) setTaskCompletionLog(null);
      });
    return () => {
      ignore = true;
    };
  }, [dateFilter, episodeId, refreshKey]);

  useEffect(() => {
    if (!episodeId) return;
    let ignore = false;

    (async () => {
      try {
        const response = await getCareEpisodeTimelinePage(episodeId, { limit: 200 });
        if (!ignore) setFilterOptionEvents(response.data);
      } catch {
        if (!ignore) setFilterOptionEvents([]);
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
      setTimelineLoading(true);
      try {
        const response = await getCareEpisodeTimelinePage(episodeId, {
          page,
          limit: PAGE_SIZE,
          eventType: eventTypeFilter === "Event Types" ? undefined : eventTypeFilter,
          source: sourceFilter === "Source" ? undefined : sourceFilter,
          status: statusFilter === "All Status" ? undefined : statusFilter,
          dateFrom: dateFilter || undefined,
          dateTo: dateFilter || undefined,
        });
        if (ignore) return;
        setEvents(response.data);
        setTotalEvents(response.total);
        setTotalPages(Math.max(response.totalPages, 1));
      } catch {
        if (!ignore) {
          setEvents([]);
          setTotalEvents(0);
          setTotalPages(1);
        }
      } finally {
        if (!ignore) setTimelineLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [episodeId, page, statusFilter, eventTypeFilter, sourceFilter, dateFilter, refreshKey]);

  const timelineDate = dateFilter || localDateKey(new Date());
  const medicationCompletionEvents = useMemo(() => {
    if (!episode) return [];
    return buildMedicationCompletionTimelineEvents(episode.id || episodeId, episode.currentCarePlan, taskCompletionLog, medicationRecords, timelineDate);
  }, [episode, episodeId, medicationRecords, taskCompletionLog, timelineDate]);
  const filterOptionEventsWithMedication = useMemo(
    () => mergeTimelineWithMedicationCompletionEvents(filterOptionEvents, medicationCompletionEvents),
    [filterOptionEvents, medicationCompletionEvents],
  );
  const eventsWithMedicationCompletion = useMemo(() => {
    const filteredMedicationEvents = medicationCompletionEvents.filter((event) => {
      if (statusFilter !== "All Status" && event.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (eventTypeFilter !== "Event Types" && event.eventType !== eventTypeFilter) return false;
      if (sourceFilter !== "Source" && event.source !== sourceFilter) return false;
      return true;
    });
    return mergeTimelineWithMedicationCompletionEvents(events, filteredMedicationEvents);
  }, [events, eventTypeFilter, medicationCompletionEvents, sourceFilter, statusFilter]);

  const statusOptions = useMemo(() => {
    const values = new Set(filterOptionEventsWithMedication.map((event) => event.status));
    return Array.from(values).filter(Boolean);
  }, [filterOptionEventsWithMedication]);

  const eventTypeOptions = useMemo(() => {
    const options = new Map(EVENT_TYPE_OPTIONS.map((option) => [option.value, option]));
    for (const event of filterOptionEventsWithMedication) {
      if (event.eventType && !options.has(event.eventType)) {
        options.set(event.eventType, { value: event.eventType, label: getEventTypeLabel(event.eventType) });
      }
    }
    return Array.from(options.values());
  }, [filterOptionEventsWithMedication]);

  const sourceOptions = useMemo(() => {
    const values = new Set(filterOptionEventsWithMedication.map((event) => event.source));
    return Array.from(values).filter(Boolean);
  }, [filterOptionEventsWithMedication]);

  // Structured filters (status/eventType/source/date) and pagination are applied server-side
  // via query params. Free-text search has no API equivalent, so it narrows the current page only.
  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return eventsWithMedicationCompletion;
    return eventsWithMedicationCompletion.filter((event) => {
      const haystack = `${getEventTitle(event)} ${getEventTypeLabel(event.eventType)} ${getSourceLabel(event.source)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [eventsWithMedicationCompletion, search]);

  const currentPage = Math.min(page, totalPages);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, TimelineEventRecord[]>();
    for (const event of filteredEvents) {
      const label = getGroupLabel(event.timestamp);
      const bucket = groups.get(label) ?? [];
      bucket.push(event);
      groups.set(label, bucket);
    }
    return Array.from(groups.entries());
  }, [filteredEvents]);

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
      <CareEpisodeSubHeader episodeId={episodeId} episode={episode} variant="timeline" />

      <Card className="rounded-xl border-border bg-card shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search timeline entries"
                className="h-10 rounded-lg border-border pl-9"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="h-10 gap-2 rounded-lg border-border text-sm font-medium text-foreground/80">
                  {statusFilter}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44 rounded-lg border-border p-1.5">
                <DropdownMenuItem onSelect={() => { setStatusFilter("All Status"); setPage(1); }} className="rounded-md text-sm">
                  All Status
                </DropdownMenuItem>
                {statusOptions.map((status) => (
                  <DropdownMenuItem key={status} onSelect={() => { setStatusFilter(status); setPage(1); }} className="rounded-md text-sm capitalize">
                    {status}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="h-10 gap-2 rounded-lg border-border text-sm font-medium text-foreground/80">
                  {eventTypeFilter === "Event Types" ? "Event Types" : eventTypeOptions.find((option) => option.value === eventTypeFilter)?.label ?? humanizeSlug(eventTypeFilter)}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 rounded-lg border-border p-1.5">
                <DropdownMenuItem onSelect={() => { setEventTypeFilter("Event Types"); setPage(1); }} className="rounded-md text-sm">
                  Event Types
                </DropdownMenuItem>
                {eventTypeOptions.map((option) => (
                  <DropdownMenuItem key={option.value} onSelect={() => { setEventTypeFilter(option.value); setPage(1); }} className="rounded-md text-sm">
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="h-10 gap-2 rounded-lg border-border text-sm font-medium text-foreground/80">
                  {sourceFilter === "Source" ? "Source" : getSourceLabel(sourceFilter)}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44 rounded-lg border-border p-1.5">
                <DropdownMenuItem onSelect={() => { setSourceFilter("Source"); setPage(1); }} className="rounded-md text-sm">
                  Source
                </DropdownMenuItem>
                {sourceOptions.map((source) => (
                  <DropdownMenuItem key={source} onSelect={() => { setSourceFilter(source); setPage(1); }} className="rounded-md text-sm">
                    {getSourceLabel(source)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Input
              type="date"
              value={dateFilter}
              onChange={(event) => {
                setDateFilter(event.target.value);
                setPage(1);
              }}
              className="h-10 w-40 rounded-lg border-border text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border bg-card shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <h2 className="mb-4 text-base font-bold text-foreground">Unified Care Timeline</h2>

          {timelineLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : groupedEvents.length === 0 ? (
            <p className="py-10 text-center text-sm font-medium text-muted-foreground">No timeline events match these filters.</p>
          ) : (
            <div className="space-y-6">
              {groupedEvents.map(([groupLabel, groupItems]) => (
                <div key={groupLabel}>
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">{groupLabel}</p>
                  <div className="space-y-4">
                    {groupItems.map((event) => {
                      const category = getEventCategory(event);
                      const iconMeta = CATEGORY_ICON[category];
                      return (
                        <div key={event.id} className="flex gap-3 rounded-lg border border-border p-4">
                          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", iconMeta.className)}>
                            <iconMeta.Icon className="h-4.5 w-4.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-foreground">{getEventTitle(event)}</p>
                              <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", CATEGORY_BADGE[category])}>
                                {getEventStatusLabel(event, category)}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
                              <span>{formatTime(event.timestamp)}</span>
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                                {getSourceLabel(event.source)}
                              </span>
                              <span className="rounded-md bg-muted px-2 py-0.5 font-bold text-muted-foreground">
                                {getEventTypeLabel(event.eventType)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalEvents > PAGE_SIZE ? (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="h-9 gap-1 rounded-lg border-border px-3 text-sm font-medium text-foreground/80"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  className="h-9 gap-1 rounded-lg border-border px-3 text-sm font-medium text-foreground/80"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
