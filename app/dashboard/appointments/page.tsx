"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CalendarCheck, CalendarDays, List, Loader2, Plus, Video } from "lucide-react";
import { RoleGate } from "@/components/auth/RoleGate";
import { cn } from "@/lib/utils";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { getAppointments } from "@/lib/api/appointments";
import AppointmentCalendar from "./components/AppointmentCalendar";
import AppointmentEmptyState from "./components/AppointmentEmptyState";
import AppointmentFilters, { type AppointmentListFilters } from "./components/AppointmentFilters";
import AppointmentStats from "./components/AppointmentStats";
import AppointmentTable from "./components/AppointmentTable";
import ScheduleAppointmentModal from "./components/ScheduleAppointmentModal";

type AppointmentView = "table" | "calendar";
type CalendarMode = "day" | "week";
const STAFF_ROLES = ["clinician", "hospital_admin"] as const;

const appointmentStatuses = new Set([
  "pending",
  "confirmed",
  "upcoming",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
]);

function getInitialStatusFilter(value: string | null) {
  return value && appointmentStatuses.has(value) ? value : "all";
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(date.getDate() + days);
  return nextDate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAppointmentItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  const data = payload.data;
  if (Array.isArray(data)) return data;
  if (isRecord(data)) {
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.appointments)) return data.appointments;
    if (Array.isArray(data.results)) return data.results;
  }

  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.appointments)) return payload.appointments;
  if (Array.isArray(payload.results)) return payload.results;

  return [];
}

function getAppointmentTotal(payload: unknown) {
  if (!isRecord(payload)) return 0;

  const directTotal = payload.total ?? payload.totalCount ?? payload.count;
  if (typeof directTotal === "number") return directTotal;

  const data = payload.data;
  if (isRecord(data)) {
    const nestedTotal = data.total ?? data.totalCount ?? data.count;
    if (typeof nestedTotal === "number") return nestedTotal;

    const meta = data.meta;
    if (isRecord(meta)) {
      const metaTotal = meta.total ?? meta.totalCount ?? meta.count;
      if (typeof metaTotal === "number") return metaTotal;
    }
  }

  return getAppointmentItems(payload).length;
}

function hasAppointments(payload: unknown) {
  return getAppointmentItems(payload).length > 0 || getAppointmentTotal(payload) > 0;
}

