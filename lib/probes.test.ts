import { afterEach, describe, expect, it, vi } from "vitest";
import { formatProbeFetchError } from "./probe-client-errors";
import { getProbeRegions } from "./probe-regions";
import { getProbeSecret, ProbeConfigurationError, runRegionalTest } from "./probes";
import type { ProbeConfig } from "./types";

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
  it("maps abort errors to a timeout message", () => {
    expect(formatProbeFetchError(Object.assign(new Error("aborted"), { name: "AbortError" }), sampleProbe)).toBe(
      "Probe timed out.",
    );
  });

  it("maps connection failures to deployment guidance", () => {
    const error = Object.assign(new Error("fetch failed"), {
      cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    });

    expect(formatProbeFetchError(error, sampleProbe)).toBe(
      "Probe unreachable at https://latencymap-probe-iad.example.workers.dev/probe. Check regional Worker deployment and PROBE_WORKERS_SUBDOMAIN.",
    );
  });

  it("falls back to a generic probe failure message", () => {
    expect(formatProbeFetchError(new Error("boom"), sampleProbe)).toBe("Probe failed.");
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
