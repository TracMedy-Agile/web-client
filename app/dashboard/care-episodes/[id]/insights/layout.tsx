import RoleGuard from "@/components/auth/RoleGuard";

const CLINICIAN_ROLE = ["clinician"] as const;

export default function PatientInsightsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={CLINICIAN_ROLE} deniedDescription="Patient Insights is restricted to authorized clinicians only.">
      {children}
    </RoleGuard>
  );
}
