import type { components } from "@/docs/types/api";
import { apiClient } from "@/lib/services/auth/api-client";

export type ChatRequest = components["schemas"]["ChatRequestDto"];
export type ChatResponse = components["schemas"]["ChatResponseDto"];
export type EpisodeInsightResponse = components["schemas"]["EpisodeInsightResponseDto"];
export type EpisodeInsightPayload = components["schemas"]["EpisodeInsightPayloadDto"];
export type RecoverySummaryResponse = components["schemas"]["RecoverySummaryResponseDto"];
export type SuggestionListItem = components["schemas"]["SuggestionListItemDto"];
export type SuggestionListResponse = components["schemas"]["SuggestionListResponseDto"];
export type AlertInsightResponse = components["schemas"]["AlertInsightResponseDto"];
export type AlertInsightPayload = components["schemas"]["AlertInsightPayloadDto"];
export type BiometricsInsightResponse = components["schemas"]["BiometricsInsightResponseDto"];
export type BiometricsInsightPayload = components["schemas"]["BiometricsInsightPayloadDto"];
export type EpisodeReportResponse = components["schemas"]["EpisodeReportResponseDto"];
export type SuggestionDecisionInput = components["schemas"]["SuggestionDecisionDto"];
export type SuggestionDecisionResponse = components["schemas"]["SuggestionDecisionResponseDto"];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function unwrapData(value: unknown): unknown {
  const record = asRecord(value);
  return record && "data" in record ? record.data : value;
}

function errorMessage(value: unknown, fallback: string) {
  const record = asRecord(value);
  return typeof record?.message === "string" && record.message.trim() ? record.message : fallback;
}

async function requestAi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiClient(path, {
    ...init,
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(payload, "Unable to load AI insight."));
  return unwrapData(payload) as T;
}

export async function chatWithAi(input: ChatRequest): Promise<ChatResponse> {
  return requestAi<ChatResponse>("/ai/chat", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function generateEpisodeInsight(episodeId: string): Promise<EpisodeInsightResponse> {
  return requestAi<EpisodeInsightResponse>(`/ai/insights/episode/${encodeURIComponent(episodeId)}`, { method: "POST" });
}

export async function getLatestRecoverySummary(episodeId: string): Promise<RecoverySummaryResponse> {
  return requestAi<RecoverySummaryResponse>(`/ai/episodes/${encodeURIComponent(episodeId)}/recovery-summary`);
}

export type AiSummarySource = components["schemas"]["AiSummarySourceDto"]["source"];

const AI_SUMMARY_SOURCE_LABELS: Record<AiSummarySource, string> = {
  vitals: "Vitals",
  check_ins: "Check-ins",
  medications: "Medications",
  notes: "Clinical Notes",
  media: "Clinical Media",
  labs: "Lab Results",
  recovery_scores: "Recovery Scores",
  alerts: "Alerts",
};

// Labels for the data sources the backend says actually informed the summary.
// Empty when the summary predates source tracking — callers must not substitute local data.
export function getRecoverySummarySourceLabels(response: Pick<RecoverySummaryResponse, "sources"> | null | undefined): string[] {
  const labels = (response?.sources ?? [])
    .map((item) => AI_SUMMARY_SOURCE_LABELS[item.source])
    .filter((label): label is string => Boolean(label));
  return Array.from(new Set(labels));
}

export async function getEpisodeSuggestions(episodeId: string): Promise<SuggestionListResponse> {
  return requestAi<SuggestionListResponse>(`/ai/episodes/${encodeURIComponent(episodeId)}/suggestions`);
}

export async function generateAlertInsight(alertId: string): Promise<AlertInsightResponse> {
  return requestAi<AlertInsightResponse>(`/ai/insights/alert/${encodeURIComponent(alertId)}`, { method: "POST" });
}

export async function generateBiometricsInsight(episodeId: string, days = 7): Promise<BiometricsInsightResponse> {
  const query = new URLSearchParams({ days: String(days) });
  return requestAi<BiometricsInsightResponse>(`/ai/insights/biometrics/${encodeURIComponent(episodeId)}?${query.toString()}`, { method: "POST" });
}

export async function generateEpisodeReport(episodeId: string): Promise<EpisodeReportResponse> {
  return requestAi<EpisodeReportResponse>(`/ai/reports/episode/${encodeURIComponent(episodeId)}`, { method: "POST" });
}

export async function decideAiSuggestion(suggestionId: string, input: SuggestionDecisionInput): Promise<SuggestionDecisionResponse> {
  return requestAi<SuggestionDecisionResponse>(`/ai/suggestions/${encodeURIComponent(suggestionId)}/decision`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}