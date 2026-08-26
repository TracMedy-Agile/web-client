"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  CalendarDays,
  Clock3,
  RefreshCcw,
  Video,
  X,
} from "lucide-react";
import { rescheduleAppointment } from "@/lib/api/appointments";
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
  patientName?: string;
  appointmentReason?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  hospitalId?: string;
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

function buildQuickSlots(value: string): QuickSlotOption[] {
  const parsed = Date.parse(toInputDate(value));
  const parsedDate = Number.isFinite(parsed) ? new Date(parsed) : new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Anchor quick slots to today whenever the original appointment date has already passed, so
  // rescheduling a missed appointment doesn't offer "recommended" slots that are still in the past.
  const baseDate = parsedDate < today ? new Date() : parsedDate;
  baseDate.setHours(12, 0, 0, 0);

  return [
    { dayOffset: 0, time: "11:30 AM" },
    { dayOffset: 1, time: "09:00 AM" },
    { dayOffset: 1, time: "02:15 PM" },
  ].map(({ dayOffset, time }) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + dayOffset);
    const inputDate = toInputDate(date.toISOString());
    return {
      value: `${inputDate}-${time}`,
      date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date).toUpperCase(),
      time,
      inputDate,
    };
  });
}

const inputClass =
  "h-14 w-full rounded-lg border border-transparent bg-[#F3F4F6] px-4 text-base font-medium text-[#111827] outline-none transition-colors placeholder:text-[#71809B] focus:border-[#023E8A]/40 focus:bg-white";

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-3 block text-base font-bold text-[#344054]">{children}</span>;
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
        "flex min-h-[74px] items-center gap-4 rounded-lg border p-4 text-left transition-colors",
        active
          ? "border-2 border-[#023E8A] bg-[#E7F2FF]"
          : "border-[#DADFE7] bg-white hover:border-[#023E8A]/40",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E7F2FF] text-[#1473E6]">
        <Icon className="h-5 w-5" />
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
}: {
  slot: QuickSlotOption;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[62px] flex-col items-center justify-center rounded-lg border text-sm leading-tight transition-colors",
        active
          ? "border-[#023E8A] bg-[#EDF5FF] font-bold text-[#023E8A]"
          : "border-[#C8CDD5] bg-[#FAFAFA] font-bold text-[#111827] hover:border-[#023E8A]/40",
      )}
    >
      <span>{slot.date}</span>
      <span className={cn(active ? "font-bold" : "font-bold")}>{slot.time}</span>
    </button>
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
  patientName = "Patient",
  appointmentDate = "",
  appointmentTime = "",
  hospitalId = "--",
  initialAppointmentType = "physical",
  onClose,
  onSuccess,
}: RescheduleAppointmentModalProps) {
  const quickSlots = useMemo(() => buildQuickSlots(appointmentDate), [appointmentDate]);
  const todayIso = useMemo(() => toInputDate(new Date().toISOString()), []);
  const patientInitials = getPatientInitials(patientName);
  const [appointmentType, setAppointmentType] = useState<AppointmentType>(initialAppointmentType);
  const [quickSlot, setQuickSlot] = useState(() => quickSlots[0]?.value ?? "");
  // Keep these in sync with whichever quick slot is shown pre-selected above — otherwise
  // confirming without touching the form submits the original (possibly already-past) date/time
  // instead of the highlighted recommendation.
  const [selectedDate, setSelectedDate] = useState(() => quickSlots[0]?.inputDate ?? toInputDate(appointmentDate));
  const [selectedTime, setSelectedTime] = useState(() => toInputTime(quickSlots[0]?.time ?? (appointmentTime || appointmentDate)));
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
      <div className="flex max-h-[calc(100vh-64px)] w-full max-w-[672px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_28px_80px_rgba(15,23,42,0.36)]">
        <div className="flex h-[84px] items-center justify-between border-b border-[#E5E7EB] px-4 sm:px-6 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E5E7EB] text-[#111827]">
              <RefreshCcw className="h-5 w-5" />
            </span>
            <h2 className="truncate text-lg font-bold md:text-xl text-[#111827]">Reschedule Appointment</h2>
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

        <div className="overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 sm:px-8">
          <section className="rounded-md bg-[#E7F2FF] px-5 py-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-full bg-[#023E8A] text-lg font-bold md:text-2xl text-white">
                  {patientInitials}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#111827]">{patientName}</h3>
                </div>
              </div>
              <div className="sm:text-left">
                <span className="inline-flex rounded-full bg-[#D6E9FF] px-4 py-1.5 text-xs font-bold tracking-[0.08em] text-[#023E8A]">
                  HOSPITAL ID: {hospitalId}
                </span>
                <p className="mt-3 text-sm font-medium text-[#344054]">Apt ID: {appointmentId ?? "--"}</p>
              </div>
            </div>
          </section>
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-base font-bold text-[#344054]">Alternative Quick Slots</h3>
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#023E8A]">
                Recommended
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {quickSlots.map((slot) => (
                <QuickSlotButton
                  key={slot.value}
                  slot={slot}
                  active={quickSlot === slot.value}
                  onClick={() => {
                    setQuickSlot(slot.value);
                    setSelectedDate(slot.inputDate);
                    setSelectedTime(toInputTime(slot.time));
                  }}
                />
              ))}
            </div>
          </section>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>Select New Date</FieldLabel>
              <span className="relative block">
                <input
                  type="date"
                  value={selectedDate}
                  min={todayIso}
                  onChange={(event) => setSelectedDate(event.target.value)}
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
                  onChange={(event) => setSelectedTime(event.target.value)}
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

          <section className="mt-8">
            <h3 className="mb-3 text-sm font-bold text-[#111827]">Appointment Type</h3>
            <div className="grid gap-4 sm:grid-cols-2">
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


          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="text-base font-bold text-[#344054]">Reason for Rescheduling</h3>
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-[#71809B]">
                Optional
              </span>
            </div>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="min-h-[104px] w-full resize-none rounded-lg border border-transparent bg-[#F3F4F6] px-4 py-5 text-base font-medium text-[#111827] outline-none transition-colors placeholder:text-[#71809B] focus:border-[#023E8A]/40 focus:bg-white"
              placeholder="Please provide a brief reason..."
            />
          </section>
        </div>

        <div className="flex flex-col items-stretch justify-end gap-3 sm:flex-row sm:items-center sm:gap-6 border-t border-[#E5E7EB] bg-[#F8FAFC] px-4 sm:px-6 py-4 sm:px-8">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-12 px-2 text-sm font-bold text-[#344054] transition-colors hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !appointmentId || !selectedDate || !selectedTime}
            className="h-12 rounded-xl bg-[#023E8A] px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#023575] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Rescheduling..." : "Confirm Reschedule"}
          </button>
        </div>
      </div>
    </div>
  );
}




