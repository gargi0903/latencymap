import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PROBE_FETCH_MEASURE_TIMEOUT_MS,
  PROBE_FETCH_WARMUP_TIMEOUT_MS,
  runProbeMeasurement,
} from "./probe-fetch";

const validateUrl = vi.fn(async (url: string) => ({ ok: true as const, url }));

afterEach(() => {
  vi.restoreAllMocks();
  validateUrl.mockReset();
  validateUrl.mockImplementation(async (url: string) => ({ ok: true, url }));
});

describe("runProbeMeasurement", () => {
  it("warms up before measuring and times only until response headers", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("warmup", { status: 200 }))
      .mockImplementationOnce(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return new Response("measured", { status: 200 });
      });

    const result = await runProbeMeasurement("https://example.com", validateUrl, {
      userAgent: "test-probe",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": "test-probe" },
    });
    expect(result).toMatchObject({
      statusCode: 200,
      error: null,
      totalMs: expect.any(Number),
    });
    expect(result.totalMs).toBeGreaterThanOrEqual(15);
    expect(result.totalMs).toBeLessThan(100);
  });

  it("returns validation errors from the measured pass", async () => {
    validateUrl.mockResolvedValueOnce({ ok: true, url: "https://example.com" });
    validateUrl.mockResolvedValueOnce({ ok: false, error: "Localhost URLs are not allowed." });

    const fetchImpl = vi.fn().mockResolvedValue(new Response("warmup", { status: 200 }));

    const result = await runProbeMeasurement("https://example.com", validateUrl, {
      userAgent: "test-probe",
      fetchImpl,
    });

    expect(result).toEqual({
      totalMs: null,
      statusCode: null,
      error: "Localhost URLs are not allowed.",
    });
  });

  it("continues to the measured pass when warmup fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("warmup failed"))
      .mockResolvedValueOnce(new Response("measured", { status: 200 }));

    const result = await runProbeMeasurement("https://example.com", validateUrl, {
      userAgent: "test-probe",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      totalMs: expect.any(Number),
      statusCode: 200,
      error: null,
    });
  });

  it("uses shorter warmup and longer measure timeouts", async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      const signal = init?.signal;
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, 10);
        signal?.addEventListener("abort", () => {
          clearTimeout(timeout);
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
      return new Response("ok", { status: 200 });
    });

    await expect(
      runProbeMeasurement("https://example.com", validateUrl, {
        userAgent: "test-probe",
        fetchImpl,
      }),
    ).resolves.toMatchObject({ statusCode: 200, error: null });

    expect(PROBE_FETCH_WARMUP_TIMEOUT_MS).toBeLessThan(PROBE_FETCH_MEASURE_TIMEOUT_MS);
  });
});
