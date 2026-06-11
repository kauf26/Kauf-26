import * as SecureStore from 'expo-secure-store';

const AUTO_TRANSLATE_KEY = 'kauf_auto_translate';
const TRANSLATE_INTERNATIONAL_KEY = 'kauf_translate_international';

export async function getAutoTranslateEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(AUTO_TRANSLATE_KEY);
    if (value === null) return true;
    return value === '1';
  } catch {
    return true;
  }
}

export async function setAutoTranslateEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(AUTO_TRANSLATE_KEY, enabled ? '1' : '0');
}

export async function getTranslateInternationalEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(TRANSLATE_INTERNATIONAL_KEY);
    if (value === null) return true;
    return value === '1';
  } catch {
    return true;
  }
}

export async function setTranslateInternationalEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(TRANSLATE_INTERNATIONAL_KEY, enabled ? '1' : '0');
}
