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
import {
  getCareEpisodeById,
  getCareEpisodeTimelinePage,
  getString,
  type CareEpisodeDetail,
  type TimelineEventRecord,
} from "@/lib/api/care-episodes";
import { CareEpisodeSubHeader, SubHeaderSkeleton } from "../_shared/SubHeader";
import { formatTime, humanizeSlug } from "../_shared/utils";

type EventCategory = "critical" | "completed" | "clinician" | "missed" | "pending";

const PAGE_SIZE = 10;

function getEventCategory(event: TimelineEventRecord): EventCategory {
  const status = event.status.toLowerCase();
  const source = event.source.toLowerCase();
  const eventType = event.eventType.toLowerCase();

  if (status === "critical" || eventType.includes("alert") || eventType.includes("escalation")) return "critical";
  if (status === "missed") return "missed";
  if (status === "pending") return "pending";
  if (source === "clinician" || eventType.includes("clinician")) return "clinician";
  return "completed";
}

const CATEGORY_ICON: Record<EventCategory, { Icon: typeof AlertCircle; className: string }> = {
  critical: { Icon: AlertCircle, className: "bg-[#FFECEC] text-[#EF4444]" },
  completed: { Icon: CheckCircle2, className: "bg-[#DFFBF0] text-[#10B981]" },
  clinician: { Icon: Stethoscope, className: "bg-[#E7F2FF] text-[#023E8A]" },
  missed: { Icon: X, className: "bg-[#FFF4E5] text-[#F59E0B]" },
  pending: { Icon: Clock, className: "bg-[#F3F4F6] text-[#71809B]" },
};

const CATEGORY_LABEL: Record<EventCategory, string> = {
  critical: "Critical",
  completed: "Completed",
  clinician: "Completed",
  missed: "Missed",
  pending: "Pending",
};

const CATEGORY_BADGE: Record<EventCategory, string> = {
  critical: "bg-[#FFECEC] text-[#EF4444]",
  completed: "bg-[#DFFBF0] text-[#10B981]",
  clinician: "bg-[#DFFBF0] text-[#10B981]",
  missed: "bg-[#FFF4E5] text-[#F59E0B]",
  pending: "bg-[#F3F4F6] text-[#71809B]",
};

const SOURCE_LABEL: Record<string, string> = {
  system: "System",
  patient_app: "Patient App",
  patientapp: "Patient App",
  clinician: "Clinician",
};

function getSourceLabel(source: string) {
  const key = source.toLowerCase().replace(/[\s-]+/g, "_");
  return SOURCE_LABEL[key] ?? (humanizeSlug(source) || "System");
}

function getEventTitle(event: TimelineEventRecord) {
  const message = getString(event.payload, ["message", "title"]);
  return message || humanizeSlug(event.eventType) || "Update";
}

function getEventDescription(event: TimelineEventRecord) {
  return getString(event.payload, ["details", "description", "note", "summary"]);
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

  const statusOptions = useMemo(() => {
    const values = new Set(filterOptionEvents.map((event) => event.status));
    return Array.from(values).filter(Boolean);
  }, [filterOptionEvents]);

  const eventTypeOptions = useMemo(() => {
    const values = new Set(filterOptionEvents.map((event) => event.eventType));
    return Array.from(values).filter(Boolean);
  }, [filterOptionEvents]);

  const sourceOptions = useMemo(() => {
    const values = new Set(filterOptionEvents.map((event) => event.source));
    return Array.from(values).filter(Boolean);
  }, [filterOptionEvents]);

  // Structured filters (status/eventType/source/date) and pagination are applied server-side
  // via query params. Free-text search has no API equivalent, so it narrows the current page only.
  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return events;
    return events.filter((event) => {
      const haystack = `${getEventTitle(event)} ${getEventDescription(event)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [events, search]);

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

      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71809B]" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search timeline entries"
                className="h-10 rounded-lg border-[#DDE3EC] pl-9"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="h-10 gap-2 rounded-lg border-[#DDE3EC] text-sm font-medium text-[#344054]">
                  {statusFilter}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44 rounded-lg border-[#DDE3EC] p-1.5">
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
                <Button type="button" variant="outline" className="h-10 gap-2 rounded-lg border-[#DDE3EC] text-sm font-medium text-[#344054]">
                  {eventTypeFilter === "Event Types" ? "Event Types" : humanizeSlug(eventTypeFilter)}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 rounded-lg border-[#DDE3EC] p-1.5">
                <DropdownMenuItem onSelect={() => { setEventTypeFilter("Event Types"); setPage(1); }} className="rounded-md text-sm">
                  Event Types
                </DropdownMenuItem>
                {eventTypeOptions.map((type) => (
                  <DropdownMenuItem key={type} onSelect={() => { setEventTypeFilter(type); setPage(1); }} className="rounded-md text-sm">
                    {humanizeSlug(type)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="h-10 gap-2 rounded-lg border-[#DDE3EC] text-sm font-medium text-[#344054]">
                  {sourceFilter === "Source" ? "Source" : getSourceLabel(sourceFilter)}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44 rounded-lg border-[#DDE3EC] p-1.5">
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
              className="h-10 w-40 rounded-lg border-[#DDE3EC] text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-[#DDE3EC] bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <h2 className="mb-4 text-base font-bold text-[#111827]">Unified Care Timeline</h2>

          {timelineLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-lg bg-[#F3F4F6]" />
              ))}
            </div>
          ) : groupedEvents.length === 0 ? (
            <p className="py-10 text-center text-sm font-medium text-[#71809B]">No timeline events match these filters.</p>
          ) : (
            <div className="space-y-6">
              {groupedEvents.map(([groupLabel, groupItems]) => (
                <div key={groupLabel}>
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-[#71809B]">{groupLabel}</p>
                  <div className="space-y-4">
                    {groupItems.map((event) => {
                      const category = getEventCategory(event);
                      const iconMeta = CATEGORY_ICON[category];
                      const description = getEventDescription(event);
                      return (
                        <div key={event.id} className="flex gap-3 rounded-lg border border-[#E5E7EB] p-4">
                          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", iconMeta.className)}>
                            <iconMeta.Icon className="h-4.5 w-4.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-[#111827]">{getEventTitle(event)}</p>
                              <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", CATEGORY_BADGE[category])}>
                                {CATEGORY_LABEL[category]}
                              </span>
                            </div>
                            {description ? <p className="mt-1 text-sm font-medium text-[#71809B]">{description}</p> : null}
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-medium text-[#71809B]">
                              <span>{formatTime(event.timestamp)}</span>
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-[#71809B]" />
                                {getSourceLabel(event.source)}
                              </span>
                              <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 font-bold text-[#71809B]">
                                {humanizeSlug(event.eventType)}
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
              <p className="text-xs font-medium text-[#71809B]">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="h-9 gap-1 rounded-lg border-[#DDE3EC] px-3 text-sm font-medium text-[#344054]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  className="h-9 gap-1 rounded-lg border-[#DDE3EC] px-3 text-sm font-medium text-[#344054]"
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
