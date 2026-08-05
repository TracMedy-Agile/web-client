import RoleGuard from "@/components/auth/RoleGuard";

const STAFF_ROLES = ["clinician", "hospital_admin"] as const;

export default function AvailabilityLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard
      allowedRoles={STAFF_ROLES}
      deniedDescription="Availability Management is restricted to authorized hospital staff only."
    >
      {children}
    </RoleGuard>
  );
}
