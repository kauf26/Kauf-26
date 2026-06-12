import { API_BASE_URL } from './config';

export class ApiResponseError extends Error {
  readonly status: number;
  readonly isHtmlResponse: boolean;
  readonly isNetworkError: boolean;
  readonly bodyPreview: string;
  readonly url?: string;

  constructor(
    message: string,
    options: {
      status?: number;
      isHtmlResponse?: boolean;
      isNetworkError?: boolean;
      bodyPreview?: string;
      url?: string;
    } = {}
  ) {
    super(message);
    this.name = 'ApiResponseError';
    this.status = options.status ?? 0;
    this.isHtmlResponse = options.isHtmlResponse ?? false;
    this.isNetworkError = options.isNetworkError ?? false;
    this.bodyPreview = options.bodyPreview ?? '';
    this.url = options.url;
  }
}

function looksLikeHtml(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith('<!') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML');
}

function isApplicationJson(contentType: string): boolean {
  return /application\/json/i.test(contentType);
}

function bodyPreview(text: string, max = 200): string {
  return text.slice(0, max).replace(/\s+/g, ' ').trim();
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

function logNonJsonResponse(
  status: number,
  contentType: string,
  preview: string
): void {
  // @ts-ignore - __DEV__ is defined by React Native
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(
      `[API] Non-JSON response (status ${status}, Content-Type: ${contentType || 'none'}):`,
      preview
    );
  }
}

export async function parseJsonResponse<T>(
  response: Response,
  bodyText?: string
): Promise<T> {
  const text = bodyText ?? (await readResponseBody(response));
  const contentType = response.headers.get('content-type') ?? '';
  const status = response.status;
  const preview = bodyPreview(text);

  if (!isApplicationJson(contentType)) {
    logNonJsonResponse(status, contentType, preview);

    if (looksLikeHtml(text) || /text\/html/i.test(contentType)) {
      throw new ApiResponseError(`Server returned HTML (status ${status}). Expected JSON.`, {
        status,
        isHtmlResponse: true,
        bodyPreview: preview,
      });
    }

    throw new ApiResponseError(
      `Server returned non-JSON content (status ${status}, Content-Type: ${contentType || 'none'}). Expected JSON.`,
      { status, bodyPreview: preview }
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    logNonJsonResponse(status, contentType, preview);
    throw new ApiResponseError(`Invalid JSON from server (status ${status}). Expected JSON.`, {
      status,
      bodyPreview: preview,
    });
  }
}

function enrichFetchError(error: ApiResponseError, url: string): ApiResponseError {
  const previewSuffix = error.bodyPreview ? ` Response preview: "${error.bodyPreview}"` : '';
  return new ApiResponseError(
    `${error.message} Request: ${url}. Status: ${error.status}.${previewSuffix} ${apiReachabilityHint()}`,
    {
      status: error.status,
      isHtmlResponse: error.isHtmlResponse,
      isNetworkError: error.isNetworkError,
      bodyPreview: error.bodyPreview,
      url,
    }
  );
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
      const bodyText = await readResponseBody(response);
      let data: T;
      try {
        data = await parseJsonResponse<T>(response, bodyText);
      } catch (parseError) {
        if (parseError instanceof ApiResponseError) {
          throw enrichFetchError(parseError, url);
        }
        throw parseError;
      }
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

      if (error instanceof ApiResponseError) {
        throw error;
      }

      if (error instanceof TypeError) {
        throw new ApiResponseError(`Could not reach the server. Request: ${url}. ${apiReachabilityHint()}`, {
          isNetworkError: true,
          url,
        });
      }

      throw error;
    }
  }

  throw lastError;
}

export function userFacingApiError(error: unknown, fallback: string): string {
  if (error instanceof ApiResponseError) {
    if (error.isHtmlResponse || error.isNetworkError) {
      return fallback;
    }
    return error.message || fallback;
  }
  if (error instanceof TypeError) {
    return fallback;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
