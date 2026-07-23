import { afterEach, describe, expect, it, vi } from "vitest";
import { formatProbeFetchError, getProbeRegions, getProbeSecret, ProbeConfigurationError, runRegionalTest } from "./probes";
import type { ProbeConfig } from "./types";

const originalNodeEnv = process.env.NODE_ENV;
const originalProbeSecret = process.env.PROBE_SECRET;
const originalCoordinatorEndpoint = process.env.PROBE_COORDINATOR_ENDPOINT;
const originalLocalProbeEndpoint = process.env.LOCAL_PROBE_ENDPOINT;

const localProbe: ProbeConfig = {
  id: "local",
  label: "Local development",
  lat: 0,
  lng: 0,
  endpoint: "http://127.0.0.1:8787/probe",
};

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;

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

  if (originalLocalProbeEndpoint === undefined) {
    delete process.env.LOCAL_PROBE_ENDPOINT;
  } else {
    process.env.LOCAL_PROBE_ENDPOINT = originalLocalProbeEndpoint;
  }

  vi.unstubAllGlobals();
});

describe("formatProbeFetchError", () => {
  it("maps abort errors to a timeout message", () => {
    expect(formatProbeFetchError(Object.assign(new Error("aborted"), { name: "AbortError" }), localProbe)).toBe(
      "Probe timed out.",
    );
  });

  it("maps connection failures to an actionable message", () => {
    const error = Object.assign(new Error("fetch failed"), {
      cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    });

    expect(formatProbeFetchError(error, localProbe)).toBe(
      "Probe unreachable at http://127.0.0.1:8787/probe. Start the local probe with npm run probe:dev or use npm run dev:local.",
    );
  });

  it("uses deployment guidance for connection failures in production", () => {
    process.env.NODE_ENV = "production";

    const error = Object.assign(new Error("fetch failed"), {
      cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    });

    expect(formatProbeFetchError(error, localProbe)).toBe(
      "Probe unreachable at http://127.0.0.1:8787/probe. Check that the local probe is running or configure PROBE_COORDINATOR_ENDPOINT.",
    );
  });

  it("falls back to a generic probe failure message", () => {
    expect(formatProbeFetchError(new Error("boom"), localProbe)).toBe("Probe failed.");
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

describe("getProbeRegions", () => {
  it("returns the committed production regions when coordinator mode is enabled", () => {
    process.env.PROBE_COORDINATOR_ENDPOINT = "https://coordinator.example/probe";

    expect(getProbeRegions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "iad", label: "US East (Ashburn)" }),
        expect.objectContaining({ id: "gru", label: "South America (Sao Paulo)" }),
      ]),
    );
    expect(getProbeRegions()).toHaveLength(5);
  });

  it("returns a single local region in development without coordinator mode", () => {
    delete process.env.PROBE_COORDINATOR_ENDPOINT;
    process.env.NODE_ENV = "development";
    process.env.LOCAL_PROBE_ENDPOINT = "http://127.0.0.1:8787/probe";

    expect(getProbeRegions()).toEqual([
      {
        id: "local",
        label: "Local development",
        lat: 0,
        lng: 0,
        endpoint: "http://127.0.0.1:8787/probe",
      },
    ]);
  });
});

describe("runRegionalTest coordinator mode", () => {
  it("calls the coordinator once and maps regional results", async () => {
    process.env.PROBE_SECRET = "configured-secret";
    process.env.PROBE_COORDINATOR_ENDPOINT = "https://coordinator.example/probe";

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              region: "iad",
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
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          region: "iad",
          totalMs: 88,
          ttfbMs: 86,
          statusCode: 200,
          cloudflareColo: "IAD",
          placementRegion: "aws:us-east-1",
        }),
      ]),
    );
    expect(results).toHaveLength(5);
  });
});

describe("runRegionalTest local mode", () => {
  it("calls the local probe directly in development", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.PROBE_COORDINATOR_ENDPOINT;
    process.env.PROBE_SECRET = "configured-secret";
    process.env.LOCAL_PROBE_ENDPOINT = "http://127.0.0.1:8787/probe";

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          region: "local",
          total_ms: 42,
          ttfb_ms: 40,
          status_code: 200,
          error: null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await runRegionalTest("https://example.com");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      expect.objectContaining({
        region: "local",
        totalMs: 42,
        ttfbMs: 40,
        statusCode: 200,
      }),
    ]);
  });

  it("requires the coordinator in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.PROBE_COORDINATOR_ENDPOINT;
    process.env.PROBE_SECRET = "configured-secret";

    await expect(runRegionalTest("https://example.com")).rejects.toThrow(ProbeConfigurationError);
  });
});
