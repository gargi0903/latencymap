import { createDohDnsResolver, withDnsCache, validatePublicUrlWithDns } from "../lib/url";
import { readLimitedRequestText, runProbeMeasurement } from "../lib/measure";

const DEFAULT_REGION = "cloudflare";

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

const resolvePublicHostname = withDnsCache(createDohDnsResolver());
const validatePublicUrl = (rawUrl: string) => validatePublicUrlWithDns(rawUrl, resolvePublicHostname);

async function matchesProbeSecret(provided: string | null, expected: string): Promise<boolean> {
  const message = new TextEncoder().encode("latencymap-probe-auth-v1");
  const [providedKey, expectedKey] = await Promise.all([
    importHmacKey(provided || "\0"),
    importHmacKey(expected),
  ]);
  const providedSignature = await crypto.subtle.sign("HMAC", providedKey, message);
  return crypto.subtle.verify("HMAC", expectedKey, providedSignature, message);
}

function importHmacKey(value: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(value),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

const worker = {
  async fetch(request: CloudflareRequest, env: ProbeEnv) {
    const requestUrl = new URL(request.url);
    const cloudflareColo = request.cf?.colo ?? null;

    if (request.method === "GET" && requestUrl.pathname === "/healthz") {
      return json({
        ok: true,
        region: env.PROBE_REGION || DEFAULT_REGION,
        placement_region: env.PLACEMENT_REGION || null,
        cloudflare_colo: cloudflareColo,
      });
    }

    if (request.method !== "POST" || requestUrl.pathname !== "/probe") {
      return json({ error: "Not found." }, 404);
    }

    if (!env.PROBE_SECRET) {
      return json({ error: "Probe is not configured." }, 503);
    }

    if (!(await matchesProbeSecret(request.headers.get("x-probe-secret"), env.PROBE_SECRET))) {
      return json({ error: "Unauthorized." }, 401);
    }

    try {
      const text = await readLimitedRequestText(request);
      const body = JSON.parse(text) as { url?: unknown };

      if (typeof body.url !== "string") {
        return json({ error: "Expected JSON body with a url field." }, 400);
      }

      const result = await runProbeMeasurement(body.url, validatePublicUrl, {
        userAgent: "Latencymap-Cloudflare-Probe/0.1",
      });

      return json({
        region: env.PROBE_REGION || DEFAULT_REGION,
        placement_region: env.PLACEMENT_REGION || null,
        cloudflare_colo: cloudflareColo,
        total_ms: result.totalMs,
        status_code: result.statusCode,
        error: result.error,
      });
    } catch {
      return json({ error: "Invalid request." }, 400);
    }
  },
};

export default worker;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
