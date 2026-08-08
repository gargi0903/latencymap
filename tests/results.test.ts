import { describe, expect, it } from "vitest";
import type { ProbeResult } from "@/lib/types";
import {
  defaultSelectedRegion,
  latencyHexColor,
  sortResultsByRegionOrder,
} from "@/lib/results";

describe("latencyHexColor", () => {
  it("maps latency to the product color contract", () => {
    expect(latencyHexColor(120, null)).toBe("#16833a");
    expect(latencyHexColor(200, null)).toBe("#b26a00");
    expect(latencyHexColor(350, null)).toBe("#c3362b");
    expect(latencyHexColor(null, "failed")).toBe("#737b8c");
  });
});

function result(region: string, totalMs: number | null): ProbeResult {
  return {
    region,
    label: region,
    totalMs,
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
