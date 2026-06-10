export class OAuthCancelledError extends Error {
  readonly reason: 'cancel' | 'dismiss';

  constructor(reason: 'cancel' | 'dismiss' = 'cancel', message = 'Sign-in was cancelled.') {
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
