"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CalendarCheck, CheckCheck, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  formatNotificationTime,
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  notificationDestination,
  type NotificationRecord,
} from "@/lib/api/notifications";
import { cn } from "@/lib/utils";

const PAGE_LIMIT = 20;

function notificationIcon(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("alert")) return { Icon: AlertTriangle, className: "bg-red-50 text-red-500" };
  if (normalized.includes("appointment")) return { Icon: CalendarCheck, className: "bg-blue-50 text-primary" };
  if (normalized.includes("message")) return { Icon: MessageSquare, className: "bg-blue-50 text-primary" };
  return { Icon: Bell, className: "bg-blue-50 text-primary" };
}

function groupLabel(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Earlier";
  const date = new Date(parsed);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date);
}

function groupNotifications(items: NotificationRecord[]) {
  const groups = new Map<string, NotificationRecord[]>();
  for (const item of items) {
    const label = groupLabel(item.createdAt);
    const bucket = groups.get(label) ?? [];
    bucket.push(item);
    groups.set(label, bucket);
  }
  return [...groups.entries()];
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"All" | "Unread">("All");

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const page = await getNotifications(1, PAGE_LIMIT);
      setNotifications(page.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load notifications.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    capturePostHogEvent("notifications_viewed");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotifications();
  }, [loadNotifications]);

  const unreadCount = notifications.filter((item) => item.readAt === null).length;
  const visibleNotifications = tab === "Unread" ? notifications.filter((item) => item.readAt === null) : notifications;
  const grouped = useMemo(() => groupNotifications(visibleNotifications), [visibleNotifications]);

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsAsRead();
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
      capturePostHogEvent("notifications_marked_all_read");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Unable to mark notifications as read.");
    }
  }

  async function handleView(notification: NotificationRecord) {
    if (notification.readAt === null) {
      try {
        await markNotificationAsRead(notification.id);
        const readAt = new Date().toISOString();
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt } : item));
      } catch (requestError) {
        toast.error(requestError instanceof Error ? requestError.message : "Unable to mark notification as read.");
        return;
      }
    }
    const destination = notificationDestination(notification);
    if (destination) router.push(destination);
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {unreadCount} unread notification{unreadCount === 1 ? "" : "s"} to go through
          </p>
        </div>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </button>
        ) : null}
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="mt-6">
        <TabsList className="h-auto rounded-none border-b border-border bg-transparent p-0">
          {(["All", "Unread"] as const).map((item) => (
            <TabsTrigger
              key={item}
              value={item}
              className="rounded-none border-b-2 border-transparent px-4 pb-3 text-sm font-semibold text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {item}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-medium text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading notifications...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-destructive">{error}</p>
            <button type="button" onClick={() => void loadNotifications()} className="mt-3 text-xs font-bold text-primary hover:underline">
              Try again
            </button>
          </div>
        ) : visibleNotifications.length === 0 ? (
          <p className="py-16 text-center text-sm font-medium text-muted-foreground">
            {tab === "Unread" ? "No unread notifications." : "No notifications yet."}
          </p>
        ) : (
          grouped.map(([label, items]) => (
            <div key={label}>
              <p className="mb-3 text-sm font-bold text-foreground">{label}</p>
              <div className="space-y-3">
                {items.map((notification) => {
                  const { Icon, className } = notificationIcon(notification.type);
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        "flex flex-wrap items-center gap-4 rounded-xl border border-border px-5 py-4 sm:flex-nowrap",
                        notification.readAt === null ? "bg-primary/5" : "bg-card",
                      )}
                    >
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", className)}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">{notification.title}</span>
                          <span className="text-xs text-muted-foreground">{formatNotificationTime(notification.createdAt)}</span>
                        </span>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">{notification.body}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleView(notification)}
                        className="ml-auto h-10 shrink-0 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                      >
                        View
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
