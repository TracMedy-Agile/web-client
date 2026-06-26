"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  ClipboardList,
  CalendarCheck,
  AlertTriangle,
  MessageSquare,
  BarChart2,
  Users,
  ClipboardCheck,
  Settings,
  PanelLeft,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Care Episodes", href: "/dashboard/care-episodes", icon: ClipboardList },
  { label: "Appointments", href: "/dashboard/appointments", icon: CalendarCheck },
  { label: "Alerts", href: "/dashboard/alerts", icon: AlertTriangle },
  { label: "Messages", href: "/dashboard/messages", icon: MessageSquare },
  { label: "Report & Analytics", href: "/dashboard/reports", icon: BarChart2 },
  { label: "Team", href: "/dashboard/team", icon: Users },
  { label: "Audit", href: "/dashboard/audit", icon: ClipboardCheck },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-55 shrink-0 flex-col bg-[#023E8A] text-white">
      <div className="flex items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2">
          <Image src="/favicon.svg" alt="Tracmedy" width={40} height={40} />
          <span className="text-lg font-bold tracking-wide">TRACMEDY</span>
        </div>
        <button type="button" aria-label="Toggle sidebar" className="text-white/70 hover:text-white">
          <PanelLeft className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-blue-600 text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="relative m-4 rounded-xl bg-white/10 p-4">
        <button type="button" aria-label="Dismiss" className="absolute right-3 top-3 text-white/60 hover:text-white">
          <X className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold">Unlock Pro</p>
        <p className="mt-1 text-xs text-white/70">
          Add more team members, and deeper patient insights
        </p>
        <button
          type="button"
          className="mt-3 w-full rounded-lg bg-white py-2 text-sm font-semibold text-primary hover:bg-white/90"
        >
          Upgrade Plan
        </button>
      </div>
    </aside>
  );
}
