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
const SECRET = process.env.PROBE_SECRET?.trim();
if (!SECRET) {
  throw new Error("PROBE_SECRET must be set before starting the local probe.");
}

const resolvePublicHostname = withDnsCache(createNodeDnsResolver());
const validatePublicUrl = (rawUrl: string) => validatePublicUrlWithDns(rawUrl, resolvePublicHostname);

const server = http.createServer(async (request, response) => {
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
