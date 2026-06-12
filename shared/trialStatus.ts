/** Global 14-day free trial — UTC calendar days from TRIAL_START_DATE. */

export const TRIAL_DURATION_DAYS = 14;

export type TrialStatus = {
  daysRemaining: number;
  isActive: boolean;
  expired: boolean;
  trialStartDate: string;
  trialEndDate: string;
};

export function utcDayStartMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function daysBetweenUtc(start: Date, end: Date): number {
  return Math.floor((utcDayStartMs(end) - utcDayStartMs(start)) / (24 * 60 * 60 * 1000));
}

/** Parse YYYY-MM-DD as UTC midnight. Falls back to today (UTC) if invalid. */
export function parseTrialStartDate(raw: string | undefined | null): Date {
  const value = String(raw ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
}

export function formatTrialEndDateUtc(start: Date): string {
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + TRIAL_DURATION_DAYS - 1);
  return end.toISOString().slice(0, 10);
}

export function getTrialStatus(
  trialStartDate: Date,
  now: Date = new Date()
): TrialStatus {
  const elapsedDays = daysBetweenUtc(trialStartDate, now);
  const daysRemaining = Math.max(0, TRIAL_DURATION_DAYS - elapsedDays);
  const isActive = daysRemaining > 0;
  return {
    daysRemaining,
    isActive,
    expired: !isActive,
    trialStartDate: trialStartDate.toISOString().slice(0, 10),
    trialEndDate: formatTrialEndDateUtc(trialStartDate),
  };
}

export function getTrialBannerText(
  status: Pick<TrialStatus, "daysRemaining" | "isActive">,
  options?: { uppercase?: boolean }
): string | null {
  if (!status.isActive) return null;
  const prefix = options?.uppercase !== false ? "14 DAY FREE TRIAL" : "14 day free trial";
  if (status.daysRemaining === 1) {
    return `${prefix} – Trial ends today`;
  }
  return `${prefix} – ${status.daysRemaining} days remaining`;
}
