import { apiClient } from "@/lib/services/auth/api-client";

export type CareAssistantSuggestion = {
  id: string;
  question: string;
  intent: string;
  reason: string;
};

export type CareAssistantEvidence = {
  key: string;
  label: string;
  value: string;
  timestamp: string | null;
  sourceType: string;
  sourceId: string;
  route: string;
};

export type CareAssistantSource = {
  type: string;
  label: string;
  count: number;
  route: string;
  latestAt: string | null;
};

export type CareAssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  retrievedSources: CareAssistantEvidence[];
  createdAt: string;
};

export type CareAssistantSuggestionsResponse = {
  careEpisodeId: string;
  suggestions: CareAssistantSuggestion[];
  derivedFrom: {
    checkInsLast24h: number;
    openAlerts: number;
    doseLogsLast7d: number;
    recoveryAvailable: boolean;
  };
  generatedAt: string;
};

export type CareAssistantChatResponse = {
  conversationId: string;
  messageId: string;
  careEpisodeId: string;
  question: string;
  answer: string;
  answerStatus: string;
  safetyLevel: string;
  requiresClinicianConfirmation: boolean;
  treatmentRequest: boolean;
  dataSufficiency: string;
  dataConfidence: number;
  evidence: CareAssistantEvidence[];
  sources: CareAssistantSource[];
  recovery: Record<string, unknown> | null;
  timeWindow: { label: string; from: string; to: string; anchorAt: string | null } | null;
  missingData: string[];
  suggestedQuestions: string[];
  suggestedActions: { type: string; label: string; route: string | null }[];
  disclaimers: string[];
  promptVersion: string;
  createdAt: string;
};

export type CareAssistantHistoryResponse = {
  careEpisodeId: string;
  conversationId: string | null;
  messages: CareAssistantMessage[];
  total: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function unwrapData(value: unknown): unknown {
  const record = asRecord(value);
  return record && "data" in record ? record.data : value;
}

function errorMessage(value: unknown): string {
  const record = asRecord(value);
  return typeof record?.message === "string" ? record.message : "Unable to load Care Episode Assistant.";
}

async function requestAssistant<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiClient(path, { ...init, cache: "no-store" });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(payload));
  return unwrapData(payload) as T;
}

export function getCareAssistantSuggestions(episodeId: string) {
  return requestAssistant<CareAssistantSuggestionsResponse>(`/care-episodes/${encodeURIComponent(episodeId)}/assistant/suggestions`);
}

export function getCareAssistantHistory(episodeId: string, conversationId?: string) {
  const query = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : "";
  return requestAssistant<CareAssistantHistoryResponse>(`/care-episodes/${encodeURIComponent(episodeId)}/assistant/history${query}`);
}

export function askCareAssistant(episodeId: string, message: string, conversationId?: string) {
  return requestAssistant<CareAssistantChatResponse>(`/care-episodes/${encodeURIComponent(episodeId)}/assistant/chat`, {
    method: "POST",
    body: JSON.stringify({ message, ...(conversationId ? { conversationId } : {}) }),
  });
}