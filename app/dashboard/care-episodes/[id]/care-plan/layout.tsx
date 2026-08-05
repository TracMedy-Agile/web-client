import RoleGuard from "@/components/auth/RoleGuard";

const CLINICIAN_ROLE = ["clinician"] as const;

export default function CarePlanLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={CLINICIAN_ROLE} deniedDescription="Care-plan editing is restricted to authorized clinicians only.">
      {children}
    </RoleGuard>
  );
}
