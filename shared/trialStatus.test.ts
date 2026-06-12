import { describe, expect, it } from "vitest";
import {
  getTrialBannerText,
  getTrialStatus,
  parseTrialStartDate,
} from "./trialStatus";

describe("trialStatus", () => {
  const start = parseTrialStartDate("2026-06-12");

  it("returns 14 days remaining on start date (UTC)", () => {
    const status = getTrialStatus(start, new Date("2026-06-12T23:59:59Z"));
    expect(status.daysRemaining).toBe(14);
    expect(status.isActive).toBe(true);
    expect(status.expired).toBe(false);
  });

  it("counts down by UTC calendar day", () => {
    const status = getTrialStatus(start, new Date("2026-06-13T00:00:00Z"));
    expect(status.daysRemaining).toBe(13);
  });

  it("expires after 14 elapsed UTC days", () => {
    const status = getTrialStatus(start, new Date("2026-06-26T00:00:00Z"));
    expect(status.daysRemaining).toBe(0);
    expect(status.isActive).toBe(false);
    expect(status.expired).toBe(true);
  });

  it("shows last-day banner copy when one day remains", () => {
    const status = getTrialStatus(start, new Date("2026-06-25T12:00:00Z"));
    expect(status.daysRemaining).toBe(1);
    expect(getTrialBannerText(status)).toBe("14 DAY FREE TRIAL – Trial ends today");
  });

  it("shows countdown banner text", () => {
    const status = getTrialStatus(start, new Date("2026-06-12T12:00:00Z"));
    expect(getTrialBannerText(status)).toBe("14 DAY FREE TRIAL – 14 days remaining");
  });
});
