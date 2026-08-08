import { afterEach, describe, expect, it, vi } from "vitest";
import { runProbeMeasurement } from "@/lib/measure";

const validateUrl = vi.fn(async (url: string) => ({ ok: true as const, url }));

afterEach(() => {
  vi.restoreAllMocks();
  validateUrl.mockReset();
  validateUrl.mockImplementation(async (url: string) => ({ ok: true, url }));
});

describe("runProbeMeasurement", () => {
  it("times one GET and returns the status", async () => {
    let now = 0;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
    const fetchImpl = vi.fn(async () => {
      const started = performance.now();
      now = started + 42;
      return new Response("ok", { status: 200 });
    });

    const result = await runProbeMeasurement("https://example.com", validateUrl, {
      userAgent: "test-probe",
      fetchImpl,
    });
    nowSpy.mockRestore();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: {
        "user-agent": "test-probe",
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
    });
    expect(result).toEqual({
      statusCode: 200,
      error: null,
      totalMs: 42,
    });
  });

  it("does not include URL validation time in measured response time", async () => {
    let now = 0;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
    validateUrl.mockImplementation(async (url) => {
      now += 200;
      return { ok: true, url };
    });

    const fetchImpl = vi.fn(async () => {
      const started = performance.now();
      now = started + 12;
      return new Response("measured", { status: 200 });
    });

    const result = await runProbeMeasurement("https://example.com", validateUrl, {
      userAgent: "test-probe",
      fetchImpl,
    });
    nowSpy.mockRestore();

    expect(result).toEqual({
      statusCode: 200,
      error: null,
      totalMs: 12,
    });
  });

  it("returns validation errors before any fetch runs", async () => {
    validateUrl.mockResolvedValue({ ok: false, error: "Localhost URLs are not allowed." });
    const fetchImpl = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));

    const result = await runProbeMeasurement("https://example.com", validateUrl, {
      userAgent: "test-probe",
      fetchImpl,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({
      totalMs: null,
      statusCode: null,
      error: "Localhost URLs are not allowed.",
    });
  });

  it("follows redirects once and measures through the final URL", async () => {
    const fetchImpl = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("youtube.com") && !url.includes("www.")) {
        return Response.redirect("https://www.youtube.com/", 301);
      }
      return new Response("ok", { status: 200 });
    });

    const result = await runProbeMeasurement("https://youtube.com", validateUrl, {
      userAgent: "test-probe",
      fetchImpl,
    });

    expect(result.error).toBeNull();
    expect(result.statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes("www.youtube.com"))).toBe(true);
  });
});
