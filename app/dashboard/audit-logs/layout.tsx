import RoleGuard from "@/components/auth/RoleGuard";

const HOSPITAL_ADMIN_ROLE = ["hospital_admin"] as const;

export default function AuditLogsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard
      allowedRoles={HOSPITAL_ADMIN_ROLE}
      deniedDescription="Audit Log is restricted to authorized hospital administrators only."
    >
      {children}
    </RoleGuard>
  );
}
