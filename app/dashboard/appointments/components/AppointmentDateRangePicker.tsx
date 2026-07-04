"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type PickerStep = "year" | "month" | "day";

type CalendarDay = {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
};

const years = Array.from({ length: 12 }, (_, index) => 2021 + index);
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function buildCalendarDays(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      date,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
    };
  });
}

function formatSelectedDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

type AppointmentDateRangePickerProps = {
  dateFrom?: string;
  dateTo?: string;
  onChange?: (range: { dateFrom: string; dateTo: string }) => void;
};

function formatDateForApi(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseApiDate(value?: string) {
  if (!value) return null;
  const parsed = Date.parse(`${value}T00:00:00`);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

export default function AppointmentDateRangePicker({ dateFrom = "", dateTo = "", onChange }: AppointmentDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<PickerStep>("year");
  const [visibleYear, setVisibleYear] = useState(2026);
  const [visibleMonth, setVisibleMonth] = useState(3);
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => parseApiDate(dateFrom));

  const calendarDays = useMemo(() => buildCalendarDays(visibleYear, visibleMonth), [visibleYear, visibleMonth]);
  const selectedText = dateFrom && dateTo
    ? `${formatSelectedDate(parseApiDate(dateFrom) ?? selectedDate ?? new Date())} - ${formatSelectedDate(parseApiDate(dateTo) ?? selectedDate ?? new Date())}`
    : selectedDate
      ? formatSelectedDate(selectedDate)
      : "Date Range";

  const openPicker = () => {
    setIsOpen((current) => {
      const nextOpen = !current;

      if (nextOpen) {
        setStep("year");
      }

      return nextOpen;
    });
  };

  const selectYear = (year: number) => {
    setVisibleYear(year);
    setStep("month");
  };

  const selectMonth = (month: number) => {
    setVisibleMonth(month);
    setStep("day");
  };

  const moveMonth = (direction: -1 | 1) => {
    const nextDate = new Date(visibleYear, visibleMonth + direction, 1);
    setVisibleYear(nextDate.getFullYear());
    setVisibleMonth(nextDate.getMonth());
  };

  const selectDay = (day: CalendarDay) => {
    const nextDate = formatDateForApi(day.date);
    setSelectedDate(day.date);
    onChange?.({ dateFrom: nextDate, dateTo: nextDate });
    setVisibleYear(day.date.getFullYear());
    setVisibleMonth(day.date.getMonth());
    setIsOpen(false);
    setStep("year");
  };

  const isSameDay = (left: Date | null, right: Date) =>
    Boolean(
      left &&
        left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate(),
    );

  return (
    <div className="relative w-full xl:w-[150px]">
      <button
        type="button"
        onClick={openPicker}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-md border border-border bg-white px-3 text-sm font-medium text-[#71809B] focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <span className={cn("truncate", selectedDate || dateFrom || dateTo ? "text-[#344054]" : "text-[#71809B]")}>{selectedText}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-[#71809B]" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-12 z-50 w-[320px] rounded-md border border-border bg-white shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
          {step === "year" ? (
            <div className="p-3">
              <div className="mb-2 px-2 py-1 text-sm font-bold text-[#111827]">Select Year</div>
              <div className="max-h-[300px] overflow-y-auto py-1">
                {years.map((year) => (
                  <button
                    type="button"
                    key={year}
                    onClick={() => selectYear(year)}
                    className={cn(
                      "block h-9 w-full rounded-sm px-3 text-left text-sm font-medium transition-colors",
                      year === visibleYear ? "bg-primary text-white" : "text-[#344054] hover:bg-[#EEF4FF]",
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === "month" ? (
            <div className="p-4">
              <div className="mb-3 text-sm font-bold text-[#111827]">Select Month</div>
              <div className="grid grid-cols-3 gap-2">
                {months.map((month, index) => (
                  <button
                    type="button"
                    key={month}
                    onClick={() => selectMonth(index)}
                    className={cn(
                      "h-10 rounded-md px-2 text-center text-xs font-medium transition-colors",
                      index === visibleMonth ? "bg-primary text-white" : "border border-border text-[#344054] hover:bg-[#EEF4FF]",
                    )}
                  >
                    {month.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === "day" ? (
            <div className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#111827]">
                  {months[visibleMonth]} {visibleYear}
                </h3>
                <div className="flex items-center gap-4 text-primary">
                  <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 text-center text-xs font-medium text-[#71809B]">
                {weekdays.map((weekday) => (
                  <div key={weekday} className="py-2">
                    {weekday}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 text-center text-sm font-medium text-[#111827]">
                {calendarDays.map((day) => {
                  const isSelected = isSameDay(selectedDate, day.date);

                  return (
                    <button
                      type="button"
                      key={day.date.toISOString()}
                      onClick={() => selectDay(day)}
                      className={cn(
                        "flex h-8 items-center justify-center rounded-md transition-colors",
                        day.isCurrentMonth ? "text-[#111827]" : "text-[#8DA0BD]",
                        isSelected ? "bg-primary font-bold text-white" : "hover:bg-[#EEF4FF]",
                      )}
                    >
                      {day.day}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}



