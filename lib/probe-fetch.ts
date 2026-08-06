import { PROBE_FETCH_TIMEOUT_MS } from "@/lib/constants";
import type { UrlValidationResult } from "@/lib/probe-url-safety";
import { parsePublicHttpUrl, stripIpv6Brackets } from "@/lib/probe-url-safety";

export { PROBE_FETCH_TIMEOUT_MS };
const PROBE_FETCH_MAX_REDIRECTS = 3;
export const PROBE_FETCH_WARMUP_COUNT = 3;
export const PROBE_FETCH_MEASURE_SAMPLE_COUNT = 3;
export const PROBE_FETCH_MIN_SUCCESSFUL_SAMPLES = 3;
export const PROBE_FETCH_PASS_TIMEOUT_MS = 4_000;
/** Round reported latency to reduce jitter from sub-10ms noise. */
const LATENCY_ROUNDING_MS = 10;

export type ProbeFetchResult = {
  totalMs: number | null;
  statusCode: number | null;
  error: string | null;
};

type ValidateUrl = (url: string) => UrlValidationResult | Promise<UrlValidationResult>;

type ProbeFetchOptions = {
  userAgent: string;
  fetchImpl?: typeof fetch;
};

type ProbePassResult =
  | {
      ok: true;
      resolvedUrl: string;
      totalMs: number | null;
      statusCode: number;
    }
  | {
      ok: false;
      error: string;
      statusCode: number | null;
      totalMs: number | null;
    };

function bindFetch(fetchImpl?: typeof fetch) {
  return fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
}

export async function runProbeMeasurement(
  targetUrl: string,
  validateUrl: ValidateUrl,
  options: ProbeFetchOptions,
): Promise<ProbeFetchResult> {
  const fetchImpl = bindFetch(options.fetchImpl);
  const deadlineAt = performance.now() + PROBE_FETCH_TIMEOUT_MS;
  const remainingMs = () => Math.max(0, deadlineAt - performance.now());
  const passTimeoutMs = () =>
    Math.max(250, Math.min(PROBE_FETCH_PASS_TIMEOUT_MS, remainingMs() - 250));

  const initialValidation = await validateUrl(targetUrl);
  if (!initialValidation.ok) {
    return failureResult(initialValidation.error);
  }

  if (remainingMs() < 500) {
    return failureResult("Request timed out.");
  }

  const validateCachedUrl = createMeasurementUrlValidator(validateUrl);
  const resolved = await runProbePass(targetUrl, validateCachedUrl, {
    fetchImpl,
    userAgent: options.userAgent,
    timeoutMs: passTimeoutMs(),
    measure: false,
  });

  if (!resolved.ok) {
    return failureResult(resolved.error, resolved.statusCode);
  }

  const measureUrl = resolved.resolvedUrl;

  await runWarmupPasses(PROBE_FETCH_WARMUP_COUNT, async () => {
    if (remainingMs() < 500) {
      return false;
    }

    await runProbePass(measureUrl, validateCachedUrl, {
      fetchImpl,
      userAgent: options.userAgent,
      timeoutMs: passTimeoutMs(),
      measure: false,
    }).catch(() => undefined);
    return true;
  });

  const samples: number[] = [];
  let lastStatusCode: number | null = null;
  let lastError: string | null = null;

  await runMeasurePasses(PROBE_FETCH_MEASURE_SAMPLE_COUNT, async () => {
    if (remainingMs() < passTimeoutMs()) {
      return false;
    }

    const result = await runProbePass(measureUrl, validateCachedUrl, {
      fetchImpl,
      userAgent: options.userAgent,
      timeoutMs: passTimeoutMs(),
      measure: true,
    });

    if (!result.ok || result.totalMs === null) {
      lastError = result.ok ? "Request failed." : result.error;
      return true;
    }

    samples.push(result.totalMs);
    lastStatusCode = result.statusCode;
    return true;
  });

  if (samples.length < PROBE_FETCH_MIN_SUCCESSFUL_SAMPLES) {
    return {
      totalMs: null,
      statusCode: lastStatusCode,
      error: lastError ?? "Request timed out.",
    };
  }

  return {
    totalMs: aggregateLatencySamples(samples),
    statusCode: lastStatusCode,
    error: null,
  };
}

/** Sequential pass runner — warmups/samples must not overlap or timings change. */
async function runWarmupPasses(
  remaining: number,
  runPass: () => Promise<boolean>,
): Promise<void> {
  if (remaining <= 0) {
    return;
  }

  const shouldContinue = await runPass();
  if (!shouldContinue) {
    return;
  }

  await runWarmupPasses(remaining - 1, runPass);
}

