import { apiClient } from "@/lib/services/auth/api-client";
import MobileSidebarButton from "@/components/dashboard/MobileSidebarButton";
import { Bell, ChevronDown, Search } from "lucide-react";

async function getCurrentUser() {
  try {
    const res = await apiClient("/auth/me", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

function getInitials(name?: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface NavbarProps {
  title?: string;
}

export default async function Navbar({ title = "Dashboard" }: NavbarProps) {
  const user = await getCurrentUser();
  const name = user?.name ?? "User";
  const role = user?.specialty ?? user?.role ?? "";

  return (
    <header className="flex h-18 items-center justify-between border-b border-border bg-card px-3 py-3 md:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <MobileSidebarButton />
        <h1 className="text-lg font-semibold text-foreground md:text-xl">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search patients, alerts..."
            className="w-72 rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/30 text-primary hover:bg-secondary/50"
        >
          <Bell className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {getInitials(name)}
          </div>
          <div className="text-sm">
            <p className="font-semibold text-foreground">{name}</p>
            <p className="text-muted-foreground">{role}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </header>
  );
}


