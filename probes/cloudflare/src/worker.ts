import { matchesProbeSecret } from "./auth";
import {
  buildColoDiagnostics,
  pickExecutionColo,
  resolveTraceColo,
} from "./colo-diagnostics";
import { createDohDnsResolver, withDnsCache } from "../../../lib/dns-resolve";
import { readLimitedRequestText } from "../../../lib/probe-request-body";
import { runProbeMeasurement } from "../../../lib/probe-fetch";
import { validatePublicUrlWithDns } from "../../../lib/probe-url-safety";

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

const worker = {
  async fetch(request: CloudflareRequest, env: ProbeEnv) {
    const requestUrl = new URL(request.url);
    const ingressColo = request.cf?.colo || null;

    if (request.method === "GET" && requestUrl.pathname === "/healthz") {
      const trace = await resolveTraceColo();
      const execution = pickExecutionColo(null, trace.colo);

      return json({
        ok: true,
        region: env.PROBE_REGION || DEFAULT_REGION,
        placement_region: env.PLACEMENT_REGION || null,
        cloudflare_colo: ingressColo,
        execution_colo: execution.colo,
        diagnostics: buildColoDiagnostics({
          ingressColo,
          executionColo: execution.colo,
          traceMs: trace.traceMs,
          source: execution.source,
        }),
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
        cloudflare_colo: ingressColo,
        execution_colo: result.executionColo ?? null,
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
