import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PROBE_FETCH_MEASURE_SAMPLE_COUNT,
  PROBE_FETCH_MIN_SUCCESSFUL_SAMPLES,
  PROBE_FETCH_PASS_TIMEOUT_MS,
  PROBE_FETCH_TIMEOUT_MS,
  PROBE_FETCH_WARMUP_COUNT,
  aggregateLatencySamples,
  roundLatencyMs,
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
    const index = callCount++;

    if (index === 0) {
      return new Response("resolve", { status: 200 });
    }

    if (index <= PROBE_FETCH_WARMUP_COUNT) {
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
  it("warms up, samples three times, and returns the stabilized average", async () => {
    const fetchImpl = vi.fn();
    const restoreNow = mockMeasuredResponses(fetchImpl, [10, 30, 20]);

    const result = await runProbeMeasurement("https://example.com", validateUrl, {
      userAgent: "test-probe",
      fetchImpl,
    });
    restoreNow();

    expect(fetchImpl).toHaveBeenCalledTimes(1 + PROBE_FETCH_WARMUP_COUNT + PROBE_FETCH_MEASURE_SAMPLE_COUNT);
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
    expect(result).toMatchObject({
      statusCode: 200,
      error: null,
      totalMs: 20,
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

    expect(result).toMatchObject({
      statusCode: 200,
      error: null,
      totalMs: 10,
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
      const index = callCount++;
      if (index === 0) {
        return new Response("resolve", { status: 200 });
      }

      if (index <= PROBE_FETCH_WARMUP_COUNT) {
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

    expect(fetchImpl).toHaveBeenCalledTimes(1 + PROBE_FETCH_WARMUP_COUNT + PROBE_FETCH_MEASURE_SAMPLE_COUNT);
    expect(result).toMatchObject({
      totalMs: expect.any(Number),
      statusCode: 200,
      error: null,
    });
  });

  it("keeps the full measurement run inside the total probe budget", async () => {
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

    const maxPasses = 1 + PROBE_FETCH_WARMUP_COUNT + PROBE_FETCH_MEASURE_SAMPLE_COUNT;
    expect(
      PROBE_FETCH_PASS_TIMEOUT_MS * maxPasses,
    ).toBeGreaterThan(PROBE_FETCH_TIMEOUT_MS);
    expect(maxPasses * 10).toBeLessThan(PROBE_FETCH_TIMEOUT_MS);
  });

  it("fails when too few measured samples succeed", async () => {
    const fetchImpl = vi.fn();
    fetchImpl.mockResolvedValueOnce(new Response("resolve", { status: 200 }));
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
      statusCode: null,
      error: "Request failed: sample failed",
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
    expect(callCount).toBeLessThan(1 + PROBE_FETCH_WARMUP_COUNT + PROBE_FETCH_MEASURE_SAMPLE_COUNT);
  });

  it("resolves redirects once and measures the final URL", async () => {
    const fetchImpl = vi.fn();
    let callCount = 0;

    fetchImpl.mockImplementation(async (input) => {
      const url = String(input);
      callCount += 1;

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
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes("www.youtube.com"))).toBe(true);
    expect(
      fetchImpl.mock.calls.filter(([url]) => String(url).includes("youtube.com") && !String(url).includes("www."))
        .length,
    ).toBe(1);
    expect(callCount).toBe(2 + PROBE_FETCH_WARMUP_COUNT + PROBE_FETCH_MEASURE_SAMPLE_COUNT);
  });
});

describe("aggregateLatencySamples", () => {
  it("averages the two fastest checks and rounds to 10 ms", () => {
    expect(aggregateLatencySamples([10, 30, 20])).toBe(20);
    expect(aggregateLatencySamples([100, 105, 200])).toBe(100);
    expect(aggregateLatencySamples([104, 108, 112])).toBe(110);
  });
});

describe("roundLatencyMs", () => {
  it("rounds to the nearest 10 ms", () => {
    expect(roundLatencyMs(104)).toBe(100);
    expect(roundLatencyMs(105)).toBe(110);
    expect(roundLatencyMs(15)).toBe(20);
  });
});
