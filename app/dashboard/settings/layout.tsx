"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Bell, Building2, Cable, CalendarClock, CreditCard, ShieldCheck, SlidersHorizontal, UsersRound } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard/settings", label: "Hospital Profile", icon: Building2 },
  { href: "/dashboard/settings/configuration", label: "Configuration", icon: SlidersHorizontal },
  { href: "/dashboard/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/settings/security", label: "Security", icon: ShieldCheck },
  { href: "/dashboard/settings/appointment", label: "Appointment", icon: CalendarClock },
  { href: "/dashboard/settings/integrations", label: "Integrations", icon: Cable },
  { href: "/dashboard/settings/billing", label: "Billing & Subscription", icon: CreditCard },
  { href: "/dashboard/settings/roles", label: "Roles & Permissions", icon: UsersRound },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard/settings") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 lg:flex-row">
      <aside className="shrink-0 rounded-lg border border-border bg-card shadow-sm lg:w-[280px]">
        <div className="border-b border-border px-5 py-5">
          <p className="text-sm font-semibold text-muted-foreground">Settings</p>
          <h2 className="mt-1 text-xl font-bold text-foreground">Account Settings</h2>
        </div>

        <nav aria-label="Settings sections" className="p-3">
          <ul className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
