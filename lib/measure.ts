import type { UrlValidationResult } from "@/lib/url";
import { parsePublicHttpUrl, stripIpv6Brackets } from "@/lib/url";

export const PROBE_FETCH_TIMEOUT_MS = 12_000;
export const PROBE_CLIENT_TIMEOUT_MS = PROBE_FETCH_TIMEOUT_MS + 2_000;

const PROBE_MAX_REQUEST_BODY_BYTES = 16 * 1024;
const PROBE_FETCH_MAX_REDIRECTS = 3;

export async function readLimitedRequestText(
  request: Request,
  maxBodyBytes = PROBE_MAX_REQUEST_BODY_BYTES,
): Promise<string> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBodyBytes) {
    throw new Error("Request body too large.");
  }

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (received <= maxBodyBytes) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      received += value.byteLength;
      if (received > maxBodyBytes) {
        throw new Error("Request body too large.");
      }

      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}

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

// ponytail: one timed GET (incl. redirects); multi-sample if noise becomes a problem
export async function runProbeMeasurement(
  targetUrl: string,
  validateUrl: ValidateUrl,
  options: ProbeFetchOptions,
): Promise<ProbeFetchResult> {
  const result = await runProbePass(targetUrl, createMeasurementUrlValidator(validateUrl), {
    fetchImpl: bindFetch(options.fetchImpl),
    userAgent: options.userAgent,
    timeoutMs: PROBE_FETCH_TIMEOUT_MS,
  });

  if (!result.ok) {
    return {
      totalMs: result.totalMs,
      statusCode: result.statusCode,
      error: result.error,
    };
  }

  return {
    totalMs: result.totalMs,
    statusCode: result.statusCode,
    error: null,
  };
}

function probeFetchErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "Request timed out.";
  }

  if (error instanceof Error && error.message) {
    return `Request failed: ${error.message}`;
  }

  return "Request failed.";
}

type ProbePassOptions = {
  fetchImpl: typeof fetch;
  userAgent: string;
  timeoutMs: number;
};

async function runProbePass(
  targetUrl: string,
  validateUrl: ValidateUrl,
  options: ProbePassOptions,
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
      if (measuredStarted === null) {
        measuredStarted = performance.now();
      }

      const response = await fetchImpl(validation.url, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "user-agent": options.userAgent,
          accept: "*/*",
          "cache-control": "no-cache",
          pragma: "no-cache",
        },
      });

      if (!isRedirect(response.status)) {
        const totalMs = Math.round(performance.now() - measuredStarted);
        await releaseProbeResponse(response);
        return {
          ok: true,
          resolvedUrl: validation.url,
          totalMs,
          statusCode: response.status,
        };
      }

      const location = response.headers.get("location");
      await releaseProbeResponse(response);

      if (!location) {
        return {
          ok: false,
          error: "Redirect response did not include a location header.",
          statusCode: response.status,
          totalMs: Math.round(performance.now() - measuredStarted),
        };
      }

      if (redirects === PROBE_FETCH_MAX_REDIRECTS) {
        return {
          ok: false,
          error: "Too many redirects.",
          statusCode: response.status,
          totalMs: Math.round(performance.now() - measuredStarted),
        };
      }

      currentUrl = new URL(location, validation.url).toString();
    } catch (error) {
      return { ok: false, error: probeFetchErrorMessage(error), statusCode: null, totalMs: null };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, error: "Too many redirects.", statusCode: null, totalMs: null };
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

async function releaseProbeResponse(response: Response) {
  try {
    await response.body?.cancel();
  } catch {}
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
