import { afterEach, describe, expect, it } from "vitest";
import { formatProbeFetchError, getProbeConfig, getProbeSecret, ProbeConfigurationError } from "./probes";
import type { ProbeConfig } from "./types";

const originalProbeEndpoints = process.env.PROBE_ENDPOINTS;
const originalProbeSecret = process.env.PROBE_SECRET;
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
