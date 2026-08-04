import RoleGuard from "@/components/auth/RoleGuard";

const STAFF_ROLES = ["clinician", "hospital_admin"] as const;

export default function ClinicianWorkloadLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard
      allowedRoles={STAFF_ROLES}
      deniedDescription="Facility-wide clinician workload is restricted to authorized hospital staff only."
    >
      {children}
    </RoleGuard>
  );
}
