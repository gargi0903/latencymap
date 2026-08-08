import { describe, expect, it } from "vitest";
import { buildProbeResult, mapProbeWireResponse } from "./probe-response";
import type { ProbeConfig } from "./types";

const probe: ProbeConfig = {
  id: "iad",
  label: "US East (Ashburn)",
  endpoint: "https://latencymap-probe-iad.example.workers.dev/probe",
};

describe("mapProbeWireResponse", () => {
  it("maps snake_case probe responses", () => {
    const result = mapProbeWireResponse(probe, "2026-07-26T00:00:00.000Z", {
      total_ms: 184,
      status_code: 200,
      cloudflare_colo: "IAD",
      placement_region: "aws:us-east-1",
      error: null,
    });

    expect(result).toEqual(
      buildProbeResult(probe, "2026-07-26T00:00:00.000Z", {
        totalMs: 184,
        statusCode: 200,
        cloudflareColo: "IAD",
        placementRegion: "aws:us-east-1",
        error: null,
      }),
    );
  });

  it("ignores camelCase aliases", () => {
    const result = mapProbeWireResponse(probe, "2026-07-26T00:00:00.000Z", {
      totalMs: 95,
      statusCode: 204,
      cloudflareColo: "LHR",
      placementRegion: "aws:eu-west-2",
    });

    expect(result.totalMs).toBeNull();
    expect(result.statusCode).toBeNull();
    expect(result.cloudflareColo).toBeNull();
    expect(result.placementRegion).toBeNull();
  });
});
