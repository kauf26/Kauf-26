/**
 * Gate publish actions behind biometric or PIN verification.
 */
import * as SecureStore from 'expo-secure-store';
import {
  authenticateWithBiometric,
  getBiometricCapability,
  getStoredPin,
  isBiometricEnabled,
  promptBiometricUnlock,
} from './biometric';

export const REQUIRES_AUTH_FOR_PUBLISH_KEY = 'requiresAuthForPublish';

export async function isRequiresAuthForPublish(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(REQUIRES_AUTH_FOR_PUBLISH_KEY);
    return value !== 'false';
  } catch {
    return true;
  }
}

export async function setRequiresAuthForPublish(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(
    REQUIRES_AUTH_FOR_PUBLISH_KEY,
    enabled ? 'true' : 'false'
  );
}

export type PublishAuthResult =
  | { ok: true; method: 'disabled' | 'biometric' | 'pin' }
  | { ok: false; cancelled?: boolean; error?: string };

/** Verify stored PIN matches user entry. */
export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await getStoredPin();
  return Boolean(stored && stored === pin);
}

/**
 * Authenticate before publish: biometric first (if enabled), then PIN fallback.
 * Returns ok:false with cancelled when user dismisses without verifying.
 */
export async function authenticateForPublish(
  pinFallback?: string
): Promise<PublishAuthResult> {
  if (!(await isRequiresAuthForPublish())) {
    return { ok: true, method: 'disabled' };
  }

  const bioEnabled = await isBiometricEnabled();
  if (bioEnabled) {
    const bio = await authenticateWithBiometric();
    if (bio.ok) return { ok: true, method: 'biometric' };
    if (bio.cancelled) {
      // User cancelled biometric — allow PIN fallback below
    }
  } else {
    const cap = await getBiometricCapability();
    if (cap.available && cap.enrolled) {
      const prompt = await promptBiometricUnlock();
      if (prompt.ok) return { ok: true, method: 'biometric' };
      if (prompt.cancelled && !pinFallback) {
        return { ok: false, cancelled: true, error: 'Authentication cancelled' };
      }
    }
  }

  if (pinFallback) {
    const valid = await verifyPin(pinFallback);
    if (valid) return { ok: true, method: 'pin' };
    return { ok: false, error: 'Incorrect PIN' };
  }

  return { ok: false, cancelled: true, error: 'PIN required' };
}
