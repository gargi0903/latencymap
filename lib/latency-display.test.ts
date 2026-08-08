import { describe, expect, it } from "vitest";
import {
  formatProbeStatus,
  formatProbeTimestamp,
  isProbeFailed,
  latencyHexColor,
  latencyMeasurementNote,
} from "@/lib/latency-display";

describe("latencyMeasurementNote", () => {
  it("uses plain language for how latency is calculated", () => {
    expect(latencyMeasurementNote()).toBe(
      "each region: 3 checks, slowest ignored, rounded to 10 ms",
    );
  });
});

describe("isProbeFailed", () => {
  it("treats errors and null latency as failed", () => {
    expect(isProbeFailed({ error: "timeout", totalMs: null })).toBe(true);
    expect(isProbeFailed({ error: null, totalMs: null })).toBe(true);
    expect(isProbeFailed({ error: "timeout", totalMs: 100 })).toBe(true);
    expect(isProbeFailed({ error: null, totalMs: 100 })).toBe(false);
  });
});

describe("latencyHexColor", () => {
  it("maps latency to the product color contract", () => {
    expect(latencyHexColor(120, null)).toBe("#16833a");
    expect(latencyHexColor(200, null)).toBe("#b26a00");
    expect(latencyHexColor(350, null)).toBe("#c3362b");
    expect(latencyHexColor(null, "failed")).toBe("#737b8c");
  });
});

describe("formatProbeStatus", () => {
  it("prefers error text over status code", () => {
    expect(formatProbeStatus({ error: "Probe timed out.", statusCode: 500 })).toBe("Probe timed out.");
    expect(formatProbeStatus({ error: null, statusCode: 200 })).toBe("200");
    expect(formatProbeStatus({ error: null, statusCode: null })).toBe("n/a");
  });
});

describe("formatProbeTimestamp", () => {
  it("falls back to the raw value when parsing fails", () => {
    expect(formatProbeTimestamp("not-a-date")).toBe("not-a-date");
  });
});
