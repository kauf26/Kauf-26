/**
 * Device-level biometric authentication (Face ID / Touch ID / fingerprint).
 * Works alongside the 4-digit PIN — PIN is always available as fallback.
 */
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export const USER_PIN_KEY = 'userPin';
export const BIOMETRIC_ENABLED_KEY = 'biometricEnabled';
export const BIOMETRIC_PIN_KEY = 'userPinBiometric';

export type BiometricCapability = {
  available: boolean;
  enrolled: boolean;
  label: string;
};

function resolveBiometricLabel(
  types: LocalAuthentication.AuthenticationType[]
): string {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === 'ios' ? 'Face ID' : 'Face unlock';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris unlock';
  }
  return 'Biometrics';
}

/** Checks hardware support and whether the user has enrolled biometrics. */
export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { available: false, enrolled: false, label: 'Biometrics' };
    }
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return {
      available: true,
      enrolled,
      label: resolveBiometricLabel(types),
    };
  } catch {
    return { available: false, enrolled: false, label: 'Biometrics' };
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function getStoredPin(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(USER_PIN_KEY);
  } catch {
    return null;
  }
}

export async function storePin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(USER_PIN_KEY, pin);
}

/**
 * After the user verifies with biometrics, store the PIN in SecureStore
 * with requireAuthentication so reads are gated by Face ID / fingerprint.
 */
export async function enableBiometricAuth(
  pin: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cap = await getBiometricCapability();
  if (!cap.available) {
    return { ok: false, error: `${cap.label} is not available on this device.` };
  }
  if (!cap.enrolled) {
    return {
      ok: false,
      error: `No ${cap.label} enrolled. Add biometrics in device Settings first.`,
    };
  }

  const auth = await LocalAuthentication.authenticateAsync({
    promptMessage: `Enable ${cap.label}`,
    cancelLabel: 'Cancel',
    disableDeviceFallback: true,
  });

  if (!auth.success) {
    if (auth.error === 'user_cancel') {
      return { ok: false, error: 'Cancelled' };
    }
    return { ok: false, error: `${cap.label} verification failed.` };
  }

  try {
    await SecureStore.setItemAsync(BIOMETRIC_PIN_KEY, pin, {
      requireAuthentication: true,
      authenticationPrompt: `Unlock with ${cap.label}`,
    });
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not save biometric credentials.' };
  }
}

export async function disableBiometricAuth(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_PIN_KEY);
  } catch {
    // Item may not exist
  }
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'false');
}

/**
 * Unlock by reading the biometric-gated PIN from SecureStore.
 * The OS shows the Face ID / fingerprint prompt automatically.
 */
export async function authenticateWithBiometric(): Promise<
  { ok: true } | { ok: false; cancelled?: boolean; error?: string }
> {
  const enabled = await isBiometricEnabled();
  if (!enabled) {
    return { ok: false, error: 'Biometrics not enabled' };
  }

  const cap = await getBiometricCapability();
  if (!cap.available || !cap.enrolled) {
    return { ok: false, error: `${cap.label} is unavailable.` };
  }

  try {
    const pin = await SecureStore.getItemAsync(BIOMETRIC_PIN_KEY, {
      requireAuthentication: true,
      authenticationPrompt: `Unlock with ${cap.label}`,
    });
    if (pin) {
      return { ok: true };
    }
    return { ok: false, error: 'Could not verify identity.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Authentication failed';
    const cancelled =
      /cancel|user/i.test(message) || message.includes('User canceled');
    return { ok: false, cancelled, error: message };
  }
}

/** Manual biometric prompt (e.g. "Use Face ID" button on PIN screen). */
export async function promptBiometricUnlock(): Promise<
  { ok: true } | { ok: false; cancelled?: boolean; error?: string }
> {
  const cap = await getBiometricCapability();
  if (!cap.available || !cap.enrolled) {
    return { ok: false, error: `${cap.label} is unavailable.` };
  }

  const auth = await LocalAuthentication.authenticateAsync({
    promptMessage: `Unlock with ${cap.label}`,
    cancelLabel: 'Use PIN',
    fallbackLabel: 'Use PIN',
  });

  if (auth.success) {
    return { ok: true };
  }
  if (auth.error === 'user_cancel') {
    return { ok: false, cancelled: true, error: 'Cancelled' };
  }
  return { ok: false, error: `${cap.label} verification failed.` };
}
