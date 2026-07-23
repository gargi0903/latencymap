import { matchesProbeSecret } from "./auth";
import { runProbeMeasurement } from "../../../lib/probe-fetch";
import { validateHostnameOnly } from "../../../lib/probe-url-safety";

const DEFAULT_REGION = "cloudflare";
const MAX_BODY_BYTES = 16 * 1024;

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

    if (!env.PROBE_SECRET) {
      return json({ error: "Probe is not configured." }, 503, corsHeaders);
    }

    if (!(await matchesProbeSecret(request.headers.get("x-probe-secret"), env.PROBE_SECRET))) {
      return json({ error: "Unauthorized." }, 401, corsHeaders);
    }

    try {
      const text = await readLimitedRequestText(request);
      const body = JSON.parse(text) as { url?: unknown };

      if (typeof body.url !== "string") {
        return json({ error: "Expected JSON body with a url field." }, 400, corsHeaders);
      }

      const result = await runProbeMeasurement(body.url, validateHostnameOnly, {
        userAgent: "Latencymap-Cloudflare-Probe/0.1",
      });
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
