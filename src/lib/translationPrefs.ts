const AUTO_TRANSLATE_KEY = "kauf_auto_translate";
const TRANSLATE_INTERNATIONAL_KEY = "kauf_translate_international";

export function getAutoTranslateEnabled(): boolean {
  try {
    const value = localStorage.getItem(AUTO_TRANSLATE_KEY);
    if (value === null) return true;
    return value === "1";
  } catch {
    return true;
  }
}

export function setAutoTranslateEnabled(enabled: boolean): void {
  localStorage.setItem(AUTO_TRANSLATE_KEY, enabled ? "1" : "0");
}

export function getTranslateInternationalEnabled(): boolean {
  try {
    const value = localStorage.getItem(TRANSLATE_INTERNATIONAL_KEY);
    if (value === null) return true;
    return value === "1";
  } catch {
    return true;
  }
}

export function setTranslateInternationalEnabled(enabled: boolean): void {
  localStorage.setItem(TRANSLATE_INTERNATIONAL_KEY, enabled ? "1" : "0");
}
