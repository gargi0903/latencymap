import { PROBE_REGIONS } from "../../../lib/probe-regions";
import { matchesProbeSecret } from "./auth";

const MAX_BODY_BYTES = 16 * 1024;

type RegionalProbeBinding = {
  id: string;
  fetcher: Fetcher;
};

type CoordinatorEnv = {
  PROBE_SECRET?: string;
  PROBE_IAD: Fetcher;
  PROBE_LHR: Fetcher;
  PROBE_SIN: Fetcher;
  PROBE_SYD: Fetcher;
  PROBE_GRU: Fetcher;
};

type RegionalProbeResponse = {
  region?: string;
  placement_region?: string | null;
  cloudflare_colo?: string | null;
  execution_colo?: string | null;
  total_ms?: number | null;
  ttfb_ms?: number | null;
  status_code?: number | null;
  error?: string | null;
};

const worker = {
  async fetch(request: Request, env: CoordinatorEnv) {
    const corsHeaders = getCorsHeaders();

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const requestUrl = new URL(request.url);
    if (request.method === "GET" && requestUrl.pathname === "/healthz") {
      return json(
        {
          ok: true,
          region: "coordinator",
          regions: getRegionalBindings(env).map((binding) => binding.id),
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

      const results = await fanOutProbe(body.url, env);
      return json({ results }, 200, corsHeaders);
    } catch {
      return json({ error: "Invalid request." }, 400, corsHeaders);
    }
  },
};

export default worker;

type RegionalBindingKey = keyof Pick<
  CoordinatorEnv,
  "PROBE_IAD" | "PROBE_LHR" | "PROBE_SIN" | "PROBE_SYD" | "PROBE_GRU"
>;

const REGIONAL_BINDING_KEYS: Record<string, RegionalBindingKey> = {
  iad: "PROBE_IAD",
  lhr: "PROBE_LHR",
  sin: "PROBE_SIN",
  syd: "PROBE_SYD",
  gru: "PROBE_GRU",
};

function getRegionalBindings(env: CoordinatorEnv): RegionalProbeBinding[] {
  return PROBE_REGIONS.map((region) => ({
    id: region.id,
    fetcher: env[REGIONAL_BINDING_KEYS[region.id]],
  }));
}

async function fanOutProbe(url: string, env: CoordinatorEnv) {
  const probeSecret = env.PROBE_SECRET!;
  const probeRequest = new Request("https://probe-internal/probe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-probe-secret": probeSecret,
    },
    body: JSON.stringify({ url }),
  });

  const bindings = getRegionalBindings(env);

  return Promise.all(
    bindings.map(async ({ id, fetcher }) => {
      try {
        const response = await fetcher.fetch(probeRequest);
        const body = (await response.json().catch(() => null)) as RegionalProbeResponse | { error?: string } | null;

        if (!response.ok) {
          const errorMessage =
            body && typeof body === "object" && "error" in body && typeof body.error === "string"
              ? body.error
              : `Regional probe returned HTTP ${response.status}.`;

          return {
            region: id,
            placement_region: null,
            cloudflare_colo: null,
            execution_colo: null,
            total_ms: null,
            ttfb_ms: null,
            status_code: response.status,
            error: errorMessage,
          };
        }

        const probeBody = body as RegionalProbeResponse | null;

        return {
          region: typeof probeBody?.region === "string" ? probeBody.region : id,
          placement_region: probeBody?.placement_region ?? null,
          cloudflare_colo: probeBody?.cloudflare_colo ?? null,
          execution_colo: probeBody?.execution_colo ?? null,
          total_ms: probeBody?.total_ms ?? null,
          ttfb_ms: probeBody?.ttfb_ms ?? null,
          status_code: probeBody?.status_code ?? null,
          error: probeBody?.error ?? null,
        };
      } catch {
        return {
          region: id,
          placement_region: null,
          cloudflare_colo: null,
          execution_colo: null,
          total_ms: null,
          ttfb_ms: null,
          status_code: null,
          error: "Regional probe failed.",
        };
      }
    }),
  );
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
