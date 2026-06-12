import { API_BASE_URL } from './config';

const JSON_CONTENT_TYPES = /^(application\/(json|.*\+json)|text\/json)/i;

export class ApiResponseError extends Error {
  readonly status: number;
  readonly isHtmlResponse: boolean;
  readonly isNetworkError: boolean;

  constructor(
    message: string,
    options: { status?: number; isHtmlResponse?: boolean; isNetworkError?: boolean } = {}
  ) {
    super(message);
    this.name = 'ApiResponseError';
    this.status = options.status ?? 0;
    this.isHtmlResponse = options.isHtmlResponse ?? false;
    this.isNetworkError = options.isNetworkError ?? false;
  }
}

function looksLikeHtml(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith('<!') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML');
}

function apiReachabilityHint(): string {
  return `Check that the API server is running and EXPO_PUBLIC_API_URL is set correctly (currently ${API_BASE_URL}). On a physical device use your Mac's LAN IP, e.g. http://192.168.x.x:2626 — not localhost.`;
}

export async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export async function parseJsonResponse<T>(
  response: Response,
  bodyText?: string
): Promise<T> {
  const text = bodyText ?? (await readResponseBody(response));
  const contentType = response.headers.get('content-type') ?? '';
  const isJson =
    JSON_CONTENT_TYPES.test(contentType) ||
    (text.length > 0 && !looksLikeHtml(text));

  if (!isJson) {
    if (looksLikeHtml(text)) {
      throw new ApiResponseError(
        `Server returned a web page instead of JSON. ${apiReachabilityHint()}`,
        { status: response.status, isHtmlResponse: true }
      );
    }
    if (!text.trim()) {
      throw new ApiResponseError(
        `Empty response from server (${response.status}). ${apiReachabilityHint()}`,
        { status: response.status }
      );
    }
    throw new ApiResponseError(
      `Unexpected response format (${response.status}). ${apiReachabilityHint()}`,
      { status: response.status }
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiResponseError(
      `Invalid JSON from server (${response.status}). ${apiReachabilityHint()}`,
      { status: response.status }
    );
  }
}

export async function fetchJson<T>(
  url: string,
  options?: RequestInit,
  retryOptions?: { retries?: number; retryDelayMs?: number }
): Promise<{ data: T; response: Response }> {
  const retries = retryOptions?.retries ?? 0;
  const retryDelayMs = retryOptions?.retryDelayMs ?? 800;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      const data = await parseJsonResponse<T>(response);
      return { data, response };
    } catch (error) {
      lastError = error;
      const isRetryableNetwork =
        error instanceof TypeError ||
        (error instanceof ApiResponseError && error.isNetworkError);

      if (attempt < retries && isRetryableNetwork) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

export function userFacingApiError(error: unknown, fallback: string): string {
  if (error instanceof ApiResponseError) {
    return error.message;
  }
  if (error instanceof TypeError) {
    return `Could not reach the server. ${apiReachabilityHint()}`;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