async function runMeasurePasses(
  remaining: number,
  runPass: () => Promise<boolean>,
): Promise<void> {
  if (remaining <= 0) {
    return;
  }

  const shouldContinue = await runPass();
  if (!shouldContinue) {
    return;
  }

  await runMeasurePasses(remaining - 1, runPass);
}

async function runProbePass(
  targetUrl: string,
  validateUrl: ValidateUrl,
  options: {
    fetchImpl: typeof fetch;
    userAgent: string;
    timeoutMs: number;
    measure: boolean;
  },
): Promise<ProbePassResult> {
  let currentUrl = targetUrl;
  let measuredStarted: number | null = null;
  const fetchImpl = bindFetch(options.fetchImpl);

  for (let redirects = 0; redirects <= PROBE_FETCH_MAX_REDIRECTS; redirects += 1) {
    const validation = await validateUrl(currentUrl);
    if (!validation.ok) {
      return { ok: false, error: validation.error, statusCode: null, totalMs: null };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      if (options.measure && measuredStarted === null) {
        measuredStarted = performance.now();
      }

      const response = await fetchImpl(validation.url, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
        headers: probeFetchHeaders(options.userAgent),
      });

      if (isRedirect(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          await releaseProbeResponse(response);
          return passError(options.measure, measuredStarted, response.status, "Redirect response did not include a location header.");
        }

        if (redirects === PROBE_FETCH_MAX_REDIRECTS) {
          await releaseProbeResponse(response);
          return passError(options.measure, measuredStarted, response.status, "Too many redirects.");
        }

        await releaseProbeResponse(response);
        currentUrl = new URL(location, validation.url).toString();
        continue;
      }

      const totalMs =
        options.measure && measuredStarted !== null ? Math.round(performance.now() - measuredStarted) : null;

      await releaseProbeResponse(response);

      return {
        ok: true,
        resolvedUrl: validation.url,
        totalMs,
        statusCode: response.status,
      };
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "Request timed out."
          : error instanceof Error && error.message
            ? `Request failed: ${error.message}`
            : "Request failed.";
      return { ok: false, error: message, statusCode: null, totalMs: null };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, error: "Too many redirects.", statusCode: null, totalMs: null };
}

function probeFetchHeaders(userAgent: string): HeadersInit {
  return {
    "user-agent": userAgent,
    accept: "*/*",
    "cache-control": "no-cache",
    pragma: "no-cache",
  };
}

export function roundLatencyMs(value: number, stepMs = LATENCY_ROUNDING_MS): number {
  return Math.round(value / stepMs) * stepMs;
}

/**
 * Average the two fastest of three checks, then round to the nearest 10 ms.
 * Drops one slow spike so repeat numbers stay steadier without hiding failures.
 */
export function aggregateLatencySamples(samples: number[]): number {
  if (samples.length === 0) {
    throw new Error("aggregateLatencySamples requires at least one sample.");
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const used = sorted.length >= 3 ? sorted.slice(0, 2) : sorted;
  const average = used.reduce((sum, sample) => sum + sample, 0) / used.length;
  return roundLatencyMs(average);
}

function failureResult(error: string, statusCode: number | null = null): ProbeFetchResult {
  return {
    totalMs: null,
    statusCode,
    error,
  };
}

function passError(
  measure: boolean,
  measuredStarted: number | null,
  statusCode: number,
  error: string,
): ProbePassResult {
  return {
    ok: false,
    error,
    statusCode,
    totalMs: measure && measuredStarted !== null ? Math.round(performance.now() - measuredStarted) : null,
  };
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

/** Release the response body so keep-alive connections can be reused across samples. */
async function releaseProbeResponse(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    // Ignore body cancellation failures; the sample timing is already captured.
  }
}

function createMeasurementUrlValidator(validateUrl: ValidateUrl): ValidateUrl {
  const validatedHosts = new Map<string, UrlValidationResult>();

  return async (rawUrl: string) => {
    const parsed = parsePublicHttpUrl(rawUrl);
    if (!parsed.ok) {
      return parsed;
    }

    const hostname = stripIpv6Brackets(parsed.url.hostname).toLowerCase();
    const cached = validatedHosts.get(hostname);
    if (cached) {
      if (!cached.ok) {
        return cached;
      }

      return { ok: true, url: parsed.url.toString() };
    }

    const result = await validateUrl(rawUrl);
    validatedHosts.set(hostname, result);
    return result;
  };
}
