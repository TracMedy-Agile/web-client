export type ApiRequestErrorOptions = {
  status?: number;
  code?: string;
  isNetworkError?: boolean;
};

export class ApiRequestError extends Error {
  status?: number;
  code?: string;
  isNetworkError: boolean;

  constructor(message: string, options: ApiRequestErrorOptions = {}) {
    super(message);
    this.name = "ApiRequestError";
    this.status = options.status;
    this.code = options.code;
    this.isNetworkError = Boolean(options.isNetworkError);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function apiErrorFromResponse(response: Response, payload: unknown, fallback: string) {
  const record = asRecord(payload);
  const data = asRecord(record?.data);
  const message = stringValue(record?.message) || fallback;
  const code = stringValue(record?.errorCode) || stringValue(data?.code);

  return new ApiRequestError(message, {
    status: response.status,
    code,
  });
}

export function networkApiError(fallback = "We are unable to reach the servers.") {
  return new ApiRequestError(fallback, { isNetworkError: true });
}

export function isAccessDeniedError(error: unknown) {
  if (error instanceof ApiRequestError) return error.status === 403;
  return error instanceof Error && /\b(forbidden|access denied|permission)\b/i.test(error.message);
}

export function isNetworkError(error: unknown) {
  if (error instanceof ApiRequestError) return error.isNetworkError;
  if (!(error instanceof Error)) return false;
  return /\b(failed to fetch|network|load failed|connection|offline)\b/i.test(error.message);
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}