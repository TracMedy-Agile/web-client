import RoleGuard from "@/components/auth/RoleGuard";

const CLINICIAN_ROLE = ["clinician"] as const;

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard
      allowedRoles={CLINICIAN_ROLE}
      deniedDescription="Messaging is restricted to authorized clinicians only."
    >
      {children}
    </RoleGuard>
  );
}
