export type MessageStatus = "sent" | "acknowledged" | "action_completed";
export type MessageContextType = "alert" | "biometric" | "symptom";

export type MessageThread = {
  episodeId: string;
  patientId: string;
  patientName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  totalMessages: number;
};

export type MessageRecord = {
  id: string;
  episodeId: string | null;
  appointmentId: string | null;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string;
  content: string;
  templateUsed: string | null;
  status: MessageStatus;
  contextType: MessageContextType | null;
  contextId: string | null;
  sentAt: string;
  acknowledgedAt: string | null;
};

export type MessageTemplate = {
  id: string;
  title: string;
  content: string;
};

type MessageContent = {
  content: string;
  templateUsed?: string;
  contextType?: MessageContextType;
  contextId?: string;
};

export type SendMessagePayload = MessageContent & (
  | { episodeId: string; appointmentId?: never }
  | { appointmentId: string; episodeId?: never }
);

const BASE = process.env.NEXT_PUBLIC_API_URL;

async function getAccessToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/auth/get-token");
    const payload = (await response.json()) as { accessToken?: unknown };
    return typeof payload.accessToken === "string" ? payload.accessToken : null;
  } catch {
    return null;
  }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = asRecord(payload);
    throw new Error(typeof error?.message === "string" ? error.message : "Unable to complete the messaging request.");
  }

  return unwrapData(payload);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function unwrapData(value: unknown): unknown {
  const record = asRecord(value);
  return record && "data" in record ? record.data : value;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toThread(value: unknown): MessageThread | null {
  const record = asRecord(value);
  if (!record || typeof record.episodeId !== "string") return null;
  return {
    episodeId: record.episodeId,
    patientId: asString(record.patientId),
    patientName: asString(record.patientName, "Patient"),
    lastMessage: asString(record.lastMessage),
    lastMessageAt: asString(record.lastMessageAt),
    unreadCount: asNumber(record.unreadCount),
    totalMessages: asNumber(record.totalMessages),
  };
}

function toMessage(value: unknown): MessageRecord | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string") return null;
  const episodeId = asString(record.episodeId);
  const appointmentId = asString(record.appointmentId);
  if (!episodeId && !appointmentId) return null;
  const status = asString(record.status, "sent") as MessageStatus;
  const contextType = asString(record.contextType) as MessageContextType;
  return {
    id: record.id,
    episodeId: episodeId || null,
    appointmentId: appointmentId || null,
    senderId: asString(record.senderId),
    senderName: asString(record.senderName, "Clinician"),
    senderRole: asString(record.senderRole),
    recipientId: asString(record.recipientId),
    content: asString(record.content),
    templateUsed: typeof record.templateUsed === "string" ? record.templateUsed : null,
    status,
    contextType: contextType || null,
    contextId: typeof record.contextId === "string" ? record.contextId : null,
    sentAt: asString(record.sentAt),
    acknowledgedAt: typeof record.acknowledgedAt === "string" ? record.acknowledgedAt : null,
  };
}

function toTemplate(value: unknown): MessageTemplate | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string" || typeof record.content !== "string") return null;
  return {
    id: record.id,
    title: asString(record.title, record.id.replaceAll("_", " ")),
    content: record.content,
  };
}

function parseList<T>(value: unknown, parser: (item: unknown) => T | null): T[] {
  return Array.isArray(value) ? value.map(parser).filter((item): item is T => item !== null) : [];
}

export async function getMessageThreads(): Promise<MessageThread[]> {
  return parseList(await request("/messages/threads"), toThread);
}

export async function getMessages(episodeId: string): Promise<MessageRecord[]> {
  const query = new URLSearchParams({ episode_id: episodeId });
  return parseList(await request(`/messages?${query}`), toMessage);
}

export async function getMessageTemplates(): Promise<MessageTemplate[]> {
  return parseList(await request("/messages/templates"), toTemplate);
}

export async function sendMessage(payload: SendMessagePayload): Promise<MessageRecord> {
  const message = toMessage(await request("/messages", {
    method: "POST",
    body: JSON.stringify(payload),
  }));
  if (!message) throw new Error("The messaging service returned an invalid response.");
  return message;
}
