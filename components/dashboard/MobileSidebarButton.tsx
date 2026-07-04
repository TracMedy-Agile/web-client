"use client";

import { Menu } from "lucide-react";

export default function MobileSidebarButton() {
  return (
    <button
      type="button"
      aria-label="Open sidebar"
      onClick={() => window.dispatchEvent(new Event("dashboard-sidebar:open"))}
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground md:hidden"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
