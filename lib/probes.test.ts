import { afterEach, describe, expect, it, vi } from "vitest";
import { formatProbeFetchError, getProbeConfig, getProbeSecret, ProbeConfigurationError, runRegionalTest } from "./probes";
import type { ProbeConfig } from "./types";

const originalProbeEndpoints = process.env.PROBE_ENDPOINTS;
const originalProbeSecret = process.env.PROBE_SECRET;
const originalCoordinatorEndpoint = process.env.PROBE_COORDINATOR_ENDPOINT;
const probe: ProbeConfig = {
  id: "local",
  label: "Local Probe",
  lat: 0,
  lng: 0,
  endpoint: "http://127.0.0.1:8787/probe",
};

afterEach(() => {
  if (originalProbeEndpoints === undefined) {
    delete process.env.PROBE_ENDPOINTS;
  } else {
    process.env.PROBE_ENDPOINTS = originalProbeEndpoints;
  }

  if (originalProbeSecret === undefined) {
    delete process.env.PROBE_SECRET;
  } else {
    process.env.PROBE_SECRET = originalProbeSecret;
  }

  if (originalCoordinatorEndpoint === undefined) {
    delete process.env.PROBE_COORDINATOR_ENDPOINT;
  } else {
    process.env.PROBE_COORDINATOR_ENDPOINT = originalCoordinatorEndpoint;
  }

  vi.unstubAllGlobals();
});

describe("formatProbeFetchError", () => {
  it("maps abort errors to a timeout message", () => {
    expect(formatProbeFetchError(Object.assign(new Error("aborted"), { name: "AbortError" }), probe)).toBe(
      "Probe timed out.",
    );
  });

  it("maps connection failures to an actionable message", () => {
    const error = Object.assign(new Error("fetch failed"), {
      cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    });

    expect(formatProbeFetchError(error, probe)).toBe(
      "Probe unreachable at http://127.0.0.1:8787/probe. Start the local probe with npm run probe:dev or use npm run dev:local.",
    );
  });

  it("uses deployment guidance for connection failures in production", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const error = Object.assign(new Error("fetch failed"), {
        cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
      });

      expect(formatProbeFetchError(error, probe)).toBe(
        "Probe unreachable at http://127.0.0.1:8787/probe. Check that the endpoint is deployed and PROBE_ENDPOINTS is correct.",
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("falls back to a generic probe failure message", () => {
    expect(formatProbeFetchError(new Error("boom"), probe)).toBe("Probe failed.");
  });
});

describe("getProbeSecret", () => {
  it("rejects an absent or whitespace-only credential", () => {
    delete process.env.PROBE_SECRET;
    expect(() => getProbeSecret()).toThrow(ProbeConfigurationError);

    process.env.PROBE_SECRET = "   ";
    expect(() => getProbeSecret()).toThrow(ProbeConfigurationError);
  });

  it("returns a trimmed credential", () => {
    process.env.PROBE_SECRET = "  configured-secret  ";

    expect(getProbeSecret()).toBe("configured-secret");
  });
});

describe("getProbeConfig", () => {
  it("reuses parsed probe config for repeated calls", () => {
    process.env.PROBE_ENDPOINTS = JSON.stringify([probe]);

    const first = getProbeConfig();
    const second = getProbeConfig();

    expect(second).toBe(first);
  });
});

describe("runRegionalTest coordinator mode", () => {
  it("calls the coordinator once and maps regional results", async () => {
    process.env.PROBE_ENDPOINTS = JSON.stringify([probe]);
    process.env.PROBE_SECRET = "configured-secret";
    process.env.PROBE_COORDINATOR_ENDPOINT = "https://coordinator.example/probe";

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              region: "local",
              placement_region: "aws:us-east-1",
              cloudflare_colo: "IAD",
              total_ms: 88,
              ttfb_ms: 86,
              status_code: 200,
              error: null,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await runRegionalTest("https://example.com");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://coordinator.example/probe",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-probe-secret": "configured-secret",
        }),
      }),
    );
    expect(results).toEqual([
      expect.objectContaining({
        region: "local",
        totalMs: 88,
        ttfbMs: 86,
        statusCode: 200,
        cloudflareColo: "IAD",
        placementRegion: "aws:us-east-1",
      }),
    ]);
  });
});
