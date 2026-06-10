/**
 * Keeps OAuth redirect handling reliable when the app backgrounds, resumes, or cold-starts
 * from a marketplace callback (kauf26://oauth/...).
 */
import { AppState, type AppStateStatus } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { isOAuthCallbackUrl } from '../../../shared/oauthRedirect';

let unsubscribe: (() => void) | null = null;

function completePendingAuthSession(url?: string | null): void {
  if (url && !isOAuthCallbackUrl(url)) return;
  WebBrowser.maybeCompleteAuthSession();
}

/**
 * Call once at app startup. Wires Linking + AppState so ASWebAuthenticationSession /
 * Chrome Custom Tabs callbacks finish even if the app was backgrounded or relaunched.
 */
export function wireOAuthSessionLifecycle(): () => void {
  if (unsubscribe) return unsubscribe;

  completePendingAuthSession();

  const urlListener = Linking.addEventListener('url', ({ url }) => {
    completePendingAuthSession(url);
  });

  const appStateListener = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      completePendingAuthSession();
    }
  });

  void Linking.getInitialURL().then((url) => completePendingAuthSession(url));

  unsubscribe = () => {
    urlListener.remove();
    appStateListener.remove();
    unsubscribe = null;
  };

  return unsubscribe;
}
