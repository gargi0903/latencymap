import dns from "node:dns/promises";
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import net from "node:net";
import { performance } from "node:perf_hooks";
import { isBlockedIp } from "../../lib/ip-blocklist";
import { matchesProbeSecret } from "../../lib/probe-auth";
import {
  isBlockedHostname,
  parsePublicHttpUrl,
  stripIpv6Brackets,
  type UrlValidationResult,
} from "../../lib/probe-url-safety";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";
const REGION = process.env.PROBE_REGION ?? "local";
const SECRET = process.env.PROBE_SECRET?.trim();
const MAX_REDIRECTS = 3;
const MAX_BYTES = 64 * 1024;
const TIMEOUT_MS = 5000;

if (!SECRET) {
  throw new Error("PROBE_SECRET must be set before starting the local probe.");
}

type FetchTimingResult = {
  totalMs: number | null;
  statusCode: number | null;
  error: string | null;
};

const server = http.createServer(async (request, response) => {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/healthz") {
    sendJson(response, 200, {
      ok: true,
      region: REGION,
      placement_region: null,
      cloudflare_colo: null,
    });
    return;
  }

  if (request.method !== "POST" || request.url !== "/probe") {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  const providedSecret = request.headers["x-probe-secret"];
  const secret = Array.isArray(providedSecret) ? providedSecret[0] : providedSecret ?? null;
  if (!(await matchesProbeSecret(secret, SECRET))) {
    sendJson(response, 401, { error: "Unauthorized." });
    return;
  }

  try {
    const body = JSON.parse(await readRequestBody(request)) as { url?: unknown };
    if (typeof body.url !== "string") {
      sendJson(response, 400, { error: "Expected JSON body with a url field." });
      return;
    }

    const result = await fetchWithTiming(body.url);
    sendJson(response, 200, {
      region: REGION,
      placement_region: null,
      cloudflare_colo: null,
      total_ms: result.totalMs,
      status_code: result.statusCode,
      error: result.error,
    });
  } catch {
    sendJson(response, 400, { error: "Invalid request." });
  }
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPERM") {
    console.error(
      `Latencymap probe could not listen on http://${HOST}:${PORT}. The current environment blocked opening a local server port. Run npm run dev:local from a normal terminal, or approve the command when Codex asks for local server permissions.`,
    );
    process.exit(1);
  }

  throw error;
});

server.listen(PORT, HOST, () => {
  console.log(`Latencymap probe listening on http://${HOST}:${PORT} for region ${REGION}`);
});

async function fetchWithTiming(targetUrl: string): Promise<FetchTimingResult> {
  const started = performance.now();
  let currentUrl = targetUrl;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const validation = await normalizeAndValidatePublicUrl(currentUrl);
    if (!validation.ok) {
      return { totalMs: null, statusCode: null, error: validation.error };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const fetchResponse = await fetch(validation.url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "Latencymap-Probe/0.1",
          accept: "*/*",
        },
      });

      if (fetchResponse.status >= 300 && fetchResponse.status < 400) {
        const location = fetchResponse.headers.get("location");
        if (!location) {
          return complete(started, fetchResponse.status, "Redirect response did not include a location header.");
        }

        if (redirects === MAX_REDIRECTS) {
          return complete(started, fetchResponse.status, "Too many redirects.");
        }

        currentUrl = new URL(location, validation.url).toString();
        continue;
      }

      await drainLimitedBody(fetchResponse);
      return complete(started, fetchResponse.status, null);
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

async function drainLimitedBody(fetchResponse: Response) {
  if (!fetchResponse.body) {
    return;
  }

  const reader = fetchResponse.body.getReader();
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

async function normalizeAndValidatePublicUrl(rawUrl: string): Promise<UrlValidationResult> {
  const parsed = parsePublicHttpUrl(rawUrl);
  if (!parsed.ok) {
    return parsed;
  }

  const hostname = stripIpv6Brackets(parsed.url.hostname);
  if (isBlockedHostname(hostname)) {
    return { ok: false, error: "Localhost URLs are not allowed." };
  }

  if (net.isIP(hostname)) {
    return isBlockedIp(hostname)
      ? { ok: false, error: "Private or internal IP addresses are not allowed." }
      : { ok: true, url: parsed.url.toString() };
  }

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0 || records.some((record) => isBlockedIp(record.address))) {
      return { ok: false, error: "This hostname resolves to a private or internal IP address." };
    }
  } catch {
    return { ok: false, error: "Hostname did not resolve." };
  }

  return { ok: true, url: parsed.url.toString() };
}

function readRequestBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 16 * 1024) {
        request.destroy();
        reject(new Error("Request body too large."));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  setCors(response);
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function setCors(response: ServerResponse) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type, x-probe-secret");
}