function AppointmentsPageContent() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<AppointmentView>("table");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("day");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [appointmentFilters, setAppointmentFilters] = useState<AppointmentListFilters>(() => ({
    status: getInitialStatusFilter(searchParams.get("status")),
    dateFrom: "",
    dateTo: "",
    search: "",
    department: "all",
    type: "all",
  }));
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportRequestKey, setExportRequestKey] = useState(0);
  const [isCheckingAppointments, setIsCheckingAppointments] = useState(true);
  const [isEmptyStateVisible, setIsEmptyStateVisible] = useState(false);

  useEffect(() => {
    capturePostHogEvent("appointments_viewed");
  }, []);

  const goToPreviousDay = () => {
    setSelectedDate((currentDate) => addDays(currentDate, -1));
  };

  const goToNextDay = () => {
    setSelectedDate((currentDate) => addDays(currentDate, 1));
  };

  const goToPreviousWeek = () => {
    setSelectedDate((currentDate) => addDays(currentDate, -7));
  };

  const goToNextWeek = () => {
    setSelectedDate((currentDate) => addDays(currentDate, 7));
  };

  const handleAppointmentCreated = () => {
    setIsEmptyStateVisible(false);
    setRefreshKey((key) => key + 1);
  };

  const checkForAppointments = useCallback(async () => {
    const payload = await getAppointments();
    const foundAppointments = hasAppointments(payload);
    setIsEmptyStateVisible(!foundAppointments);
    if (foundAppointments) {
      setRefreshKey((key) => key + 1);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadInitialAppointmentsState() {
      setIsCheckingAppointments(true);
      try {
        const payload = await getAppointments();
        if (!isActive) return;
        setIsEmptyStateVisible(!hasAppointments(payload));
      } catch (error) {
        console.error("Failed to check appointments empty state:", error);
        if (isActive) {
          setIsEmptyStateVisible(false);
        }
      } finally {
        if (isActive) {
          setIsCheckingAppointments(false);
        }
      }
    }

    void loadInitialAppointmentsState();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="min-h-full space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#111827] md:text-2xl">Appointment Bookings</h1>
          <p className="mt-1 text-sm font-medium text-[#71809B]">Manage and monitor all patient appointments</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <RoleGate allowedRoles={STAFF_ROLES}>
            <Link
              href="/dashboard/appointments/availability"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#8AA0C0] bg-white px-4 text-sm font-semibold text-[#71809B] sm:w-auto"
            >
              <CalendarCheck className="h-5 w-5 text-[#71809B]" />
              Availability Management
            </Link>
          </RoleGate>
          <Link
            href="/dashboard/appointments/virtual-consultations"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#8AA0C0] bg-white px-4 text-sm font-semibold text-[#71809B] sm:w-auto"
          >
            <Video className="h-5 w-5 text-[#71809B]" />
            Virtual Consultation
          </Link>
          <RoleGate allowedRoles={STAFF_ROLES}>
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-sm sm:w-auto"
            >
              <Plus className="h-5 w-5" />
              Add Appointment
            </button>
          </RoleGate>
        </div>
      </div>

      <AppointmentStats refreshKey={refreshKey} />

      <section className="rounded-sm bg-white p-4">
        {isCheckingAppointments ? (
          <div className="flex min-h-[560px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm font-semibold text-[#71809B]">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Loading appointments
            </div>
          </div>
        ) : isEmptyStateVisible ? (
          <AppointmentEmptyState onRefresh={checkForAppointments} />
        ) : (
          <>
            <div className="mb-5 inline-flex rounded-2xl bg-[#E7F2FF] p-1">
              <button
                type="button"
                onClick={() => setView("table")}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-lg px-4 text-sm transition-colors",
                  view === "table" ? "bg-white font-semibold text-[#344054] shadow-sm" : "font-medium text-[#71809B]",
                )}
              >
                <List className="h-4 w-4" />
                Table
              </button>
              <button
                type="button"
                onClick={() => setView("calendar")}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-lg px-4 text-sm transition-colors",
                  view === "calendar" ? "bg-white font-semibold text-[#111827] shadow-sm" : "font-medium text-[#71809B]",
                )}
              >
                <CalendarDays className="h-4 w-4" />
                Calendar
              </button>
            </div>

            {view === "table" ? (
              <>
                <AppointmentFilters
                  view={view}
                  calendarMode={calendarMode}
                  onCalendarModeChange={setCalendarMode}
                  filters={appointmentFilters}
                  onFiltersChange={setAppointmentFilters}
                  onExport={() => setExportRequestKey((key) => key + 1)}
                />
                <AppointmentTable
                  key={`${appointmentFilters.status}-${appointmentFilters.dateFrom}-${appointmentFilters.dateTo}-${appointmentFilters.facilityId ?? ""}-${appointmentFilters.search}-${appointmentFilters.department}-${appointmentFilters.type}`}
                  filters={appointmentFilters}
                  refreshKey={refreshKey}
                  exportRequestKey={exportRequestKey}
                />
              </>
            ) : (
              <AppointmentCalendar
                key={`${refreshKey}-${calendarMode}`}
                mode={calendarMode}
                date={selectedDate}
                onPreviousDay={goToPreviousDay}
                onNextDay={goToNextDay}
                onPreviousWeek={goToPreviousWeek}
                onNextWeek={goToNextWeek}
                onCalendarModeChange={setCalendarMode}
              />
            )}
          </>
        )}
      </section>

      <ScheduleAppointmentModal
        open={isScheduleModalOpen}
        onOpenChange={setIsScheduleModalOpen}
        onAppointmentCreated={handleAppointmentCreated}
      />
    </div>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex min-h-[560px] items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-semibold text-[#71809B]">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading appointments
          </div>
        </div>
      )}
    >
      <AppointmentsPageContent />
    </Suspense>
  );
}
