"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AlertTriangle, Building2, Cable, CreditCard, LockKeyhole, SlidersHorizontal, UsersRound } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard/settings", label: "Hospital Profile", icon: Building2 },
  { href: "/dashboard/settings/configuration", label: "Configuration Control", icon: SlidersHorizontal },
  { href: "/dashboard/settings/notifications", label: "Notification Preferences", icon: AlertTriangle },
  { href: "/dashboard/settings/security", label: "Security", icon: LockKeyhole },
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
    <div className="-m-3 min-h-[calc(100vh-5.5rem)] bg-muted/40 md:-m-6 lg:-m-8">
      <div className="border-b border-border bg-card px-5 py-6 md:px-8">
        <h2 className="text-2xl font-bold text-foreground">Account Settings</h2>
      </div>

      <div className="flex min-h-[calc(100vh-11rem)] flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-border bg-card shadow-sm lg:w-[273px] lg:border-b-0 lg:border-r">
          <nav aria-label="Settings sections" className="py-8">
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
                        "flex min-h-14 items-center gap-3 px-8 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        active ? "bg-sky-100 text-primary" : "text-foreground hover:bg-muted hover:text-primary",
                      )}
                    >
                      <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "text-foreground")} aria-hidden />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-9 sm:px-8 lg:px-12">{children}</main>
      </div>
    </div>
  );
}
