"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { InstructionPatient, InstructionType } from "./types";
import { PatientList } from "./components/PatientList";
import { MessageDisplay } from "./components/MessageDisplay";
import { InstructionComposer } from "./components/InstructionComposer";

const PATIENTS: InstructionPatient[] = [
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

export default function SendInstructionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const episodeId = params?.id ?? "";

  const [selectedPatientId, setSelectedPatientId] = useState(PATIENTS[0].id);
  const [instructionType, setInstructionType] = useState<InstructionType>("INSTRUCTION");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const selectedPatient =
    PATIENTS.find((patient) => patient.id === selectedPatientId) ?? PATIENTS[0];

  return (
    <div className="flex h-[calc(100vh-120px)] min-h-0 flex-col overflow-hidden rounded-xl border border-[#DDE3EC] bg-white shadow-sm">
      <div className="flex h-[76px] shrink-0 items-center gap-4 border-b border-[#DDE3EC] px-5 sm:px-6">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/care-episodes/${episodeId}/recovery`)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#667085] transition-colors hover:bg-[#F2F4F7] hover:text-[#111827]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-[#111827]">Messages</h1>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
        <PatientList
          patients={PATIENTS}
          selectedPatientId={selectedPatientId}
          onSelectPatient={setSelectedPatientId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <section className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-white">
          <MessageDisplay patient={selectedPatient} instructionType={instructionType} />
          <InstructionComposer
            selectedPatient={selectedPatient}
            instructionType={instructionType}
            message={message}
            onInstructionTypeChange={setInstructionType}
            onMessageChange={setMessage}
          />
        </section>
      </div>
    </div>
  );
}
