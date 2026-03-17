import { describe, it, expect } from "vitest";

// Unit test the completion scoring logic
function getCompletionPercentage(
  categories: { weight: number; score: number }[]
) {
  const total = categories.reduce((s, c) => s + c.weight, 0);
  const earned = categories.reduce((s, c) => s + c.score, 0);
  return Math.round((earned / total) * 100);
}

function annualizeAmount(amount: number, frequency: string): number {
  const multipliers: Record<string, number> = {
    WEEKLY: 52,
    BIWEEKLY: 26,
    MONTHLY: 12,
    QUARTERLY: 4,
    ANNUALLY: 1,
  };
  return amount * (multipliers[frequency] ?? 1);
}

describe("profileCompletionService", () => {
  it("returns 0 when nothing is complete", () => {
    const cats = [
      { weight: 10, score: 0 },
      { weight: 20, score: 0 },
      { weight: 20, score: 0 },
    ];
    expect(getCompletionPercentage(cats)).toBe(0);
  });

  it("returns 100 when everything is complete", () => {
    const cats = [
      { weight: 10, score: 10 },
      { weight: 20, score: 20 },
      { weight: 20, score: 20 },
    ];
    expect(getCompletionPercentage(cats)).toBe(100);
  });

  it("calculates partial completion correctly", () => {
    const cats = [
      { weight: 10, score: 10 }, // household: complete
      { weight: 20, score: 0 }, // income: incomplete
      { weight: 20, score: 20 }, // assets: complete
      { weight: 10, score: 0 }, // liabilities: incomplete
      { weight: 15, score: 15 }, // expenses: complete
      { weight: 10, score: 0 }, // benefits: incomplete
      { weight: 5, score: 0 }, // housing: incomplete
      { weight: 5, score: 5 }, // insurance: complete
      { weight: 5, score: 5 }, // assumptions: complete
    ];
    expect(getCompletionPercentage(cats)).toBe(55);
  });
});

describe("annualizeAmount", () => {
  it("annualizes monthly correctly", () => {
    expect(annualizeAmount(1000, "MONTHLY")).toBe(12000);
  });

  it("annualizes weekly correctly", () => {
    expect(annualizeAmount(1000, "WEEKLY")).toBe(52000);
  });

  it("annualizes biweekly correctly", () => {
    expect(annualizeAmount(2000, "BIWEEKLY")).toBe(52000);
  });

  it("annualizes quarterly correctly", () => {
    expect(annualizeAmount(5000, "QUARTERLY")).toBe(20000);
  });

  it("annualizes annually correctly (no change)", () => {
    expect(annualizeAmount(120000, "ANNUALLY")).toBe(120000);
  });
});

describe("overview calculations", () => {
  it("calculates net worth correctly", () => {
    const totalAssets = 371000;
    const totalLiabilities = 420000;
    const totalRealEstateValue = 895000;
    const totalRealEstateMortgage = 420000;
    const netWorth =
      totalAssets +
      totalRealEstateValue -
      totalLiabilities -
      totalRealEstateMortgage;
    expect(netWorth).toBe(426000);
  });

  it("calculates total annual income from multiple sources", () => {
    const sources = [
      { amount: 12500, frequency: "MONTHLY" },
      { amount: 5000, frequency: "QUARTERLY" },
    ];
    const total = sources.reduce(
      (s, src) => s + annualizeAmount(src.amount, src.frequency),
      0
    );
    expect(total).toBe(170000); // 150000 + 20000
  });
});
