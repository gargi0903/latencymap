import { describe, expect, it } from "vitest";
import worker from "../probes/cloudflare/src/worker";

function probeRequest(url: string, secret?: string) {
  return new Request("https://probe.example/probe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-probe-secret": secret } : {}),
    },
    body: JSON.stringify({ url }),
  });
}

describe("Cloudflare probe boundary", () => {
  it("fails closed when the probe secret is missing", async () => {
    const response = await worker.fetch(probeRequest("https://example.com"), {});

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Probe is not configured." });
  });

  it("rejects a missing or wrong credential", async () => {
    const env = { PROBE_SECRET: "configured-secret" };

    await expect(worker.fetch(probeRequest("https://example.com"), env)).resolves.toMatchObject({ status: 401 });
    await expect(worker.fetch(probeRequest("https://example.com", "wrong-secret"), env)).resolves.toMatchObject({
      status: 401,
    });
  });

  it("blocks an IPv4-mapped loopback target after authenticating", async () => {
    const response = await worker.fetch(probeRequest("http://[::ffff:7f00:1]", "configured-secret"), {
      PROBE_SECRET: "configured-secret",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      total_ms: null,
      status_code: null,
      error: "Private or internal IP addresses are not allowed.",
    });
  });
});
