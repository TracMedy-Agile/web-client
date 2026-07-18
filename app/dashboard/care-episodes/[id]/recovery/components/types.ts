export type InstructionType = "INSTRUCTION" | "REMINDER" | "FOLLOW-UP";

export type InstructionPatient = {
  id: string;
  name: string;
  status: string;
  time: string;
  preview: string;
  instruction: string;
};

export type SendPatientInstructionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName?: string;
  patientId?: string;
  episodeId?: string;
};
