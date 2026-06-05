/** Remove competitor / external URLs from listing payloads before persistence */

const URL_FIELD_KEYS = [
  "productUrl",
  "url",
  "link",
  "externalUrl",
] as const;

export function stripExternalUrlFields<T extends Record<string, unknown>>(
  obj: T
): T {
  const out = { ...obj };
  for (const key of URL_FIELD_KEYS) {
    delete out[key];
  }
  return out;
}
