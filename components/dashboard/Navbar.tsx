"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";
import { useDashboardUser } from "@/components/auth/DashboardUserProvider";
import MobileSidebarButton from "@/components/dashboard/MobileSidebarButton";
import { Bell, ChevronDown, LogOut, User } from "lucide-react";

import {
  formatNotificationTime,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  notificationDestination,
  type NotificationRecord,
} from '@/lib/api/notifications';
import { CheckCheck, Loader2 } from 'lucide-react';

function formatRoleLabel(value?: string | null) {
  if (!value) return "Staff member";
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function UserAvatar({ name, avatarUrl, className }: { name: string; avatarUrl?: string; className: string }) {
  return (
    <div
      role="img"
      aria-label={name}
      className={`flex items-center justify-center rounded-full bg-primary bg-cover bg-center font-semibold text-primary-foreground ${className}`}
      style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
    >
      {avatarUrl ? null : getInitials(name)}
    </div>
  );
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

const NOTIFICATION_PREVIEW_LIMIT = 4;
const NOTIFICATIONS_CHANGED_EVENT = "tracmedy:notifications-changed";

const DASHBOARD_ROUTE_TITLES = [
  { href: "/dashboard/profile", title: "Profile" },
  { href: "/dashboard/notifications", title: "Notifications" },
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
  const { user } = useDashboardUser();
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
    let active = true;
    getUnreadNotificationCount()
      .then((count) => {
        if (!active) return;
        setUnreadCount(count);
        if (count === 0) setNotifications([]);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const loadNotifications = useCallback(async () => {
    setIsLoadingNotifications(true);
    setNotificationsError('');
    try {
      const [page, count] = await Promise.all([
        getNotifications(1, 20),
        getUnreadNotificationCount(),
      ]);
      setUnreadCount(count);
      const unreadItems = page.items.filter((item) => item.readAt === null).slice(0, NOTIFICATION_PREVIEW_LIMIT);
      setNotifications(count > 0 ? unreadItems : []);
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : 'Unable to load notifications.');
    } finally {
      setIsLoadingNotifications(false);
    }
  }, []);
  useEffect(() => {
    function handleNotificationsChanged(event: Event) {
      const detail = event instanceof CustomEvent ? event.detail as { unreadCount?: unknown } : null;
      if (typeof detail?.unreadCount === 'number') {
        setUnreadCount(detail.unreadCount);
        if (detail.unreadCount === 0) setNotifications([]);
      }
      if (isNotificationsOpen) void loadNotifications();
    }

    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged);
  }, [isNotificationsOpen, loadNotifications]);

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

  const name = user?.name || "Staff member";
  const role = user?.specialty || formatRoleLabel(user?.role);
  const avatarUrl = user?.avatarUrl || undefined;
  const resolvedTitle = title === "Dashboard" ? getDashboardRouteTitle(pathname) : title;

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
        const nextUnreadCount = Math.max(0, unreadCount - 1);
        setNotifications((current) => current.filter((item) => item.id !== notification.id));
        setUnreadCount(nextUnreadCount);
        window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, { detail: { unreadCount: nextUnreadCount } }));
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
      setNotifications([]);
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, { detail: { unreadCount: 0 } }));
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
              ) : unreadCount === 0 ? (
                <div className={'px-4 py-10 text-center'}>
                  <p className={'text-sm font-bold text-foreground'}>All notifications have been read</p>
                  <Link href="/dashboard/notifications" onClick={() => setIsNotificationsOpen(false)} className={'mt-3 inline-flex items-center text-sm font-bold text-primary hover:underline'}>View all notifications &rarr;</Link>
                </div>
              ) : notifications.length === 0 ? (
                <p className={'px-4 py-10 text-center text-sm text-muted-foreground'}>No unread notifications found.</p>
              ) : notifications.map((notification) => (
                <button
                  key={notification.id}
                  type={'button'}
                  onClick={() => void handleNotificationClick(notification)}
                  className="block w-full border-b border-primary/20 bg-primary px-4 py-3 text-left text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <span className={'flex items-start gap-3'}>
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-white" />
                    <span className={'min-w-0 flex-1'}>
                      <span className={'block text-sm font-semibold text-white'}>{notification.title}</span>
                      <span className={'mt-1 line-clamp-2 block text-xs leading-5 text-white/85'}>{notification.body}</span>
                      <span className={'mt-1.5 block text-[11px] text-white/70'}>{formatNotificationTime(notification.createdAt)}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <Link
              href="/dashboard/notifications"
              onClick={() => setIsNotificationsOpen(false)}
              className={'block border-t border-border px-4 py-3 text-center text-sm font-bold text-primary hover:bg-muted/60 hover:underline'}
            >
              View all notifications &rarr;
            </Link>
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
            <UserAvatar name={name} avatarUrl={avatarUrl} className="h-9 w-9 shrink-0 text-sm" />
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
                <UserAvatar name={name} avatarUrl={avatarUrl} className="h-10 w-10 shrink-0 text-sm" />
                <div>
                  <p className="font-semibold text-foreground">{name}</p>
                  <p className="text-sm text-muted-foreground">{role}</p>
                </div>
              </div>

              <div className="my-3 border-t border-border p-1" />

              <Link
                href="/dashboard/profile"
                role="menuitem"
                onClick={() => setIsMenuOpen(false)}
                className="flex w-full items-center gap-2 rounded-md p-1 text-sm font-medium text-foreground hover:bg-muted"
              >
                <User className="h-4 w-4" />
                My Profile
              </Link>

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

