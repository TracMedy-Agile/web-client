"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  CalendarDays,
  Clock3,
  RefreshCcw,
  Video,
  X,
} from "lucide-react";
import { getAppointmentAvailability, rescheduleAppointment, type AppointmentAvailability } from "@/lib/api/appointments";
import { getHospitalFacilityId } from "@/lib/api/care-episodes";
import { cn } from "@/lib/utils";

type AppointmentType = "physical" | "teleconsultation";
type QuickSlotOption = {
  value: string;
  date: string;
  time: string;
  inputDate: string;
};

type RescheduleAppointmentModalProps = {
  isOpen: boolean;
  appointmentId?: string;
  appointmentDisplayId?: string;
  patientName?: string;
  appointmentReason?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  hospitalId?: string;
  patientImageUrl?: string;
  clinicianId?: string;
  initialAppointmentType?: AppointmentType;
  onClose: () => void;
  onSuccess?: () => void;
};

const appointmentTypes = [
  {
    value: "physical" as const,
    icon: Building2,
    title: "Physical Visit",
    description: "In-clinic examination",
  },
  {
    value: "teleconsultation" as const,
    icon: Video,
    title: "Teleconsultation",
    description: "Secure video link session",
  },
];

function toInputDate(value: string) {
  const isoMatch = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const displayMatch = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (displayMatch) {
    return `${displayMatch[3]}-${displayMatch[1].padStart(2, "0")}-${displayMatch[2].padStart(2, "0")}`;
  }

  const dateOnlyValue = value.split(/\s+-\s+/)[0]?.trim() ?? value;
  const parsed = Date.parse(dateOnlyValue);
  const date = Number.isFinite(parsed) ? new Date(parsed) : new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function toInputTime(value: string) {
  const displayMatch = value.match(/(\d{1,2}):(\d{2})\s*(?:AM|PM)/i);
  if (displayMatch) return formatTimeForApi(displayMatch[0]);

  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    const date = new Date(parsed);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  const twentyFourHourMatch = value.match(/^(\d{1,2}):(\d{2})/);
  if (twentyFourHourMatch) {
    return `${twentyFourHourMatch[1].padStart(2, "0")}:${twentyFourHourMatch[2]}`;
  }

  return "11:30";
}
function getPatientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase() || "PT";
}

const QUICK_SLOT_COUNT = 3;
// Look-ahead window for free slots (the availability endpoint caps ranges at 31 days).
const QUICK_SLOT_RANGE_DAYS = 14;

function toLocalIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Range starts at the original appointment date, or today if that has passed.
function getQuickSlotRange(value: string) {
  const parsed = Date.parse(toInputDate(value));
  const parsedDate = Number.isFinite(parsed) ? new Date(parsed) : new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = parsedDate < today ? today : parsedDate;
  start.setHours(12, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + QUICK_SLOT_RANGE_DAYS - 1);
  return { dateFrom: toLocalIsoDate(start), dateTo: toLocalIsoDate(end) };
}

// First truly free slot on each of the next few days (backend-computed, so never already booked).
function buildQuickSlots(availability: AppointmentAvailability | null): QuickSlotOption[] {
  if (!availability) return [];
  const slots: QuickSlotOption[] = [];
  const seenDates = new Set<string>();
  const ordered = [...availability.slots].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  for (const slot of ordered) {
    if (slots.length >= QUICK_SLOT_COUNT) break;
    if (seenDates.has(slot.date)) continue;
    seenDates.add(slot.date);
    const date = new Date(`${slot.date}T12:00:00`);
    const time = toInputTime(slot.startTime);
    slots.push({
      value: `${slot.date}-${time}`,
      date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date).toUpperCase(),
      time,
      inputDate: slot.date,
    });
  }
  return slots;
}

const inputClass =
  "h-11 w-full rounded-lg border border-transparent bg-[#F3F4F6] px-3 text-sm font-medium text-[#111827] outline-none transition-colors placeholder:text-[#71809B] focus:border-[#023E8A]/40 focus:bg-white";

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-2 block text-sm font-bold text-[#344054]">{children}</span>;
}

