import { describe, expect, it } from "vitest";
import { assessImageQuality, USER_QUALITY_ERROR } from "./imageQualityService";

describe("assessImageQuality", () => {
  it("rejects tiny image buffers", async () => {
    const tiny = Buffer.alloc(500);
    const report = await assessImageQuality(tiny);
    expect(report.ok).toBe(false);
    expect(report.error).toBe(USER_QUALITY_ERROR);
  });
});
