"use client";

import { Search, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InstructionPatient } from "../types";

const AVATAR_STYLES = [
  "bg-gradient-to-br from-[#FFE0B5] to-[#E8874B]",
  "bg-gradient-to-br from-[#BDD7E9] to-[#3B556A]",
  "bg-gradient-to-br from-[#E9E4DF] to-[#867D76]",
  "bg-gradient-to-br from-[#AEE7DD] to-[#187D76]",
];

function patientInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function statusIcon(status: string) {
  if (status === "Acknowledged by patient") {
    return <CheckCheck aria-hidden="true" className="h-3.5 w-3.5 text-[#0067B9]" />;
  }
  return <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#0757A6]" />;
}

type PatientListProps = {
  patients: InstructionPatient[];
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
};

export function PatientList({
  patients,
  selectedPatientId,
  onSelectPatient,
  searchQuery,
  onSearchChange,
}: PatientListProps) {
  const visiblePatients = patients.filter((patient) =>
    patient.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  return (
    <aside className="flex min-h-0 min-w-0 w-full flex-col overflow-hidden border-b border-[#DDE3EC] bg-white md:h-full md:w-[35%] md:border-b-0 md:border-r">
      <div className="border-b border-[#E8ECF2] p-4 sm:px-5">
        <label className="flex h-10 items-center gap-2.5 rounded-lg bg-[#F1F4F8] px-3 text-[#8A94A6] focus-within:ring-2 focus-within:ring-[#0B5CAB]/20">
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Search patients</span>
          <input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search patients..."
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#8A94A6]"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visiblePatients.map((patient, index) => {
          const selected = patient.id === selectedPatientId;
          return (
            <button
              key={patient.id}
              type="button"
              onClick={() => onSelectPatient(patient.id)}
              aria-pressed={selected}
              className={cn(
                "flex w-full items-start gap-3 border-b border-[#EEF1F5] px-4 py-4 text-left transition-colors sm:px-5",
                selected ? "bg-[#DCE9FC]" : "bg-white hover:bg-[#F7F9FC]",
              )}
            >
              <span
                className={cn(
                  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm",
                  AVATAR_STYLES[index % AVATAR_STYLES.length],
                )}
              >
                {patientInitials(patient.name)}
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-[#18B56B]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="truncate text-sm font-bold text-[#162033]">{patient.name}</span>
                  <span className="shrink-0 text-[10px] font-medium text-[#6B7A94]">{patient.time}</span>
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium text-[#526784]">{patient.status}</span>
                  {statusIcon(patient.status)}
                </span>
                <span className="mt-2 hidden line-clamp-2 text-xs leading-5 text-[#7A879C] lg:block">
                  {patient.preview}
                </span>
              </span>
            </button>
          );
        })}
        {visiblePatients.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#71809B]">No patients found.</p>
        ) : null}
      </div>
    </aside>
  );
}
