import type { UrlValidationResult } from "@/lib/probe-url-safety";
import { parsePublicHttpUrl, stripIpv6Brackets } from "@/lib/probe-url-safety";

export const PROBE_FETCH_MAX_REDIRECTS = 3;
export const PROBE_FETCH_MAX_RESPONSE_BYTES = 64 * 1024;
export const PROBE_FETCH_TIMEOUT_MS = 12_000;
export const PROBE_FETCH_WARMUP_COUNT = 2;
export const PROBE_FETCH_WARMUP_TIMEOUT_MS = 2_000;
export const PROBE_FETCH_MEASURE_SAMPLE_COUNT = 5;
export const PROBE_FETCH_MIN_SUCCESSFUL_SAMPLES = 3;
export const PROBE_FETCH_INTER_SAMPLE_DELAY_MS = 40;
export const PROBE_FETCH_MEASURE_BUDGET_MS =
  PROBE_FETCH_TIMEOUT_MS - PROBE_FETCH_WARMUP_COUNT * PROBE_FETCH_WARMUP_TIMEOUT_MS;
export const PROBE_FETCH_MEASURE_TIMEOUT_MS = Math.floor(
  PROBE_FETCH_MEASURE_BUDGET_MS / PROBE_FETCH_MEASURE_SAMPLE_COUNT,
);

export type ProbeFetchResult = {
  totalMs: number | null;
  ttfbMs: number | null;
  statusCode: number | null;
  error: string | null;
  executionColo?: string | null;
};

type ValidateUrl = (url: string) => UrlValidationResult | Promise<UrlValidationResult>;

type ProbeFetchOptions = {
  userAgent: string;
  fetchImpl?: typeof fetch;
};

export async function runProbeMeasurement(
  targetUrl: string,
  validateUrl: ValidateUrl,
  options: ProbeFetchOptions,
): Promise<ProbeFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const initialValidation = await validateUrl(targetUrl);
  if (!initialValidation.ok) {
    return {
      totalMs: null,
      ttfbMs: null,
      statusCode: null,
      error: initialValidation.error,
    };
  }

  const validateCachedUrl = createMeasurementUrlValidator(validateUrl);

  for (let warmup = 0; warmup < PROBE_FETCH_WARMUP_COUNT; warmup += 1) {
    await runProbeFetchPass(targetUrl, validateCachedUrl, {
      fetchImpl,
      userAgent: options.userAgent,
      measure: false,
      timeoutMs: PROBE_FETCH_WARMUP_TIMEOUT_MS,
    }).catch(() => undefined);
  }

  const samples: number[] = [];
  let lastSuccess: ProbeFetchResult | null = null;
  let lastError: string | null = null;

  for (let sample = 0; sample < PROBE_FETCH_MEASURE_SAMPLE_COUNT; sample += 1) {
    if (sample > 0) {
      await delay(PROBE_FETCH_INTER_SAMPLE_DELAY_MS);
    }

    const result = await runProbeFetchPass(targetUrl, validateCachedUrl, {
      fetchImpl,
      userAgent: options.userAgent,
      measure: true,
      timeoutMs: PROBE_FETCH_MEASURE_TIMEOUT_MS,
    });

    if (result.error || result.totalMs === null) {
      lastError = result.error;
      continue;
    }

    samples.push(result.totalMs);
    lastSuccess = result;
  }

  if (samples.length < PROBE_FETCH_MIN_SUCCESSFUL_SAMPLES) {
    return {
      totalMs: null,
      ttfbMs: null,
      statusCode: lastSuccess?.statusCode ?? null,
      error: lastError ?? "Request failed.",
    };
  }

  const ttfbMs = median(samples);
  return {
    totalMs: ttfbMs,
    ttfbMs,
    statusCode: lastSuccess!.statusCode,
    error: null,
    executionColo: lastSuccess!.executionColo ?? null,
  };
}

async function runProbeFetchPass(
  targetUrl: string,
  validateUrl: ValidateUrl,
  options: {
    fetchImpl: typeof fetch;
    userAgent: string;
    measure: boolean;
    timeoutMs: number;
  },
): Promise<ProbeFetchResult> {
  let currentUrl = targetUrl;
  let measuredStarted: number | null = null;

  for (let redirects = 0; redirects <= PROBE_FETCH_MAX_REDIRECTS; redirects += 1) {
    const validation = await validateUrl(currentUrl);
    if (!validation.ok) {
      return { totalMs: null, ttfbMs: null, statusCode: null, error: validation.error };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      if (options.measure && measuredStarted === null) {
        measuredStarted = performance.now();
      }

      const response = await options.fetchImpl(validation.url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": options.userAgent,
          accept: "*/*",
        },
      });

      if (isRedirect(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          return complete(options.measure, measuredStarted, response.status, "Redirect response did not include a location header.");
        }

        if (redirects === PROBE_FETCH_MAX_REDIRECTS) {
          return complete(options.measure, measuredStarted, response.status, "Too many redirects.");
        }

        await drainLimitedBody(response);
        currentUrl = new URL(location, validation.url).toString();
        continue;
      }

      const totalMs =
        options.measure && measuredStarted !== null ? Math.round(performance.now() - measuredStarted) : null;
      await drainLimitedBody(response);
      return {
        totalMs,
        ttfbMs: totalMs,
        statusCode: response.status,
        error: null,
        executionColo: options.measure ? getResponseColo(response) : undefined,
      };
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError" ? "Request timed out." : "Request failed.";
      return { totalMs: null, ttfbMs: null, statusCode: null, error: message };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { totalMs: null, ttfbMs: null, statusCode: null, error: "Too many redirects." };
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
  }

  return sorted[middle]!;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function drainLimitedBody(response: Response) {
  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  let received = 0;

  try {
    while (received < PROBE_FETCH_MAX_RESPONSE_BYTES) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      received += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function complete(
  measure: boolean,
  measuredStarted: number | null,
  statusCode: number,
  error: string,
): ProbeFetchResult {
  const totalMs = measure && measuredStarted !== null ? Math.round(performance.now() - measuredStarted) : null;
  return {
    totalMs,
    ttfbMs: totalMs,
    statusCode,
    error,
  };
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

function getResponseColo(response: Response): string | null {
  const colo = (response as Response & { cf?: { colo?: string } }).cf?.colo;
  return typeof colo === "string" && colo.trim().length > 0 ? colo : null;
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
