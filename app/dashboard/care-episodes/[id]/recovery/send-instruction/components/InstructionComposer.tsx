"use client";

import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { InstructionPatient, InstructionType } from "../types";

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

type InstructionComposerProps = {
  selectedPatient: InstructionPatient;
  instructionType: InstructionType;
  message: string;
  onInstructionTypeChange: (type: InstructionType) => void;
  onMessageChange: (message: string) => void;
};

export function InstructionComposer({
  selectedPatient,
  instructionType,
  message,
  onInstructionTypeChange,
  onMessageChange,
}: InstructionComposerProps) {
  const insertSuggestion = (suggestion: string) => {
    onMessageChange(message.trim() ? `${message.trim()} ${suggestion}` : suggestion);
  };

  const handleSend = () => {
    if (!message.trim()) {
      toast.error("Write an instruction before sending.");
      return;
    }
    toast.success(`Instruction sent to ${selectedPatient.name}.`);
    onMessageChange("");
  };

  return (
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
            onClick={() => onInstructionTypeChange(type)}
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
          onChange={(event) => onMessageChange(event.target.value)}
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
  );
}
