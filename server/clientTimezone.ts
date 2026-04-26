import type { Request } from "express";

/**
 * Resolves the browser's IANA timezone from standard request headers.
 * Used so daily limits reset at 00:00:00 in the user's local calendar, not the server's.
 */
export function getClientIanaTimeZone(req: Request): string {
  const raw =
    req.get("x-client-timezone") ??
    req.get("x-time-zone") ??
    (typeof req.query.tz === "string" ? req.query.tz : undefined);
  if (!raw || typeof raw !== "string") return "UTC";
  const tz = raw.trim();
  if (tz.length === 0 || tz.length > 120) return "UTC";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}
