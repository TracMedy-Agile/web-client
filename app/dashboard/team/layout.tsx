import RoleGuard from "@/components/auth/RoleGuard";

const HOSPITAL_ADMIN_ROLE = ["hospital_admin"] as const;

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard
      allowedRoles={HOSPITAL_ADMIN_ROLE}
      deniedDescription="Team management is restricted to authorized hospital administrators only."
    >
      {children}
    </RoleGuard>
  );
}
