import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';

export const DEMO_SESSION_KEY = 'kauf26_demo_session';

export type DemoSession = {
  userId: number;
  email?: string | null;
  loggedInAt: string;
};

export async function fetchDemoLoginEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/demo-login/enabled`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { enabled?: boolean };
    return data.enabled === true;
  } catch {
    return false;
  }
}

export async function demoLogin(
  email: string,
  password: string
): Promise<DemoSession> {
  const res = await fetch(`${API_BASE_URL}/api/auth/demo-login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    user?: { id: number; email?: string | null };
    message?: string;
  };
  if (!res.ok) {
    throw new Error(data.message ?? 'Demo login failed');
  }
  const session: DemoSession = {
    userId: data.user?.id ?? 0,
    email: data.user?.email,
    loggedInAt: new Date().toISOString(),
  };
  await SecureStore.setItemAsync(DEMO_SESSION_KEY, JSON.stringify(session));
  return session;
}
