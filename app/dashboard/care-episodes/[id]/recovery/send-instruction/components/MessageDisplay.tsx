"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InstructionPatient, InstructionType } from "../types";

function patientInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type MessageDisplayProps = {
  patient: InstructionPatient;
  instructionType: InstructionType;
};

export function MessageDisplay({ patient, instructionType }: MessageDisplayProps) {
  return (
    <>
      <div className="flex min-h-[64px] items-center justify-between border-b border-[#DDE3EC] px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFE0B5] to-[#E8874B] text-[10px] font-bold text-white">
            {patientInitials(patient.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#162033]">{patient.name}</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#E79A00]">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#F4B400]" />
              Moderate
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-lg border-[#0757A6] px-3 text-xs font-bold text-[#0757A6] hover:bg-[#EDF5FF] hover:text-[#0757A6] sm:px-4"
        >
          View Profile
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#F6F6F6] px-4 py-5 sm:px-6 sm:py-6">
        <div className="rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-md bg-[#E7F2FF] px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-[#2872C6]">
              REMINDER
            </span>
            <span className="text-[11px] font-medium text-[#667085]">Yesterday, 8:00 AM &bull; Dr. Emeka Nwosu</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#162033]">{patient.preview.replace(/\.\.\.$/, ".")}</p>
        </div>

        <div className="ml-auto mt-3 flex w-fit items-center gap-2 rounded-lg border border-[#B9EBD8] bg-[#F3FCF9] px-3 py-2 text-[10px] font-medium text-[#08A877]">
          <Check className="h-3.5 w-3.5 rounded-full border border-[#08A877] p-0.5" />
          <span className="font-bold">&check; Acknowledged</span>
          <span className="text-[#38B893]">Patient</span>
          <span className="ml-3">11:02 AM</span>
        </div>

        <div className="mt-5 rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-md bg-[#E7F2FF] px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-[#2872C6]">
              {instructionType}
            </span>
            <span className="text-[11px] font-medium text-[#667085]">10:45 AM &bull; Dr. Emeka Nwosu</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#344054]">{patient.instruction}</p>
        </div>
      </div>
    </>
  );
}
