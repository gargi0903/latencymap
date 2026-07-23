import { describe, expect, it } from "vitest";
import coordinator from "../probes/cloudflare/src/coordinator";

function coordinatorRequest(url: string, secret?: string) {
  return new Request("https://coordinator.example/probe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-probe-secret": secret } : {}),
    },
    body: JSON.stringify({ url }),
  });
}

function createEnv() {
  const regionalResponse = (region: string, colo: string) =>
    new Response(
        JSON.stringify({
          region,
          placement_region: `aws:${region}`,
          cloudflare_colo: colo,
          execution_colo: colo,
          total_ms: 120,
          status_code: 200,
          error: null,
        }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const fetcher = (region: string, colo: string): Fetcher => ({
    fetch: async () => regionalResponse(region, colo),
  });

  return {
    PROBE_SECRET: "configured-secret",
    PROBE_IAD: fetcher("iad", "IAD"),
    PROBE_LHR: fetcher("lhr", "LHR"),
    PROBE_SIN: fetcher("sin", "SIN"),
    PROBE_SYD: fetcher("syd", "SYD"),
    PROBE_GRU: fetcher("gru", "GRU"),
  };
}

describe("Cloudflare coordinator boundary", () => {
  it("fails closed when the probe secret is missing", async () => {
    const env = createEnv();
    delete (env as { PROBE_SECRET?: string }).PROBE_SECRET;

    const response = await coordinator.fetch(coordinatorRequest("https://example.com"), env);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Probe is not configured." });
  });

  it("rejects a missing or wrong credential", async () => {
    const env = createEnv();

    await expect(coordinator.fetch(coordinatorRequest("https://example.com"), env)).resolves.toMatchObject({
      status: 401,
    });
    await expect(coordinator.fetch(coordinatorRequest("https://example.com", "wrong-secret"), env)).resolves.toMatchObject(
      {
        status: 401,
      },
    );
  });

  it("fans out to regional workers and returns aggregated results", async () => {
    const response = await coordinator.fetch(coordinatorRequest("https://example.com", "configured-secret"), createEnv());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      results: [
        {
          region: "iad",
          placement_region: "aws:iad",
          cloudflare_colo: "IAD",
          execution_colo: "IAD",
          total_ms: 120,
          status_code: 200,
          error: null,
        },
        {
          region: "lhr",
          placement_region: "aws:lhr",
          cloudflare_colo: "LHR",
          execution_colo: "LHR",
          total_ms: 120,
          status_code: 200,
          error: null,
        },
        {
          region: "sin",
          placement_region: "aws:sin",
          cloudflare_colo: "SIN",
          execution_colo: "SIN",
          total_ms: 120,
          status_code: 200,
          error: null,
        },
        {
          region: "syd",
          placement_region: "aws:syd",
          cloudflare_colo: "SYD",
          execution_colo: "SYD",
          total_ms: 120,
          status_code: 200,
          error: null,
        },
        {
          region: "gru",
          placement_region: "aws:gru",
          cloudflare_colo: "GRU",
          execution_colo: "GRU",
          total_ms: 120,
          status_code: 200,
          error: null,
        },
      ],
    });
  });
});
