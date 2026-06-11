import * as SecureStore from 'expo-secure-store';

const AUTO_TRANSLATE_KEY = 'kauf_auto_translate';

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
