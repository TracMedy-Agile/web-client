"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";
import MobileSidebarButton from "@/components/dashboard/MobileSidebarButton";
import { Bell, ChevronDown, LogOut, Search } from "lucide-react";

import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationRecord,
} from '@/lib/api/notifications';
import { CheckCheck, Loader2 } from 'lucide-react';

const BASE = process.env.NEXT_PUBLIC_API_URL;

function notificationDestination(notification: NotificationRecord) {
  const { data, type } = notification;
  const href = typeof data.href === 'string' ? data.href : typeof data.url === 'string' ? data.url : '';
  if (href.startsWith('/dashboard')) return href;
  if (typeof data.appointmentId === 'string') return `/dashboard/appointments/${data.appointmentId}`;
  if (typeof data.episodeId === 'string') {
    if (type.toLowerCase().includes('message')) {
      return `/dashboard/messages?${new URLSearchParams({ episodeId: data.episodeId })}`;
    }
    return `/dashboard/care-episodes/${data.episodeId}`;
  }
  if (typeof data.patientId === 'string') return `/dashboard/connected-patients/${data.patientId}`;
  if (type.toLowerCase().includes('alert')) return '/dashboard/alerts';
  return '';
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

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
    return json?.data?.user ?? json?.data ?? null;
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

const DASHBOARD_ROUTE_TITLES = [
  { href: "/dashboard/connected-patients", title: "Connected Patients" },
  { href: "/dashboard/care-episodes", title: "Care Episodes" },
  { href: "/dashboard/appointments", title: "Appointments" },
  { href: "/dashboard/access-denied", title: "Access Denied" },
  { href: "/dashboard/alerts", title: "Alerts" },
  { href: "/dashboard/messages", title: "Messages" },
  { href: "/dashboard/reports", title: "Report & Analytics" },
  { href: "/dashboard/team", title: "Team" },
  { href: "/dashboard/audit-logs", title: "Audit Log" },
  { href: "/dashboard/settings", title: "Settings" },
] as const;

function getDashboardRouteTitle(pathname: string) {
  return DASHBOARD_ROUTE_TITLES.find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  )?.title ?? "Dashboard";
}

export default function Navbar({ title = "Dashboard" }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const notificationRef = useRef<HTMLDivElement>(null);

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
    let active = true;
    getUnreadNotificationCount()
      .then((count) => {
        if (active) setUnreadCount(count);
      })
      .catch(() => undefined);
    return () => {
      active = false;
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

  useEffect(() => {
    if (!isNotificationsOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationsOpen]);

  const name = user?.name ?? "User";
  const role = user?.specialty ?? user?.role ?? "";
  const resolvedTitle = title === "Dashboard" ? getDashboardRouteTitle(pathname) : title;

  async function loadNotifications() {
    setIsLoadingNotifications(true);
    setNotificationsError('');
    try {
      const page = await getNotifications(1, 10);
      setNotifications(page.items);
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : 'Unable to load notifications.');
    } finally {
      setIsLoadingNotifications(false);
    }
  }

  function handleNotificationsToggle() {
    const nextOpen = !isNotificationsOpen;
    setIsNotificationsOpen(nextOpen);
    setIsMenuOpen(false);
    if (nextOpen) void loadNotifications();
  }

  async function handleNotificationClick(notification: NotificationRecord) {
    if (notification.readAt === null) {
      try {
        await markNotificationAsRead(notification.id);
        const readAt = new Date().toISOString();
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt } : item));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (error) {
        setNotificationsError(error instanceof Error ? error.message : 'Unable to mark notification as read.');
        return;
      }
    }
    const destination = notificationDestination(notification);
    if (destination) router.push(destination);
    setIsNotificationsOpen(false);
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsAsRead();
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
      setUnreadCount(0);
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : 'Unable to mark notifications as read.');
    }
  }

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
    <header className="flex h-22 items-center justify-between border-b border-border bg-card px-3 py-3 md:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <MobileSidebarButton />
        <h1 className="text-lg font-semibold text-foreground md:text-xl">{resolvedTitle}</h1>
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

        <div className={'relative'} ref={notificationRef}>
        <button
          onClick={handleNotificationsToggle}
          aria-expanded={isNotificationsOpen}
          type="button"
          aria-label="Notifications"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/30 text-primary hover:bg-secondary/50"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className={'absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white'}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>
        {isNotificationsOpen ? (
          <div role={'menu'} className={'absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border bg-card shadow-xl'}>
            <div className={'flex items-center justify-between border-b border-border px-4 py-3'}>
              <div>
                <p className={'text-sm font-bold text-foreground'}>Notifications</p>
                <p className={'text-xs text-muted-foreground'}>{unreadCount} unread</p>
              </div>
              {unreadCount > 0 ? (
                <button type={'button'} onClick={() => void handleMarkAllRead()} className={'inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline'}>
                  <CheckCheck className={'h-4 w-4'} /> Mark all read
                </button>
              ) : null}
            </div>
            <div className={'max-h-96 overflow-y-auto'}>
              {isLoadingNotifications ? (
                <div className={'flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground'}>
                  <Loader2 className={'h-4 w-4 animate-spin'} /> Loading notifications...
                </div>
              ) : notificationsError ? (
                <div className={'px-4 py-8 text-center'}>
                  <p className={'text-sm text-destructive'}>{notificationsError}</p>
                  <button type={'button'} onClick={() => void loadNotifications()} className={'mt-3 text-xs font-bold text-primary hover:underline'}>Try again</button>
                </div>
              ) : notifications.length === 0 ? (
                <p className={'px-4 py-10 text-center text-sm text-muted-foreground'}>No notifications yet.</p>
              ) : notifications.map((notification) => (
                <button
                  key={notification.id}
                  type={'button'}
                  onClick={() => void handleNotificationClick(notification)}
                  className={`block w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/60 ${notification.readAt === null ? 'bg-primary/5' : 'bg-card'}`}
                >
                  <span className={'flex items-start gap-3'}>
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.readAt === null ? 'bg-primary' : 'bg-transparent'}`} />
                    <span className={'min-w-0 flex-1'}>
                      <span className={'block text-sm font-semibold text-foreground'}>{notification.title}</span>
                      <span className={'mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground'}>{notification.body}</span>
                      <span className={'mt-1.5 block text-[11px] text-muted-foreground'}>{formatNotificationTime(notification.createdAt)}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        </div>

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
