"use client";

import { useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, CheckCheck, Search, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  InstructionPatient,
  InstructionType,
  SendPatientInstructionModalProps,
} from "./types";

export const PATIENTS: InstructionPatient[] = [
  {
    id: "1",
    name: "Amara Okonkwo",
    status: "Instruction sent",
    time: "12:45 PM",
    preview:
      "Remember to log your pain level scale in the mobile interface before the 9:00 AM nursing check-in...",
    instruction:
      "Amara, please ensure you are consuming at least 500ml of fluids every 2 hours as discussed during rounds. This is critical for your renal recovery during the HT-402 protocol. Let us know if you experience any nausea.",
  },
  {
    id: "2",
    name: "Kofi Mensah",
    status: "Acknowledged by patient",
    time: "09:15 AM",
    preview:
      "Remember to log your pain level scale in the mobile interface before the 9:00 AM nursing check-in...",
    instruction:
      "Hi Amara, we noticed you missed your last two PM doses of Rivaroxaban. It's important to stay consistent with this medication for your recovery.",
  },
  {
    id: "3",
    name: "Rahemat Maria",
    status: "Medication reminder sent",
    time: "Yesterday",
    preview:
      "Reviewing your afternoon stats. The slight increase in mobility is encouraging...",
    instruction:
      "Reviewing your afternoon stats. The slight increase in mobility is encouraging. Please continue the light seated exercises once more this evening before sleep.",
  },
  {
    id: "4",
    name: "David Chineye",
    status: "Follow-up sent",
    time: "Tuesday",
    preview:
      "Reviewing your afternoon stats. The slight increase in mobility is encouraging...",
    instruction: "Continue the light seated exercises once more this evening before sleep.",
  },
];

const INSTRUCTION_TYPES: InstructionType[] = ["INSTRUCTION", "REMINDER", "FOLLOW-UP"];

const SUGGESTIONS = [
  {
    label: "Medication reminder",
    text: "Please remember to take your medication as prescribed and let us know if you experience any side effects.",
  },
  {
    label: "Follow-up guidance",
    text: "Please continue following your recovery plan. We will review your progress at your next follow-up.",
  },
  {
    label: "Symptom check",
    text: "How are your symptoms today? Please tell us if anything has changed since your last check-in.",
  },
];

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

