import { describe, expect, it } from "vitest";

import { driftScore, rebalancePlan } from "./allocation";

describe("allocation engine", () => {
  it("suggests buys and sells to hit target weights", () => {
    const { total, lines } = rebalancePlan(
      [
        { assetClass: "us-equity", value: 80_000 },
        { assetClass: "intl-equity", value: 10_000 },
        { assetClass: "bond", value: 5_000 },
        { assetClass: "cash", value: 5_000 },
      ],
      {
        "us-equity": 0.55,
        "intl-equity": 0.2,
        bond: 0.15,
        cash: 0.1,
        crypto: 0,
        reit: 0,
        other: 0,
      },
    );
    expect(total).toBe(100_000);
    const us = lines.find((l) => l.assetClass === "us-equity")!;
    expect(us.dollars).toBeCloseTo(-25_000);
    const intl = lines.find((l) => l.assetClass === "intl-equity")!;
    expect(intl.dollars).toBeCloseTo(10_000);
    expect(driftScore(lines)).toBeGreaterThan(0.2);
  });
});
