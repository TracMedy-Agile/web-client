"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";
import MobileSidebarButton from "@/components/dashboard/MobileSidebarButton";
import { Bell, ChevronDown, LogOut, Search } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL;

interface CurrentUser {
  name?: string;
  role?: string;
  specialty?: string;
}

async function getAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/get-token");
    const { accessToken } = await res.json();
    return typeof accessToken === "string" ? accessToken : null;
  } catch {
    return null;
  }
}

async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(`${BASE}/auth/me`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
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

export default function Navbar({ title = "Dashboard" }: NavbarProps) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    getCurrentUser().then((currentUser) => {
      if (isMounted) setUser(currentUser);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const name = user?.name ?? "User";
  const role = user?.specialty ?? user?.role ?? "";

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsMenuOpen(false);
      setIsLoggingOut(false);
      router.push("/login");
    }
  }

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

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            className="flex items-center gap-2"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {getInitials(name)}
            </div>
            <div className="text-sm text-left">
              <p className="font-semibold text-foreground">{name}</p>
              <p className="text-muted-foreground">{role}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>

          {isMenuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-card p-4 shadow-lg"
            >
              <div className="flex items-center gap-3 p-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {getInitials(name)}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{name}</p>
                  <p className="text-sm text-muted-foreground">{role}</p>
                </div>
              </div>

              <div className="my-3 border-t border-border p-1" />

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex w-full items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? "Logging out..." : "Log Out"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