function AppointmentTypeCard({
  type,
  active,
  onClick,
}: {
  type: (typeof appointmentTypes)[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = type.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[60px] items-center gap-3 rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-2 border-[#023E8A] bg-[#E7F2FF]"
          : "border-[#DADFE7] bg-white hover:border-[#023E8A]/40",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E7F2FF] text-[#1473E6]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-[#111827]">{type.title}</span>
        <span className="mt-1 block text-xs font-medium text-[#71809B]">{type.description}</span>
      </span>
    </button>
  );
}

function QuickSlotButton({
  slot,
  active,
  onClick,
  recommended = false,
}: {
  slot: QuickSlotOption;
  active: boolean;
  onClick: () => void;
  recommended?: boolean;
}) {
  return (
    <div className="relative">
      {recommended ? (
        <span className="absolute -top-2 left-2 z-10 bg-white px-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#023E8A]">Recommended</span>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        className={cn(
        "flex h-[52px] w-full flex-col items-center justify-center rounded-lg border px-2 text-xs leading-tight transition-colors",
        active
          ? "border-[#023E8A] bg-[#EDF5FF] font-bold text-[#023E8A]"
          : "border-[#C8CDD5] bg-[#FAFAFA] font-bold text-[#111827] hover:border-[#023E8A]/40",
      )}
      >
        <span>{slot.date}</span>
        <span className="font-semibold">{slot.time}</span>
      </button>
    </div>
  );
}

function formatDateForApi(value: string) {
  const nativeDate = Date.parse(value);
  if (Number.isFinite(nativeDate)) return new Date(nativeDate).toISOString().slice(0, 10);

  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return value;

  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function formatTimeForApi(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return value;

  const [, rawHour, minute, period] = match;
  let hour = Number(rawHour);
  if (period.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (period.toUpperCase() === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

export default function RescheduleAppointmentModal({
  isOpen,
  appointmentId,
  appointmentDisplayId,
  patientName = "Patient",
  appointmentReason,
  appointmentDate = "",
  appointmentTime = "",
  hospitalId = "--",
  patientImageUrl,
  clinicianId,
  initialAppointmentType = "physical",
  onClose,
  onSuccess,
}: RescheduleAppointmentModalProps) {
  const [appointmentType, setAppointmentType] = useState<AppointmentType>(initialAppointmentType);
  // Keyed by the request it answers, so a stale result is never shown for a new type/clinician.
  const [availabilityResult, setAvailabilityResult] = useState<{ key: string; availability: AppointmentAvailability | null } | null>(null);
  const availabilityKey = `${clinicianId ?? ""}|${appointmentType}|${appointmentDate}`;
  useEffect(() => {
    if (!isOpen || !clinicianId) return;
    let active = true;
    const { dateFrom, dateTo } = getQuickSlotRange(appointmentDate);
    getHospitalFacilityId()
      .then((facilityId) => getAppointmentAvailability({
        clinicianId,
        facilityId,
        dateFrom,
        dateTo,
        type: appointmentType === "physical" ? "in_person" : "teleconsultation",
      }))
      .then((availability) => {
        if (active) setAvailabilityResult({ key: availabilityKey, availability });
      })
      .catch(() => {
        // 404 = no working schedule configured; treat like any failure: no suggestions.
        if (active) setAvailabilityResult({ key: availabilityKey, availability: null });
      });
    return () => { active = false; };
  }, [appointmentDate, appointmentType, availabilityKey, clinicianId, isOpen]);
  const availability = availabilityResult?.key === availabilityKey ? availabilityResult.availability : null;
  const availabilityLoading = Boolean(isOpen && clinicianId && availabilityResult?.key !== availabilityKey);
  const quickSlots = useMemo(() => buildQuickSlots(availability), [availability]);
  const todayIso = useMemo(() => toInputDate(new Date().toISOString()), []);
  const patientInitials = getPatientInitials(patientName);
  // null = the user hasn't picked yet, so the recommended (first free) slot is used;
  // "" = they typed a custom date/time, so no quick slot is highlighted.
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [pickedTime, setPickedTime] = useState<string | null>(null);
  const quickSlot = pickedSlot ?? quickSlots[0]?.value ?? "";
  // Default to the recommended free slot so confirming without touching the form never
  // submits the original (possibly already-past or now-booked) date/time.
  const selectedDate = pickedDate ?? quickSlots[0]?.inputDate ?? toInputDate(appointmentDate);
  const selectedTime = pickedTime ?? toInputTime(quickSlots[0]?.time ?? (appointmentTime || appointmentDate));
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);


  const handleSubmit = async () => {
    if (!appointmentId || isSubmitting) return;
    if (!selectedDate || !selectedTime) {
      toast.error("Select a new appointment date and time.");
      return;
    }

    setIsSubmitting(true);

    try {
      await rescheduleAppointment(appointmentId, {
        newDate: formatDateForApi(selectedDate),
        newTime: formatTimeForApi(selectedTime),
        reason: reason || "Rescheduled by care team",
      });
      onSuccess?.();
      onClose();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Failed to reschedule appointment.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/60 px-4 py-4 sm:py-8 backdrop-blur-[3px]">
      <div className="flex max-h-[calc(100vh-96px)] w-full max-w-[640px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_28px_80px_rgba(15,23,42,0.36)]">
        <div className="flex h-[68px] items-center justify-between border-b border-[#E5E7EB] px-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E5E7EB] text-[#111827]">
              <RefreshCcw className="h-4 w-4" />
            </span>
            <h2 className="truncate text-base font-bold text-[#111827]">Reschedule Appointment</h2>
          </div>
          <button
            type="button"
            aria-label="Close reschedule appointment modal"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#8AA0C0] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          <section className="w-full rounded-md bg-[#E7F2FF] px-4 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#023E8A] text-base font-bold text-white">
                  {patientImageUrl ? (
                    <Image src={patientImageUrl} alt={`${patientName} profile`} width={56} height={56} className="h-full w-full object-cover" unoptimized />
                  ) : patientInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate whitespace-nowrap text-base font-bold text-[#111827]" title={patientName}>{patientName}</h3>
                  <p className="mt-1 truncate text-xs font-medium text-[#71809B]">{appointmentReason || "General Check-up"}</p>
                </div>
              </div>
              <div className="sm:text-left">
                <span className="inline-flex max-w-full items-center rounded-full bg-[#D6E9FF] px-3 py-1 text-[11px] font-bold tracking-[0.04em] text-[#023E8A]">
                  <span className="truncate">HOSPITAL ID: {hospitalId}</span>
                </span>
                <p className="mt-2 max-w-[220px] truncate text-xs font-medium text-[#344054]" title={appointmentDisplayId ?? appointmentId ?? "--"}>Apt ID: {appointmentDisplayId ?? appointmentId ?? "--"}</p>
              </div>
            </div>
          </section>
          <section className="mt-6 w-full">
            <div className="mb-3">
              <h3 className="text-base font-bold text-[#344054]">Alternative Quick Slots</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {availabilityLoading ? <p className="col-span-full text-xs font-medium text-[#71809B]">Loading available slots...</p> : null}
              {!availabilityLoading && quickSlots.length === 0 ? <p className="col-span-full text-xs font-medium text-[#71809B]">No free slots found for this clinician in the next {QUICK_SLOT_RANGE_DAYS} days.</p> : null}
              {quickSlots.map((slot) => (
                <QuickSlotButton
                  key={slot.value}
                  slot={slot}
                  active={quickSlot === slot.value}
                  recommended={slot === quickSlots[0]}
                  onClick={() => {
                    setPickedSlot(slot.value);
                    setPickedDate(slot.inputDate);
                    setPickedTime(toInputTime(slot.time));
                  }}
                />
              ))}
            </div>
          </section>

          <div className="mt-6 grid w-full gap-4 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>Select New Date</FieldLabel>
              <span className="relative block">
                <input
                  type="date"
                  value={selectedDate}
                  min={todayIso}
                  onChange={(event) => { setPickedSlot(""); setPickedDate(event.target.value); setPickedTime(selectedTime); }}
                  aria-label="Select new appointment date"
                  className={cn(
                    inputClass,
                    "relative pr-12 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-12 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0",
                  )}
                />
                <CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#1473E6]" />
              </span>
            </label>

            <label className="block">
              <FieldLabel>Select New Time</FieldLabel>
              <span className="relative block">
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(event) => { setPickedSlot(""); setPickedTime(event.target.value); setPickedDate(selectedDate); }}
                  step={900}
                  aria-label="Select new appointment time"
                  className={cn(
                    inputClass,
                    "relative pr-12 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-12 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0",
                  )}
                />
                <Clock3 className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#1473E6]" />
              </span>
            </label>
          </div>

          <section className="mt-6 w-full">
            <h3 className="mb-3 text-sm font-bold text-[#111827]">Appointment Type</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {appointmentTypes.map((type) => (
                <AppointmentTypeCard
                  key={type.value}
                  type={type}
                  active={appointmentType === type.value}
                  onClick={() => setAppointmentType(type.value)}
                />
              ))}
            </div>
          </section>


          <section className="mt-6 w-full">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="text-base font-bold text-[#344054]">Reason for Rescheduling</h3>
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-[#71809B]">
                Optional
              </span>
            </div>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="min-h-[80px] w-full resize-none rounded-lg border border-transparent bg-[#F3F4F6] px-3 py-3 text-sm font-medium text-[#111827] outline-none transition-colors placeholder:text-[#71809B] focus:border-[#023E8A]/40 focus:bg-white"
              placeholder="Please provide a brief reason..."
            />
          </section>
        </div>

        <div className="flex flex-col items-stretch justify-end gap-2 border-t border-[#E5E7EB] bg-[#F8FAFC] px-5 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-10 px-1 text-xs font-bold text-[#344054] transition-colors hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !appointmentId || !selectedDate || !selectedTime}
            className="h-10 rounded-lg bg-[#023E8A] px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#023575] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Rescheduling..." : "Confirm Reschedule"}
          </button>
        </div>
      </div>
    </div>
  );
}




