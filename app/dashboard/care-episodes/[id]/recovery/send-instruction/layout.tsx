import RoleGuard from "@/components/auth/RoleGuard";

const CLINICIAN_ROLE = ["clinician"] as const;

export default function SendInstructionLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={CLINICIAN_ROLE} deniedDescription="Patient instructions are restricted to authorized clinicians only.">
      {children}
    </RoleGuard>
  );
}
