import { apiClient } from "@/lib/services/auth/api-client";

const BASE = process.env.NEXT_PUBLIC_API_URL;

export type SupportFaq = {
  id: string;
  question: string;
  answer: string;
};

export type SupportTicketInput = {
  subject: string;
  message: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function unwrapData(value: unknown): unknown {
  const record = asRecord(value);
  return record && "data" in record ? record.data : value;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function faqSource(payload: unknown): unknown[] {
  const data = unwrapData(payload);
  if (Array.isArray(data)) return data;

  const record = asRecord(data);
  if (!record) return [];

  const keys = ["items", "faqs", "results"];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

function normalizeFaq(value: unknown, index: number): SupportFaq | null {
  const record = asRecord(value);
  if (!record) return null;

  const question = stringValue(record.question, stringValue(record.q, stringValue(record.title)));
  const answer = stringValue(record.answer, stringValue(record.a, stringValue(record.body, stringValue(record.description))));
  if (!question || !answer) return null;

  return {
    id: stringValue(record.id, `faq-${index}`),
    question,
    answer,
  };
}

function errorMessage(payload: unknown, fallback: string) {
  const record = asRecord(payload);
  return stringValue(record?.message, fallback);
}

export async function getSupportFaq(): Promise<SupportFaq[]> {
  if (!BASE) throw new Error("API base URL is not configured.");

  const response = await fetch(`${BASE}/support/faq`, {
    headers: { Accept: "application/json" },
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(errorMessage(payload, "Unable to load support FAQs."));
  }

  return faqSource(payload)
    .map(normalizeFaq)
    .filter((item): item is SupportFaq => item !== null);
}

export async function submitSupportTicket(input: SupportTicketInput): Promise<void> {
  const response = await apiClient.post("/support/tickets", {
    subject: input.subject.trim(),
    message: input.message.trim(),
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(errorMessage(payload, response.status === 401 ? "Please sign in to submit a support ticket." : "Unable to submit support ticket."));
  }
}