import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildColoDiagnostics,
  parseTraceColo,
  pickExecutionColo,
  resolveTraceColo,
} from "./colo-diagnostics";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseTraceColo", () => {
  it("extracts the colo line from a trace body", () => {
    const trace = ["fl=123", "h=cloudflare.com", "colo=SIN", "loc=SG"].join("\n");
    expect(parseTraceColo(trace)).toBe("SIN");
  });

  it("returns null when colo is missing", () => {
    expect(parseTraceColo("fl=123\nh=cloudflare.com")).toBeNull();
  });
});

describe("pickExecutionColo", () => {
  it("prefers subrequest metadata over trace", () => {
    expect(pickExecutionColo("SIN", "IAD")).toEqual({
      colo: "SIN",
      source: "subrequest",
    });
  });

  it("falls back to trace when subrequest metadata is unavailable", () => {
    expect(pickExecutionColo(null, "LHR")).toEqual({
      colo: "LHR",
      source: "trace",
    });
  });
});

describe("buildColoDiagnostics", () => {
  it("includes ingress and execution metadata", () => {
    expect(
      buildColoDiagnostics({
        ingressColo: "IAD",
        executionColo: "SIN",
        traceMs: 42,
        source: "trace",
      }),
    ).toEqual({
      trace_ms: 42,
      trace_colo: "SIN",
      ingress_colo: "IAD",
      source: "trace",
    });
  });
});

describe("resolveTraceColo", () => {
  it("fetches the trace endpoint with no-store caching", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("fl=123\ncolo=SYD\n", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );

    await expect(resolveTraceColo(fetchImpl)).resolves.toEqual({
      colo: "SYD",
      traceMs: expect.any(Number),
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://cloudflare.com/cdn-cgi/trace",
        cache: "no-store",
      }),
    );
  });

  it("returns null when the trace request fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(resolveTraceColo(fetchImpl)).resolves.toEqual({
      colo: null,
      traceMs: null,
    });
  });
});
