import { describe, expect, it } from "vitest";
import { latencyMeasurementNote } from "@/lib/latency-display";

describe("latencyMeasurementNote", () => {
  it("uses plain language for how latency is calculated", () => {
    expect(latencyMeasurementNote()).toBe(
      "each region: 3 checks, slowest ignored, rounded to 10 ms",
    );
  });
});
