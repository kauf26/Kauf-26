/**
 * Kauf26 account sign-in (Google / Apple) — separate from marketplace OAuth.
 * Session cookie is used for server auth; profile metadata cached locally for UI.
 */
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';
import { clearDevSession } from './devAuth';
import { clearAllMarketplaceTokens } from './secureTokenStore';
import { MARKETPLACE_OAUTH_MANIFEST } from '../../../shared/marketplaceOAuthManifest';

WebBrowser.maybeCompleteAuthSession();

export const USER_ACCOUNT_KEY = 'kauf26_user_account';

export type UserAccount = {
  id: number;
  email?: string | null;
  provider?: 'google' | 'apple';
  signedInAt: string;
};

const fetchOpts = {
  credentials: 'include' as RequestCredentials,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
};

export async function loadCachedUserAccount(): Promise<UserAccount | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_ACCOUNT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserAccount;
  } catch {
    return null;
  }
}

async function cacheUserAccount(user: Omit<UserAccount, 'signedInAt'>): Promise<UserAccount> {
  const account: UserAccount = { ...user, signedInAt: new Date().toISOString() };
  await SecureStore.setItemAsync(USER_ACCOUNT_KEY, JSON.stringify(account));
  return account;
}

export async function fetchCurrentUserAccount(): Promise<UserAccount | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/user`, fetchOpts);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      id: number;
      email?: string | null;
      oauthProvider?: string;
    };
    return cacheUserAccount({
      id: data.id,
      email: data.email,
      provider: data.oauthProvider === 'apple' ? 'apple' : 'google',
    });
  } catch {
    return loadCachedUserAccount();
  }
}

export async function signInWithAppleNative(): Promise<UserAccount> {
  if (Platform.OS !== 'ios') {
    throw new Error('Native Sign in with Apple is available on iOS only');
  }

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error('Sign in with Apple is not available on this device');
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token');
  }

  const res = await fetch(`${API_BASE_URL}/api/auth/mobile/apple`, {
    method: 'POST',
    ...fetchOpts,
    body: JSON.stringify({
      identityToken: credential.identityToken,
      fullName: credential.fullName,
      email: credential.email,
    }),
  });

  const data = (await res.json()) as {
    ok?: boolean;
    user?: { id: number; email?: string | null; provider?: string };
    message?: string;
  };

  if (!res.ok) {
    throw new Error(data.message ?? 'Apple Sign In failed');
  }

  return cacheUserAccount({
    id: data.user?.id ?? 0,
    email: data.user?.email,
    provider: 'apple',
  });
}

export async function signInWithGoogleMobile(): Promise<UserAccount> {
  const authUrl = `${API_BASE_URL}/api/auth/google?platform=mobile`;
  const redirectUri = 'kauf26://auth/google';
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type !== 'success') {
    throw new Error('Google sign-in was cancelled');
  }

  const user = await fetchCurrentUserAccount();
  if (!user) {
    throw new Error('Signed in but could not load account — check your connection');
  }
  return { ...user, provider: 'google' };
}

/** Best-effort marketplace revocation; always clears local SecureStore tokens. */
export async function revokeAllMarketplaceConnections(): Promise<void> {
  const oauthIds = MARKETPLACE_OAUTH_MANIFEST.filter((m) => m.oauthSupported).map((m) => m.id);
  await clearAllMarketplaceTokens(oauthIds);

  for (const id of oauthIds) {
    try {
      await fetch(`${API_BASE_URL}/api/auth/${id}/revoke`, {
        method: 'POST',
        ...fetchOpts,
      });
    } catch {
      // Server may not hold tokens — local clear is what matters
    }
  }
}

export async function signOutAccount(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', ...fetchOpts });
  } catch {
    // Continue clearing local state
  }
  await clearDevSession();
  await SecureStore.deleteItemAsync(USER_ACCOUNT_KEY);
}

export async function deleteAccount(): Promise<void> {
  await revokeAllMarketplaceConnections();

  const res = await fetch(`${API_BASE_URL}/api/account`, {
    method: 'DELETE',
    ...fetchOpts,
  });

  if (res.status === 401) {
    await signOutAccount();
    return;
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message ?? 'Failed to delete account');
  }

  await signOutAccount();
}