export function SendPatientInstructionModal({
  open,
  onOpenChange,
  patientName,
  patientId,
  episodeId,
}: SendPatientInstructionModalProps) {
  const initialPatientId = useMemo(
    () =>
      PATIENTS.find((patient) => patient.id === patientId)?.id ??
      PATIENTS.find((patient) => patient.name.toLowerCase() === patientName?.toLowerCase())?.id ??
      PATIENTS[0].id,
    [patientId, patientName],
  );

  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId);
  const [instructionType, setInstructionType] = useState<InstructionType>("INSTRUCTION");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const selectedPatient =
    PATIENTS.find((patient) => patient.id === selectedPatientId) ?? PATIENTS[0];

  const visiblePatients = PATIENTS.filter((patient) =>
    patient.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  const insertSuggestion = (suggestion: string) => {
    setMessage((current) => (current.trim() ? `${current.trim()} ${suggestion}` : suggestion));
  };

  const handleSend = () => {
    if (!message.trim()) {
      toast.error("Write an instruction before sending.");
      return;
    }

    toast.success(`Instruction sent to ${selectedPatient.name}.`);
    setMessage("");
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#111827]/60 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          data-episode-id={episodeId}
          className="fixed left-1/2 top-1/2 z-50 h-[90vh] max-h-[900px] w-[calc(100vw-2rem)] max-w-[1200px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-[0_28px_80px_rgba(15,23,42,0.36)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <div className="flex h-[76px] items-center justify-between border-b border-[#DDE3EC] px-5 sm:px-6">
            <DialogPrimitive.Title className="text-lg font-bold text-[#111827]">
              Messages
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Select a patient, review their instructions, and compose a new message.
            </DialogPrimitive.Description>
            <DialogPrimitive.Close
              aria-label="Close messages"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#667085] transition-colors hover:bg-[#F2F4F7] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5CAB]"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex h-[calc(100%-76px)] min-h-0 min-w-0 flex-col overflow-hidden md:flex-row">
            <aside className="flex h-[34%] min-h-0 min-w-0 w-full flex-col overflow-hidden border-b border-[#DDE3EC] bg-white md:h-full md:w-[35%] md:border-b-0 md:border-r">
              <div className="border-b border-[#E8ECF2] p-4 sm:px-5">
                <label className="flex h-10 items-center gap-2.5 rounded-lg bg-[#F1F4F8] px-3 text-[#8A94A6] focus-within:ring-2 focus-within:ring-[#0B5CAB]/20">
                  <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="sr-only">Search patients</span>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search patients..."
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#8A94A6]"
                  />
                </label>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {visiblePatients.map((patient, index) => {
                  const selected = patient.id === selectedPatient.id;
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => setSelectedPatientId(patient.id)}
                      aria-pressed={selected}
                      className={cn(
                        "flex w-full items-start gap-3 border-b border-[#EEF1F5] px-4 py-4 text-left transition-colors sm:px-5",
                        selected ? "bg-[#DCE9FC]" : "bg-white hover:bg-[#F7F9FC]",
                      )}
                    >
                      <span
                        className={cn(
                          "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm",
                          AVATAR_STYLES[index],
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

            <section className="flex h-[66%] min-h-0 min-w-0 w-full flex-col overflow-hidden bg-white md:h-full md:w-[65%]">
              <div className="flex min-h-[64px] items-center justify-between border-b border-[#DDE3EC] px-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFE0B5] to-[#E8874B] text-[10px] font-bold text-white">
                    {patientInitials(selectedPatient.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#162033]">{selectedPatient.name}</p>
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
                    <span className="text-[11px] font-medium text-[#667085]">Yesterday, 8:00 AM • Dr. Emeka Nwosu</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#162033]">{selectedPatient.preview.replace(/\.\.\.$/, ".")}</p>
                </div>

                <div className="ml-auto mt-3 flex w-fit items-center gap-2 rounded-lg border border-[#B9EBD8] bg-[#F3FCF9] px-3 py-2 text-[10px] font-medium text-[#08A877]">
                  <Check className="h-3.5 w-3.5 rounded-full border border-[#08A877] p-0.5" />
                  <span className="font-bold">✓ Acknowledged</span>
                  <span className="text-[#38B893]">Patient</span>
                  <span className="ml-3">11:02 AM</span>
                </div>

                <div className="mt-5 rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-md bg-[#E7F2FF] px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-[#2872C6]">
                      {instructionType}
                    </span>
                    <span className="text-[11px] font-medium text-[#667085]">10:45 AM • Dr. Emeka Nwosu</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#344054]">{selectedPatient.instruction}</p>
                </div>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSend();
                }}
                className="min-w-0 shrink-0 overflow-hidden border-t border-[#DDE3EC] bg-white px-4 py-3 sm:px-6 sm:py-4"
              >
                <div role="tablist" aria-label="Instruction type" className="flex gap-4 border-b border-[#E8ECF2] sm:gap-6">
                  {INSTRUCTION_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      role="tab"
                      aria-selected={instructionType === type}
                      onClick={() => setInstructionType(type)}
                      className={cn(
                        "relative pb-2.5 text-[11px] font-bold tracking-[0.04em] transition-colors",
                        instructionType === type ? "text-[#064B91]" : "text-[#71809B] hover:text-[#344054]",
                      )}
                    >
                      {type}
                      {instructionType === type ? (
                        <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[#064B91]" />
                      ) : null}
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="mr-0.5 text-[9px] font-bold uppercase text-[#91A0B8]">Suggestions:</span>
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => insertSuggestion(suggestion.text)}
                      className="rounded-full border border-[#D7DEE8] bg-[#F6F7F9] px-3 py-1.5 text-[10px] font-medium text-[#344054] transition-colors hover:border-[#0757A6] hover:bg-[#EDF5FF] hover:text-[#0757A6]"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>

                <div className="relative mt-3 overflow-hidden rounded-lg border border-[#D4DFEC] bg-[#F7F9FB] focus-within:border-[#0B5CAB] focus-within:ring-2 focus-within:ring-[#0B5CAB]/10">
                  <Textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Write instruction..."
                    aria-label={`Write ${instructionType.toLowerCase()} for ${selectedPatient.name}`}
                    className="min-h-[92px] resize-none rounded-none border-0 bg-transparent px-4 py-3 pr-4 text-sm leading-6 text-[#344054] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:min-h-[104px] sm:pb-12"
                  />
                  <div className="flex justify-end border-t border-[#E3E8EF] bg-white px-3 py-2 sm:absolute sm:inset-x-0 sm:bottom-0 sm:border-t-0 sm:bg-transparent">
                    <Button
                      type="submit"
                      className="h-9 rounded-lg bg-[#064B91] px-4 text-xs font-bold text-white hover:bg-[#023E8A]"
                    >
                      Send Instruction
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </form>
            </section>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
