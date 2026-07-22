import { ChevronDown, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import AppointmentDateRangePicker from "./AppointmentDateRangePicker";

type CalendarMode = "day" | "week";

export type AppointmentListFilters = {
  status: string;
  dateFrom: string;
  dateTo: string;
  facilityId?: string;
  search: string;
  department: string;
  type: string;
};

type AppointmentFiltersProps = {
  view: "table" | "calendar";
  calendarMode: CalendarMode;
  onCalendarModeChange: (mode: CalendarMode) => void;
  filters?: AppointmentListFilters;
  onFiltersChange?: (filters: AppointmentListFilters) => void;
  onExport?: () => void;
};

const statusOptions = [
  { label: "All Status", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Checked In", value: "checked_in" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "No Show", value: "no_show" },
];

const departmentOptions = [
  { label: "All Departments", value: "all" },
  { label: "Cardiology", value: "Cardiology" },
  { label: "Obstetrics", value: "Obstetrics" },
  { label: "Pulmonology", value: "Pulmonology" },
  { label: "General Surgery", value: "General Surgery" },
  { label: "Endocrinology", value: "Endocrinology" },
];

const typeOptions = [
  { label: "Appointment type", value: "all" },
  { label: "Physical Visit", value: "in_person" },
  { label: "Teleconsultation", value: "teleconsultation" },
  { label: "Nurse Check-in", value: "nurse_checkin" },
];

const defaultFilters: AppointmentListFilters = {
  status: "all",
  dateFrom: "",
  dateTo: "",
  search: "",
  department: "all",
  type: "all",
};

function FilterButton({
  children,
  className,
  hasChevron = true,
}: {
  children: React.ReactNode;
  className?: string;
  hasChevron?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-10 items-center justify-between gap-3 rounded-md border border-border bg-white px-3 text-sm font-medium text-[#71809B]",
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {hasChevron ? <ChevronDown className="h-4 w-4 shrink-0" /> : null}
    </button>
  );
}

function FilterSelect({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <span className={cn("relative block", className)}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-md border border-border bg-white px-3 pr-9 text-sm font-medium text-[#71809B] focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71809B]" />
    </span>
  );
}

export default function AppointmentFilters({
  view,
  calendarMode,
  onCalendarModeChange,
  filters = defaultFilters,
  onFiltersChange,
  onExport,
}: AppointmentFiltersProps) {
  const updateFilter = (key: keyof AppointmentListFilters, value: string) => {
    onFiltersChange?.({ ...filters, [key]: value });
  };

  if (view === "calendar") {
    return (
      <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <FilterButton className="w-full sm:w-[120px]">All Status</FilterButton>
          <FilterButton className="w-full sm:w-[155px]">All Departments</FilterButton>
          <FilterButton className="w-full sm:w-[170px]">Appointment type</FilterButton>
        </div>

        <div className="flex items-center justify-center gap-5 text-[#111827]">
          <button type="button" aria-label="Previous day" className="text-[#111827]">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="whitespace-nowrap text-lg font-bold md:text-xl">Monday,Oct 21, 2024</p>
          <button type="button" aria-label="Next day" className="text-[#111827]">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="inline-flex h-10 self-start rounded-xl bg-[#E7F2FF] p-1 xl:self-auto">
          <button
            type="button"
            onClick={() => onCalendarModeChange("day")}
            className={cn(
              "rounded-lg px-4 text-xs transition-colors",
              calendarMode === "day" ? "bg-white font-semibold text-[#111827] shadow-sm" : "font-medium text-[#71809B]",
            )}
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => onCalendarModeChange("week")}
            className={cn(
              "rounded-lg px-4 text-xs transition-colors",
              calendarMode === "week" ? "bg-white font-semibold text-[#111827] shadow-sm" : "font-medium text-[#71809B]",
            )}
          >
            Week
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-7 flex flex-col gap-3 xl:flex-row xl:items-center">
      <div className="relative h-10 w-full xl:max-w-[330px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#71809B]" />
        <input
          type="text"
          placeholder="Search by name, ID, Department"
          value={filters.search}
          onChange={(event) => updateFilter("search", event.target.value)}
          className="h-full w-full rounded-md border border-border bg-white pl-10 pr-3 text-sm font-medium text-[#344054] placeholder:text-[#71809B] focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <FilterSelect className="w-full xl:w-[120px]" value={filters.status} options={statusOptions} onChange={(value) => updateFilter("status", value)} />
      <FilterSelect className="w-full xl:w-[155px]" value={filters.department} options={departmentOptions} onChange={(value) => updateFilter("department", value)} />
      <FilterSelect className="w-full xl:w-[170px]" value={filters.type} options={typeOptions} onChange={(value) => updateFilter("type", value)} />
      <AppointmentDateRangePicker
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onChange={({ dateFrom, dateTo }) => onFiltersChange?.({ ...filters, dateFrom, dateTo })}
      />

      <button
        type="button"
        onClick={onExport}
        className="flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-[#111827] xl:ml-auto"
      >
        <Download className="h-4 w-4" />
        Export
      </button>
    </div>
  );
}

