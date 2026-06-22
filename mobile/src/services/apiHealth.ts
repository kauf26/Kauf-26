import { API_BASE_URL } from './config';
import { ApiResponseError, readResponseBody } from './httpResponse';

export type ApiHealthResult = {
  ok: boolean;
  url: string;
  status: number;
  latencyMs: number;
  message: string;
};

/**
 * Quick reachability check before expensive identify uploads.
 * Uses GET /api/health (not /health — that may serve the Vite SPA).
 */
export async function checkApiHealth(timeoutMs = 8000): Promise<ApiHealthResult> {
  const url = `${API_BASE_URL}/api/health`;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const bodyText = await readResponseBody(response);
    const latencyMs = Date.now() - started;

    if (!response.ok) {
      return {
        ok: false,
        url,
        status: response.status,
        latencyMs,
        message: `API health check failed (HTTP ${response.status}).`,
      };
    }

    try {
      const body = JSON.parse(bodyText) as { status?: string };
      if (body.status === 'ok') {
        return {
          ok: true,
          url,
          status: response.status,
          latencyMs,
          message: `API reachable (${latencyMs}ms).`,
        };
      }
    } catch {
      // fall through
    }

    if (bodyText.trimStart().startsWith('<')) {
      return {
        ok: false,
        url,
        status: response.status,
        latencyMs,
        message:
          'Server returned HTML instead of JSON — wrong host/port or API not running (use npm run server).',
      };
    }

    return {
      ok: false,
      url,
      status: response.status,
      latencyMs,
      message: 'Unexpected health response from API.',
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      ok: false,
      url,
      status: 0,
      latencyMs,
      message: aborted
        ? `API timed out after ${timeoutMs}ms at ${url}. Same Wi‑Fi? Server running?`
        : `Cannot reach API at ${url}. Same Wi‑Fi? Run: npm run server`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function formatApiHealthError(result: ApiHealthResult): string {
  return `${result.message} Base URL: ${API_BASE_URL}`;
}

export async function assertApiReachable(): Promise<void> {
  const health = await checkApiHealth();
  if (!health.ok) {
    throw new ApiResponseError(formatApiHealthError(health), {
      isNetworkError: true,
      url: health.url,
      status: health.status,
    });
  }
}
