import { apiClient } from '@/lib/services/auth/api-client';

export type NotificationRecord = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsPage = {
  items: NotificationRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function unwrapData(value: unknown): unknown {
  const record = asRecord(value);
  return record && 'data' in record ? record.data : value;
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await apiClient(path, init);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = asRecord(payload);
    throw new Error(typeof error?.message === 'string' ? error.message : 'Unable to complete the notification request.');
  }
  return unwrapData(payload);
}

function toNotification(value: unknown): NotificationRecord | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== 'string') return null;
  return {
    id: record.id,
    type: typeof record.type === 'string' ? record.type : 'notification',
    title: typeof record.title === 'string' ? record.title : 'Notification',
    body: typeof record.body === 'string' ? record.body : '',
    data: asRecord(record.data) ?? {},
    readAt: typeof record.readAt === 'string' ? record.readAt : null,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
  };
}

export async function getNotifications(page = 1, limit = 10): Promise<NotificationsPage> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  const payload = asRecord(await request(`/notifications?${query}`)) ?? {};
  const items = Array.isArray(payload.items)
    ? payload.items.map(toNotification).filter((item): item is NotificationRecord => item !== null)
    : [];
  return {
    items,
    total: typeof payload.total === 'number' ? payload.total : items.length,
    page: typeof payload.page === 'number' ? payload.page : page,
    limit: typeof payload.limit === 'number' ? payload.limit : limit,
    totalPages: typeof payload.totalPages === 'number' ? payload.totalPages : 1,
  };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const payload = asRecord(await request('/notifications/unread-count'));
  return typeof payload?.count === 'number' ? payload.count : 0;
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await request('/notifications/read-all', { method: 'PATCH' });
}

export function notificationDestination(notification: NotificationRecord): string {
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

export function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
