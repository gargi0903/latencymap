import type { UrlValidationResult } from "@/lib/probe-url-safety";

export const PROBE_FETCH_MAX_REDIRECTS = 3;
export const PROBE_FETCH_MAX_RESPONSE_BYTES = 64 * 1024;
export const PROBE_FETCH_TIMEOUT_MS = 5000;
export const PROBE_FETCH_WARMUP_TIMEOUT_MS = 1500;
export const PROBE_FETCH_MEASURE_TIMEOUT_MS = PROBE_FETCH_TIMEOUT_MS - PROBE_FETCH_WARMUP_TIMEOUT_MS;

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

export async function runProbeMeasurement(
  targetUrl: string,
  validateUrl: ValidateUrl,
  options: ProbeFetchOptions,
): Promise<ProbeFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;

  await runProbeFetchPass(targetUrl, validateUrl, {
    fetchImpl,
    userAgent: options.userAgent,
    measure: false,
    timeoutMs: PROBE_FETCH_WARMUP_TIMEOUT_MS,
  }).catch(() => undefined);

  return runProbeFetchPass(targetUrl, validateUrl, {
    fetchImpl,
    userAgent: options.userAgent,
    measure: true,
    timeoutMs: PROBE_FETCH_MEASURE_TIMEOUT_MS,
  });
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
  const started = performance.now();
  let currentUrl = targetUrl;

  for (let redirects = 0; redirects <= PROBE_FETCH_MAX_REDIRECTS; redirects += 1) {
    const validation = await validateUrl(currentUrl);
    if (!validation.ok) {
      return { totalMs: null, statusCode: null, error: validation.error };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
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
          return complete(options.measure, started, response.status, "Redirect response did not include a location header.");
        }

        if (redirects === PROBE_FETCH_MAX_REDIRECTS) {
          return complete(options.measure, started, response.status, "Too many redirects.");
        }

        await drainLimitedBody(response);
        currentUrl = new URL(location, validation.url).toString();
        continue;
      }

      const totalMs = options.measure ? Math.round(performance.now() - started) : null;
      await drainLimitedBody(response);
      return {
        totalMs,
        statusCode: response.status,
        error: null,
      };
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError" ? "Request timed out." : "Request failed.";
      return { totalMs: null, statusCode: null, error: message };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { totalMs: null, statusCode: null, error: "Too many redirects." };
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

function complete(measure: boolean, started: number, statusCode: number, error: string): ProbeFetchResult {
  return {
    totalMs: measure ? Math.round(performance.now() - started) : null,
    statusCode,
    error,
  };
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}
