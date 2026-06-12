import * as SecureStore from 'expo-secure-store';
import type { MarketplaceUserProfile, OAuthPlatform } from '../types/marketplaceConnect';

const PROFILE_KEY = 'onboarding_profile';
/** @deprecated Colon was invalid for SecureStore — migrated on read */
const LEGACY_PROFILE_KEY = 'onboarding:profile';

export type OnboardingProfile = {
  name: string;
  email: string;
  /** Marketplace ids that last contributed auto-fill data */
  sources: OAuthPlatform[];
  updatedAt: number;
};

export async function loadOnboardingProfile(): Promise<OnboardingProfile | null> {
  let raw = await SecureStore.getItemAsync(PROFILE_KEY);
  if (!raw) {
    try {
      raw = await SecureStore.getItemAsync(LEGACY_PROFILE_KEY);
      if (raw) {
        await SecureStore.setItemAsync(PROFILE_KEY, raw);
        try {
          await SecureStore.deleteItemAsync(LEGACY_PROFILE_KEY);
        } catch {
          // Best-effort cleanup of legacy key
        }
      }
    } catch {
      // Legacy key format was invalid on this platform
    }
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OnboardingProfile;
  } catch {
    return null;
  }
}

export async function saveOnboardingProfile(profile: OnboardingProfile): Promise<void> {
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profile));
}

/** Merge marketplace OAuth profile into onboarding fields (device-only). */
export async function mergeProfileFromMarketplace(
  userInfo: MarketplaceUserProfile
): Promise<OnboardingProfile> {
  const existing = (await loadOnboardingProfile()) ?? {
    name: '',
    email: '',
    sources: [],
    updatedAt: 0,
  };

  const sources = new Set(existing.sources);
  sources.add(userInfo.marketplace);

  const merged: OnboardingProfile = {
    name: userInfo.name?.trim() || existing.name,
    email: userInfo.email?.trim() || existing.email,
    sources: [...sources],
    updatedAt: Date.now(),
  };

  await saveOnboardingProfile(merged);
  return merged;
}

/** Push merged profile to backend when a server session exists. */
export async function syncOnboardingProfileToBackend(
  profile: OnboardingProfile
): Promise<void> {
  const { syncUserProfileToBackend } = await import('./userProfile');
  await syncUserProfileToBackend({ name: profile.name, email: profile.email });
}
