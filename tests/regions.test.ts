import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildProbeResult,
  formatProbeFetchError,
  getProbeRegions,
  getProbeSecret,
  mapProbeWireResponse,
  ProbeConfigurationError,
  runRegionalTest,
} from "@/lib/regions";
import type { ProbeConfig } from "@/lib/types";

const originalNodeEnv = process.env.NODE_ENV;
const originalProbeSecret = process.env.PROBE_SECRET;
const originalWorkersSubdomain = process.env.PROBE_WORKERS_SUBDOMAIN;

const sampleProbe: ProbeConfig = {
  id: "iad",
  label: "US East (Ashburn)",
  endpoint: "https://latencymap-probe-iad.example.workers.dev/probe",
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

  vi.unstubAllGlobals();
});

describe("formatProbeFetchError", () => {
  it.each([
    [
      "timeout",
      Object.assign(new Error("aborted"), { name: "AbortError" }),
      "Probe timed out.",
    ],
    [
      "connection refused",
      Object.assign(new Error("fetch failed"), {
        cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
      }),
      "Probe unreachable at https://latencymap-probe-iad.example.workers.dev/probe. Check regional Worker deployment and PROBE_WORKERS_SUBDOMAIN.",
    ],
    ["generic", new Error("boom"), "Probe failed."],
  ])("maps %s errors", (_label, error, message) => {
    expect(formatProbeFetchError(error, sampleProbe)).toBe(message);
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
  it("returns regional Workers with endpoints when the subdomain is configured", () => {
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

  it("returns empty endpoints when the subdomain is missing", () => {
    delete process.env.PROBE_WORKERS_SUBDOMAIN;

    expect(getProbeRegions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "iad",
          endpoint: "",
        }),
      ]),
    );
  });
});

describe("runRegionalTest", () => {
  it("fans out to all regional Workers in parallel", async () => {
    process.env.PROBE_SECRET = "configured-secret";
    process.env.PROBE_WORKERS_SUBDOMAIN = "example.workers.dev";

    const fetchMock = vi.fn(
      async (endpoint: string) =>
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
          statusCode: 200,
          cloudflareColo: "IAD",
          placementRegion: "aws:us-east-1",
        }),
      ]),
    );
  });

  it("requires workers subdomain", async () => {
    delete process.env.PROBE_WORKERS_SUBDOMAIN;
    process.env.PROBE_SECRET = "configured-secret";

    await expect(runRegionalTest("https://example.com")).rejects.toThrow(ProbeConfigurationError);
  });

  it("maps Worker HTTP errors into failed results", async () => {
    process.env.PROBE_SECRET = "configured-secret";
    process.env.PROBE_WORKERS_SUBDOMAIN = "example.workers.dev";

    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "Unauthorized." }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await runRegionalTest("https://example.com");

    expect(results).toHaveLength(5);
    expect(results[0]).toEqual(
      expect.objectContaining({
        totalMs: null,
        statusCode: 401,
        error: "Unauthorized.",
      }),
    );
  });
});

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