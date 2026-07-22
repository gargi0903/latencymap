import { validateHostnameOnly } from "../../../lib/probe-url-safety";

const DEFAULT_REGION = "cloudflare";
const MAX_BODY_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5000;

type ProbeEnv = {
  PROBE_REGION?: string;
  PLACEMENT_REGION?: string;
  PROBE_SECRET?: string;
};

type CloudflareRequest = Request & {
  cf?: {
    colo?: string;
  };
};

type FetchTimingResult = {
  totalMs: number | null;
  statusCode: number | null;
  error: string | null;
};

const worker = {
  async fetch(request: CloudflareRequest, env: ProbeEnv) {
    const corsHeaders = getCorsHeaders();

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const requestUrl = new URL(request.url);
    if (request.method === "GET" && requestUrl.pathname === "/healthz") {
      return json(
        {
          ok: true,
          region: env.PROBE_REGION || DEFAULT_REGION,
          placement_region: env.PLACEMENT_REGION || null,
          cloudflare_colo: request.cf?.colo || null,
        },
        200,
        corsHeaders,
      );
    }

    if (request.method !== "POST" || requestUrl.pathname !== "/probe") {
      return json({ error: "Not found." }, 404, corsHeaders);
    }

    if (env.PROBE_SECRET && request.headers.get("x-probe-secret") !== env.PROBE_SECRET) {
      return json({ error: "Unauthorized." }, 401, corsHeaders);
    }

    try {
      const text = await readLimitedRequestText(request);
      const body = JSON.parse(text) as { url?: unknown };

      if (typeof body.url !== "string") {
        return json({ error: "Expected JSON body with a url field." }, 400, corsHeaders);
      }

      const result = await fetchWithTiming(body.url);
      return json(
        {
          region: env.PROBE_REGION || DEFAULT_REGION,
          placement_region: env.PLACEMENT_REGION || null,
          cloudflare_colo: request.cf?.colo || null,
          total_ms: result.totalMs,
          status_code: result.statusCode,
          error: result.error,
        },
        200,
        corsHeaders,
      );
    } catch {
      return json({ error: "Invalid request." }, 400, corsHeaders);
    }
  },
};

export default worker;

async function fetchWithTiming(targetUrl: string): Promise<FetchTimingResult> {
  const started = performance.now();
  let currentUrl = targetUrl;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const validation = validateHostnameOnly(currentUrl);
    if (!validation.ok) {
      return { totalMs: null, statusCode: null, error: validation.error };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(validation.url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "Latencymap-Cloudflare-Probe/0.1",
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

async function readLimitedRequestText(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    throw new Error("Request body too large.");
  }

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (received <= MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      received += value.byteLength;
      if (received > MAX_BODY_BYTES) {
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

async function drainLimitedBody(response: Response) {
  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  let received = 0;

  try {
    while (received < MAX_RESPONSE_BYTES) {
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

function complete(started: number, statusCode: number, error: string | null): FetchTimingResult {
  return {
    totalMs: Math.round(performance.now() - started),
    statusCode,
    error,
  };
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

function json(body: unknown, status: number, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...extraHeaders,
      "content-type": "application/json",
    },
  });
}

function getCorsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-probe-secret",
  };
}
