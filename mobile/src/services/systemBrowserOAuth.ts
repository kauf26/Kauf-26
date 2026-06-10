/**
 * System-browser OAuth initiator (never an embedded WebView).
 *
 * iOS: expo-auth-session → ASWebAuthenticationSession (Safari / iCloud Keychain cookies).
 * Android: expo-web-browser → Chrome Custom Tabs (saved passwords & active sessions).
 *
 * preferEphemeralSession: false reuses existing browser sessions for one-tap connect.
 * App resume / cold-start callbacks are handled by oauthSessionLifecycle.ts.
 */
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { AuthSessionOpenOptions } from 'expo-web-browser';
import { OAuthCancelledError, OAuthSessionError } from './oauthErrors';

export type SystemBrowserOAuthResult = AuthSession.AuthSessionResult;

function interpretOAuthResult(result: SystemBrowserOAuthResult): { code: string } {
  if (result.type === 'success') {
    if (result.params.code) {
      return { code: result.params.code };
    }
    const oauthError =
      result.params.error_description ??
      result.params.error ??
      'Authorization completed without a code.';
    throw new OAuthSessionError(String(oauthError));
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new OAuthCancelledError(result.type);
  }

  if (result.type === 'locked') {
    throw new OAuthSessionError(
      'Another sign-in is already in progress. Wait a moment and try again.'
    );
  }

  if (result.type === 'error') {
    throw new OAuthSessionError(result.error?.message ?? 'OAuth failed');
  }

  throw new OAuthSessionError('OAuth failed');
}

export async function openSystemBrowserOAuth(
  request: AuthSession.AuthRequest,
  discovery: AuthSession.DiscoveryDocument
): Promise<{ code: string; elapsedMs: number }> {
  const started = Date.now();

  if (Platform.OS === 'android') {
    try {
      await WebBrowser.warmUpAsync();
    } catch {
      // Non-fatal — Custom Tabs may still open.
    }
  }

  const browserOptions: AuthSessionOpenOptions = {
    preferEphemeralSession: false,
    showInRecents: false,
    createTask: true,
  };

  try {
    const result = await request.promptAsync(
      discovery,
      browserOptions as AuthSession.AuthRequestPromptOptions
    );
    return { ...interpretOAuthResult(result), elapsedMs: Date.now() - started };
  } finally {
    if (Platform.OS === 'android') {
      try {
        await WebBrowser.coolDownAsync();
      } catch {
        // ignore
      }
    }
  }
}
