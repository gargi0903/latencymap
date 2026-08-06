import { afterEach, describe, expect, it, vi } from "vitest";
import { getProbeRegions } from "./probe-regions";
import { formatProbeFetchError, getProbeSecret, ProbeConfigurationError, runRegionalTest } from "./probes";
import type { ProbeConfig } from "./types";

const originalNodeEnv = process.env.NODE_ENV;
const originalProbeSecret = process.env.PROBE_SECRET;
const originalWorkersSubdomain = process.env.PROBE_WORKERS_SUBDOMAIN;
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

  if (originalWorkersSubdomain === undefined) {
    delete process.env.PROBE_WORKERS_SUBDOMAIN;
  } else {
    process.env.PROBE_WORKERS_SUBDOMAIN = originalWorkersSubdomain;
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
      "Probe unreachable at http://127.0.0.1:8787/probe. Check regional probe deployment and PROBE_WORKERS_SUBDOMAIN.",
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
  it("returns production regions with endpoints when workers subdomain is configured", () => {
    process.env.PROBE_WORKERS_SUBDOMAIN = "example.workers.dev";

    const regions = getProbeRegions();

    expect(regions).toHaveLength(5);
    expect(regions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "iad",
          label: "US East (Ashburn)",
          endpoint: "https://latencymap-probe-iad.example.workers.dev/probe",
        }),
        expect.objectContaining({
          id: "gru",
          label: "South America (Sao Paulo)",
          endpoint: "https://latencymap-probe-gru.example.workers.dev/probe",
        }),
      ]),
    );
  });

  it("returns a single local region in development without workers subdomain", () => {
    delete process.env.PROBE_WORKERS_SUBDOMAIN;
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

describe("runRegionalTest production mode", () => {
  it("fans out to all regional probes in parallel", async () => {
    process.env.PROBE_SECRET = "configured-secret";
    process.env.PROBE_WORKERS_SUBDOMAIN = "example.workers.dev";

    const fetchMock = vi.fn(async (endpoint: string) =>
      new Response(
        JSON.stringify({
          region: endpoint.includes("iad") ? "iad" : "sin",
          placement_region: endpoint.includes("iad") ? "aws:us-east-1" : "aws:ap-southeast-1",
          cloudflare_colo: endpoint.includes("iad") ? "IAD" : "SIN",
          total_ms: endpoint.includes("iad") ? 88 : 120,
          status_code: 200,
          error: null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await runRegionalTest("https://example.com");

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://latencymap-probe-iad.example.workers.dev/probe",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-probe-secret": "configured-secret",
        }),
      }),
    );
    expect(results).toHaveLength(5);
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          region: "iad",
          totalMs: 88,
          ttfbMs: 88,
          statusCode: 200,
          cloudflareColo: "IAD",
          placementRegion: "aws:us-east-1",
        }),
      ]),
    );
  });
});

describe("runRegionalTest local probe calls", () => {
  it("calls the local probe directly in development", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.PROBE_WORKERS_SUBDOMAIN;
    process.env.PROBE_SECRET = "configured-secret";
    process.env.LOCAL_PROBE_ENDPOINT = "http://127.0.0.1:8787/probe";

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          region: "local",
          total_ms: 42,
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
        ttfbMs: 42,
        statusCode: 200,
      }),
    ]);
  });
});

describe("runRegionalTest local mode failures", () => {
  it("requires workers subdomain in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.PROBE_WORKERS_SUBDOMAIN;
    process.env.PROBE_SECRET = "configured-secret";

    await expect(runRegionalTest("https://example.com")).rejects.toThrow(ProbeConfigurationError);
  });

  it("maps probe HTTP errors into failed probe results", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.PROBE_WORKERS_SUBDOMAIN;
    process.env.PROBE_SECRET = "configured-secret";
    process.env.LOCAL_PROBE_ENDPOINT = "http://127.0.0.1:8787/probe";

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "Unauthorized." }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await runRegionalTest("https://example.com");

    expect(results).toEqual([
      expect.objectContaining({
        region: "local",
        totalMs: null,
        statusCode: 401,
        error: "Unauthorized.",
      }),
    ]);
  });
});
