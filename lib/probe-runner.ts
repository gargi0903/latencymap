import { performance } from "node:perf_hooks";
import { normalizeAndValidatePublicUrl } from "@/lib/url-safety";

const MAX_REDIRECTS = 3;
const MAX_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 5000;

export type FetchTimingResult = {
  totalMs: number | null;
  statusCode: number | null;
  error: string | null;
};

export async function fetchWithTiming(targetUrl: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<FetchTimingResult> {
  const started = performance.now();
  let currentUrl = targetUrl;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const validation = await normalizeAndValidatePublicUrl(currentUrl);
    if (!validation.ok) {
      return { totalMs: null, statusCode: null, error: validation.error };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(validation.url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "Latencymap/0.1 (+https://latencymap.local)",
          accept: "*/*",
        },
      });

      if (isRedirect(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          return complete(started, response.status, "Redirect response did not include a location header.");
        }

        if (redirects === MAX_REDIRECTS) {
          return complete(started, response.status, "Too many redirects.");
        }

        currentUrl = new URL(location, validation.url).toString();
        continue;
      }

      await drainLimitedBody(response);
      return complete(started, response.status, null);
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError" ? "Request timed out." : "Request failed.";
      return { totalMs: null, statusCode: null, error: message };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { totalMs: null, statusCode: null, error: "Too many redirects." };
}

function complete(started: number, statusCode: number, error: string | null): FetchTimingResult {
  return {
    totalMs: Math.round(performance.now() - started),
    statusCode,
    error,
  };
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

async function drainLimitedBody(response: Response) {
  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  let received = 0;

  try {
    while (received < MAX_BYTES) {
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
