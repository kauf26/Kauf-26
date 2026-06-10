export class OAuthCancelledError extends Error {
  readonly reason: 'cancel' | 'dismiss';

  constructor(reason: 'cancel' | 'dismiss' = 'cancel', message = 'Connection cancelled') {
    super(message);
    this.name = 'OAuthCancelledError';
    this.reason = reason;
  }
}

export class OAuthSessionError extends Error {
  readonly recoverable: boolean;

  constructor(message: string, recoverable = true) {
    super(message);
    this.name = 'OAuthSessionError';
    this.recoverable = recoverable;
  }
}

export function isOAuthCancelledError(err: unknown): err is OAuthCancelledError {
  return err instanceof OAuthCancelledError;
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    return /network|failed to fetch|offline|internet|timed out|timeout|ECONNREFUSED/i.test(
      err.message
    );
  }
  return false;
}

/** Maps fetch / OAuth failures to user-friendly QA-facing messages. */
export function normalizeOAuthError(err: unknown): Error {
  if (err instanceof OAuthCancelledError || err instanceof OAuthSessionError) {
    return err;
  }
  if (isNetworkError(err)) {
    return new OAuthSessionError('Network error, please try again.');
  }
  if (err instanceof Error) return err;
  return new OAuthSessionError('OAuth failed. Please try again.');
}
