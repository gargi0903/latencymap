import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PROBE_FETCH_MEASURE_SAMPLE_COUNT,
  PROBE_FETCH_MEASURE_TIMEOUT_MS,
  PROBE_FETCH_MIN_SUCCESSFUL_SAMPLES,
  PROBE_FETCH_WARMUP_COUNT,
  PROBE_FETCH_WARMUP_TIMEOUT_MS,
  runProbeMeasurement,
} from "./probe-fetch";

const validateUrl = vi.fn(async (url: string) => ({ ok: true as const, url }));

afterEach(() => {
  vi.restoreAllMocks();
  validateUrl.mockReset();
  validateUrl.mockImplementation(async (url: string) => ({ ok: true, url }));
});

function mockMeasuredResponses(fetchImpl: ReturnType<typeof vi.fn>, delaysMs: number[]) {
  let callCount = 0;
  let measureIndex = 0;
  let now = 0;
  const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);

  fetchImpl.mockImplementation(async () => {
    if (callCount++ < PROBE_FETCH_WARMUP_COUNT) {
      return new Response("warmup", { status: 200 });
    }

    const delay = delaysMs[measureIndex++] ?? 0;
    const started = performance.now();
    now = started + delay;
    return new Response("measured", { status: 200 });
  });

  return () => {
    nowSpy.mockRestore();
  };
}

describe("runProbeMeasurement", () => {
  it("warms up twice, samples TTFB five times, and returns the median", async () => {
    const fetchImpl = vi.fn();
    const restoreNow = mockMeasuredResponses(fetchImpl, [10, 30, 20, 50, 15]);

    const result = await runProbeMeasurement("https://example.com", validateUrl, {
      userAgent: "test-probe",
      fetchImpl,
    });
    restoreNow();

    expect(fetchImpl).toHaveBeenCalledTimes(PROBE_FETCH_WARMUP_COUNT + PROBE_FETCH_MEASURE_SAMPLE_COUNT);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": "test-probe" },
    });
    expect(result).toMatchObject({
      statusCode: 200,
      error: null,
      totalMs: 20,
      ttfbMs: 20,
    });
  });

  it("does not include URL validation time in measured TTFB", async () => {
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

    expect(result).toMatchObject({
      statusCode: 200,
      error: null,
      totalMs: 12,
      ttfbMs: 12,
    });
  });

  it("returns validation errors before any fetch runs", async () => {
    validateUrl.mockResolvedValue({ ok: false, error: "Localhost URLs are not allowed." });

    const fetchImpl = vi.fn().mockResolvedValue(new Response("warmup", { status: 200 }));

    const result = await runProbeMeasurement("https://example.com", validateUrl, {
      userAgent: "test-probe",
      fetchImpl,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({
      totalMs: null,
      ttfbMs: null,
      statusCode: null,
      error: "Localhost URLs are not allowed.",
    });
  });

  it("continues to measured passes when warmup fails", async () => {
    const fetchImpl = vi.fn();
    let callCount = 0;
    let now = 0;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);

    fetchImpl.mockImplementation(async () => {
      if (callCount++ < PROBE_FETCH_WARMUP_COUNT) {
        throw new Error("warmup failed");
      }

      const started = performance.now();
      now = started + 5;
      return new Response("measured", { status: 200 });
    });

    const result = await runProbeMeasurement("https://example.com", validateUrl, {
      userAgent: "test-probe",
      fetchImpl,
    });
    nowSpy.mockRestore();

    expect(fetchImpl).toHaveBeenCalledTimes(PROBE_FETCH_WARMUP_COUNT + PROBE_FETCH_MEASURE_SAMPLE_COUNT);
    expect(result).toMatchObject({
      totalMs: expect.any(Number),
      ttfbMs: expect.any(Number),
      statusCode: 200,
      error: null,
    });
  });

  it("uses shorter warmup and per-sample measure timeouts within the total budget", async () => {
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

    expect(PROBE_FETCH_WARMUP_TIMEOUT_MS * PROBE_FETCH_WARMUP_COUNT).toBeLessThan(
      PROBE_FETCH_MEASURE_TIMEOUT_MS * PROBE_FETCH_MEASURE_SAMPLE_COUNT,
    );
  });

  it("captures execution colo metadata from measured subrequests when available", async () => {
    const fetchImpl = vi.fn();
    for (let index = 0; index < PROBE_FETCH_WARMUP_COUNT; index += 1) {
      fetchImpl.mockResolvedValueOnce(new Response("warmup", { status: 200 }));
    }
    fetchImpl.mockImplementation(() =>
      Promise.resolve(
        Object.assign(new Response("measured", { status: 200 }), {
          cf: { colo: "SIN" },
        }),
      ),
    );

    const result = await runProbeMeasurement("https://example.com", validateUrl, {
      userAgent: "test-probe",
      fetchImpl,
    });

    expect(result).toMatchObject({
      statusCode: 200,
      error: null,
      executionColo: "SIN",
    });
  });

  it("returns the median when some measured samples fail", async () => {
    const fetchImpl = vi.fn();
    const restoreNow = mockMeasuredResponses(fetchImpl, [10, 30, 20, 50, 15]);
    fetchImpl.mockImplementationOnce(async () => {
      throw new Error("sample failed");
    });

    const result = await runProbeMeasurement("https://example.com", validateUrl, {
      userAgent: "test-probe",
      fetchImpl,
    });
    restoreNow();

    expect(result).toMatchObject({
      statusCode: 200,
      error: null,
      totalMs: expect.any(Number),
      ttfbMs: expect.any(Number),
    });
  });

  it("fails when too few measured samples succeed", async () => {
    const fetchImpl = vi.fn();
    for (let index = 0; index < PROBE_FETCH_WARMUP_COUNT; index += 1) {
      fetchImpl.mockResolvedValueOnce(new Response("warmup", { status: 200 }));
    }
    for (let index = 0; index < PROBE_FETCH_MEASURE_SAMPLE_COUNT; index += 1) {
      fetchImpl.mockRejectedValueOnce(new Error("sample failed"));
    }

    const result = await runProbeMeasurement("https://example.com", validateUrl, {
      userAgent: "test-probe",
      fetchImpl,
    });

    expect(result).toEqual({
      totalMs: null,
      ttfbMs: null,
      statusCode: null,
      error: "Request failed.",
    });
    expect(PROBE_FETCH_MIN_SUCCESSFUL_SAMPLES).toBeGreaterThan(1);
  });

  it("resolves DNS once per hostname during a measurement run", async () => {
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));

    await runProbeMeasurement("https://example.com/path-a", validateUrl, {
      userAgent: "test-probe",
      fetchImpl,
    });

    expect(validateUrl).toHaveBeenCalled();
    const callCount = validateUrl.mock.calls.length;
    expect(callCount).toBeLessThan(PROBE_FETCH_WARMUP_COUNT + PROBE_FETCH_MEASURE_SAMPLE_COUNT);
  });
});
