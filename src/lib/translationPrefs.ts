const AUTO_TRANSLATE_KEY = "kauf_auto_translate";

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
