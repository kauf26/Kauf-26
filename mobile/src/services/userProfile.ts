import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';
import {
  loadOnboardingProfile,
  saveOnboardingProfile,
  type OnboardingProfile,
} from './onboardingProfile';

export const MARKETPLACE_ONBOARDING_COMPLETED_KEY = 'marketplaceOnboardingCompleted';

const AUTH_FETCH_INIT: RequestInit = {
  credentials: 'include',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
};

export type UserProfile = {
  id?: number;
  name: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  onboardingCompleted?: boolean;
};

export async function isMarketplaceOnboardingCompleted(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(MARKETPLACE_ONBOARDING_COMPLETED_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setMarketplaceOnboardingCompleted(completed: boolean): Promise<void> {
  await SecureStore.setItemAsync(
    MARKETPLACE_ONBOARDING_COMPLETED_KEY,
    completed ? 'true' : 'false'
  );
}

export async function loadLocalUserProfile(): Promise<UserProfile> {
  const saved = await loadOnboardingProfile();
  if (saved) {
    return { name: saved.name, email: saved.email };
  }
  return { name: '', email: '' };
}

export async function saveLocalUserProfile(profile: UserProfile): Promise<OnboardingProfile> {
  const existing = await loadOnboardingProfile();
  const next: OnboardingProfile = {
    name: profile.name.trim(),
    email: profile.email.trim(),
    sources: existing?.sources ?? [],
    updatedAt: Date.now(),
  };
  await saveOnboardingProfile(next);
  return next;
}

export async function fetchBackendUserProfile(): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
      ...AUTH_FETCH_INIT,
      method: 'GET',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as UserProfile & { name?: string };
    return {
      id: data.id,
      name: data.name ?? '',
      email: data.email ?? '',
      firstName: data.firstName,
      lastName: data.lastName,
      onboardingCompleted: data.onboardingCompleted,
    };
  } catch {
    return null;
  }
}

export async function syncUserProfileToBackend(profile: UserProfile): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
      ...AUTH_FETCH_INIT,
      method: 'POST',
      body: JSON.stringify({
        name: profile.name.trim(),
        email: profile.email.trim(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Merge local + remote profile; local edits win when non-empty. */
export async function hydrateUserProfile(): Promise<UserProfile> {
  const [local, remote] = await Promise.all([
    loadLocalUserProfile(),
    fetchBackendUserProfile(),
  ]);

  const merged: UserProfile = {
    id: remote?.id,
    name: local.name || remote?.name || '',
    email: local.email || remote?.email || '',
    firstName: remote?.firstName,
    lastName: remote?.lastName,
    onboardingCompleted: remote?.onboardingCompleted,
  };

  if (merged.name || merged.email) {
    await saveLocalUserProfile(merged);
  }

  return merged;
}
