export type InstructionType = "INSTRUCTION" | "REMINDER" | "FOLLOW-UP";

export type InstructionPatient = {
  id: string;
  name: string;
  status: string;
  time: string;
  preview: string;
  instruction: string;
};
