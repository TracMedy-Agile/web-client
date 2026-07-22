"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
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
  UserCog,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Connected Patients", href: "/dashboard/connected-patients", icon: Users },
  { label: "Care Episodes", href: "/dashboard/care-episodes", icon: ClipboardList },
  { label: "Appointments", href: "/dashboard/appointments", icon: CalendarCheck },
  { label: "Alerts", href: "/dashboard/alerts", icon: AlertTriangle },
  { label: "Messages", href: "/dashboard/messages", icon: MessageSquare },
  { label: "Report & Analytics", href: "/dashboard/reports", icon: BarChart2 },
  { label: "Team", href: "/dashboard/team", icon: UserCog },
  { label: "Audit", href: "/dashboard/audit", icon: ClipboardCheck },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

function isNavItemActive(pathname: string, href: string) {
  if (pathname.startsWith("/dashboard/appointments")) {
    return href === "/dashboard/appointments";
  }

  if (pathname === "/dashboard/connected-patients" || pathname.startsWith("/dashboard/connected-patients/")) {
    return href === "/dashboard/connected-patients";
  }

  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showUnlockPro, setShowUnlockPro] = useState(true);

  useLayoutEffect(() => {
    const storedState = window.localStorage.getItem("dashboard-sidebar-collapsed");
    if (storedState) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsCollapsed(storedState === "true");
    }
  }, []);

  useLayoutEffect(() => {
    const dismissed = localStorage.getItem("unlock-pro-dismissed");
    if (dismissed === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowUnlockPro(false);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("unlock-pro-dismissed", "true");
    setShowUnlockPro(false);
  };

  useEffect(() => {
    window.localStorage.setItem("dashboard-sidebar-collapsed", String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    const openSidebar = () => setIsMobileOpen(true);
    window.addEventListener("dashboard-sidebar:open", openSidebar);
    return () => window.removeEventListener("dashboard-sidebar:open", openSidebar);
  }, []);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileOpen(false);
  }, [pathname]);

  const sidebar = (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col bg-[#023E8A] text-white transition-[width,transform] duration-200 ease-in-out",
        isCollapsed ? "md:w-16" : "md:w-16 lg:w-55",
        "w-55",
        isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        "fixed inset-y-0 left-0 z-50 md:relative md:z-auto",
      )}
    >
      <div className={cn("flex items-center py-6", isCollapsed ? "justify-center px-3" : "justify-center px-3 lg:justify-between lg:px-5")}>
        <div className="flex min-w-0 items-center gap-2">
          <Image src="/favicon.svg" alt="Tracmedy" width={40} height={40} className="shrink-0" />
          {!isCollapsed ? <span className="hidden truncate text-lg font-bold tracking-wide lg:inline">TRACMEDY</span> : null}
        </div>
        <button
          type="button"
          aria-label="Toggle sidebar"
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          className={cn("hidden text-white/70 hover:text-white lg:block", isCollapsed && "absolute right-2 top-7")}
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = isNavItemActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              title={isCollapsed ? label : label}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isCollapsed ? "justify-center px-2" : "justify-center px-2 lg:justify-start lg:px-3",
                isActive ? "bg-blue-600 text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed ? <span className="hidden truncate lg:inline">{label}</span> : null}
            </Link>
          );
        })}
      </nav>

      {!isCollapsed && showUnlockPro ? (
        <div className="relative m-4 hidden rounded-xl bg-white/10 p-4 lg:block">
          <button type="button" aria-label="Dismiss" onClick={handleDismiss} className="absolute right-3 top-3 text-white/60 hover:text-white">
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
      ) : null}
    </aside>
  );

  return (
    <>
      {isMobileOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      ) : null}
      {sidebar}
    </>
  );
}


