import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';

export const REVIEW_SESSION_KEY = 'kauf26_review_session';

export type ReviewSession = {
  userId: number;
  email?: string | null;
  loggedInAt: string;
};

export async function fetchReviewLoginEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/review-login/enabled`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { enabled?: boolean };
    return data.enabled === true;
  } catch {
    return false;
  }
}

export async function reviewLogin(
  email: string,
  password: string
): Promise<ReviewSession> {
  const res = await fetch(`${API_BASE_URL}/api/auth/review-login`, {
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
    throw new Error(data.message ?? 'Review login failed');
  }
  const session: ReviewSession = {
    userId: data.user?.id ?? 0,
    email: data.user?.email,
    loggedInAt: new Date().toISOString(),
  };
  await SecureStore.setItemAsync(REVIEW_SESSION_KEY, JSON.stringify(session));
  return session;
}
