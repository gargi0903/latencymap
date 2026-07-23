import { describe, expect, it } from "vitest";
import { latencyMeasurementNote } from "@/lib/latency-display";

describe("latencyMeasurementNote", () => {
  it("documents the repeat-test margin of error", () => {
    expect(latencyMeasurementNote()).toBe(
      "median ttfb from 3 warmed requests · margin of error ±50% on repeat tests",
    );
  });
});
