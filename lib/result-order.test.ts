import { describe, expect, it } from "vitest";
import { defaultSelectedRegion, sortResultsByRegionOrder } from "@/lib/result-order";
import type { ProbeResult } from "@/lib/types";

function result(region: string, totalMs: number | null): ProbeResult {
  return {
    region,
    label: region,
    lat: 0,
    lng: 0,
    totalMs,
    ttfbMs: totalMs,
    statusCode: totalMs === null ? null : 200,
    error: totalMs === null ? "failed" : null,
    testedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("sortResultsByRegionOrder", () => {
  it("keeps countries in stable probe-region order regardless of latency", () => {
    const ordered = sortResultsByRegionOrder([
      result("sin", 40),
      result("iad", 200),
      result("lhr", 90),
    ]);

    expect(ordered.map((entry) => entry.region)).toEqual(["iad", "lhr", "sin"]);
  });
});

describe("defaultSelectedRegion", () => {
  it("defaults to the first configured probe region", () => {
    expect(
      defaultSelectedRegion([
        result("sin", 40),
        result("iad", 200),
        result("lhr", 90),
      ]),
    ).toBe("iad");
  });
});
