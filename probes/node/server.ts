import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createNodeDnsResolver } from "../../lib/dns-resolve-node";
import { withDnsCache } from "../../lib/dns-resolve";
import { matchesProbeSecret } from "../../lib/probe-auth";
import { runProbeMeasurement } from "../../lib/probe-fetch";
import { validatePublicUrlWithDns } from "../../lib/probe-url-safety";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";
const REGION = process.env.PROBE_REGION ?? "local";
const configuredSecret = process.env.PROBE_SECRET?.trim();
if (!configuredSecret) {
  throw new Error("PROBE_SECRET must be set before starting the local probe.");
}
const SECRET = configuredSecret;

const resolvePublicHostname = withDnsCache(createNodeDnsResolver());
const validatePublicUrl = (rawUrl: string) => validatePublicUrlWithDns(rawUrl, resolvePublicHostname);

function handleHealthz(response: ServerResponse) {
  sendJson(response, 200, {
    ok: true,
    region: REGION,
    placement_region: null,
    cloudflare_colo: null,
  });
}

async function authorizeProbe(request: IncomingMessage, response: ServerResponse) {
  const providedSecret = request.headers["x-probe-secret"];
  const secret = Array.isArray(providedSecret) ? providedSecret[0] : providedSecret ?? null;
  if (await matchesProbeSecret(secret, SECRET)) {
    return true;
  }

  sendJson(response, 401, { error: "Unauthorized." });
  return false;
}

async function runAuthorizedProbe(request: IncomingMessage, response: ServerResponse) {
  try {
    const body = JSON.parse(await readRequestBody(request)) as { url?: unknown };
    if (typeof body.url !== "string") {
      sendJson(response, 400, { error: "Expected JSON body with a url field." });
      return;
    }

    const result = await runProbeMeasurement(body.url, validatePublicUrl, {
      userAgent: "Latencymap-Probe/0.1",
    });
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
}

async function handleProbe(request: IncomingMessage, response: ServerResponse) {
  if (!(await authorizeProbe(request, response))) {
    return;
  }

  await runAuthorizedProbe(request, response);
}

function isHealthz(request: IncomingMessage) {
  return request.method === "GET" && request.url === "/healthz";
}

function isProbeRoute(request: IncomingMessage) {
  return request.method === "POST" && request.url === "/probe";
}

function routeRequest(request: IncomingMessage, response: ServerResponse) {
  if (isHealthz(request)) {
    handleHealthz(response);
    return;
  }

  if (isProbeRoute(request)) {
    void handleProbe(request, response);
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

const server = http.createServer((request, response) => {
  routeRequest(request, response);
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
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}
