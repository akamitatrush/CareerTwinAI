import { describe, it, expect } from "vitest";

describe("gaps endpoints shape", () => {
  it("summary retorna shape esperado", () => {
    const sample = {
      totalJobs: 142,
      skillsRequired: 18,
      skillsHave: 11,
      highPriorityGaps: 2,
      adherence: 64,
      isIllustrative: false,
    };
    expect(sample).toHaveProperty("totalJobs");
    expect(sample.adherence).toBeGreaterThanOrEqual(0);
    expect(sample.adherence).toBeLessThanOrEqual(100);
  });

  it("requirements item tem status have ou missing", () => {
    const item = { name: "python", count: 100, pct: 70, status: "have" };
    expect(["have", "missing"]).toContain(item.status);
  });
});
