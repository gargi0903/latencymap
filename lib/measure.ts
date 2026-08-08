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

export async function runProbeMeasurement(
  targetUrl: string,
  validateUrl: ValidateUrl,
  options: ProbeFetchOptions,
): Promise<ProbeFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const validateCached = createMeasurementUrlValidator(validateUrl);
  let currentUrl = targetUrl;
  let measuredStarted: number | null = null;

  for (let redirects = 0; redirects <= PROBE_FETCH_MAX_REDIRECTS; redirects += 1) {
    const validation = await validateCached(currentUrl);
    if (!validation.ok) {
      return { totalMs: null, statusCode: null, error: validation.error };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_FETCH_TIMEOUT_MS);

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

      if (!(response.status >= 300 && response.status < 400)) {
        const totalMs = Math.round(performance.now() - measuredStarted);
        await releaseProbeResponse(response);
        return { totalMs, statusCode: response.status, error: null };
      }

      const location = response.headers.get("location");
      await releaseProbeResponse(response);
      const totalMs = Math.round(performance.now() - measuredStarted);

      if (!location) {
        return {
          totalMs,
          statusCode: response.status,
          error: "Redirect response did not include a location header.",
        };
      }

      if (redirects === PROBE_FETCH_MAX_REDIRECTS) {
        return { totalMs, statusCode: response.status, error: "Too many redirects." };
      }

      currentUrl = new URL(location, validation.url).toString();
    } catch (error) {
      return { totalMs: null, statusCode: null, error: probeFetchErrorMessage(error) };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { totalMs: null, statusCode: null, error: "Too many redirects." };
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
