import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';

export const DEV_SESSION_KEY = 'kauf26_dev_session';

export type DevSession = {
  userId: number;
  email?: string | null;
  loggedInAt: string;
};

export async function fetchDevLoginEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/dev-login/enabled`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { enabled?: boolean };
    return data.enabled === true;
  } catch {
    return false;
  }
}

export async function devLoginWithPin(pin: string): Promise<DevSession> {
  const res = await fetch(`${API_BASE_URL}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ pin }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    user?: { id: number; email?: string | null };
    message?: string;
  };
  if (!res.ok) {
    throw new Error(data.message ?? 'Dev login failed');
  }
  const session: DevSession = {
    userId: data.user?.id ?? 0,
    email: data.user?.email,
    loggedInAt: new Date().toISOString(),
  };
  await SecureStore.setItemAsync(DEV_SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function loadDevSession(): Promise<DevSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(DEV_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DevSession;
  } catch {
    return null;
  }
}

export async function clearDevSession(): Promise<void> {
  await SecureStore.deleteItemAsync(DEV_SESSION_KEY);
}
