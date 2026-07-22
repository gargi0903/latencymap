import dns from "node:dns/promises";
import http from "node:http";
import net from "node:net";
import { performance } from "node:perf_hooks";

const PORT = Number(process.env.PORT ?? 8787);
const REGION = process.env.PROBE_REGION ?? process.env.FLY_REGION ?? "local";
const SECRET = process.env.PROBE_SECRET;
const MAX_REDIRECTS = 3;
const MAX_BYTES = 64 * 1024;
const TIMEOUT_MS = 5000;

const server = http.createServer(async (request, response) => {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/healthz") {
    sendJson(response, 200, { ok: true, region: REGION });
    return;
  }

  if (request.method !== "POST" || request.url !== "/probe") {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  if (SECRET && request.headers["x-probe-secret"] !== SECRET) {
    sendJson(response, 401, { error: "Unauthorized." });
    return;
  }

  try {
    const body = JSON.parse(await readRequestBody(request));
    if (typeof body.url !== "string") {
      sendJson(response, 400, { error: "Expected JSON body with a url field." });
      return;
    }

    const result = await fetchWithTiming(body.url);
    sendJson(response, 200, {
      region: REGION,
      total_ms: result.totalMs,
      status_code: result.statusCode,
      error: result.error,
    });
  } catch {
    sendJson(response, 400, { error: "Invalid request." });
  }
});

server.listen(PORT, () => {
  console.log(`Latencymap probe listening on :${PORT} for region ${REGION}`);
});

async function fetchWithTiming(targetUrl) {
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

function complete(started, statusCode, error) {
  return {
    totalMs: Math.round(performance.now() - started),
    statusCode,
    error,
  };
}

async function drainLimitedBody(fetchResponse) {
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

async function normalizeAndValidatePublicUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl).trim());
  } catch {
    return { ok: false, error: "Enter a valid absolute URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only HTTP and HTTPS URLs are allowed." };
  }

  if (url.username || url.password) {
    return { ok: false, error: "URLs with embedded credentials are not allowed." };
  }

  url.hash = "";
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }

  if (url.pathname === "/") {
    url.pathname = "";
  }

  const hostname = url.hostname;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return { ok: false, error: "Localhost URLs are not allowed." };
  }

  if (net.isIP(hostname)) {
    return isBlockedIp(hostname)
      ? { ok: false, error: "Private or internal IP addresses are not allowed." }
      : { ok: true, url: url.toString() };
  }

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0 || records.some((record) => isBlockedIp(record.address))) {
      return { ok: false, error: "This hostname resolves to a private or internal IP address." };
    }
  } catch {
    return { ok: false, error: "Hostname did not resolve." };
  }

  return { ok: true, url: url.toString() };
}

function isBlockedIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (family === 6) {
    const normalized = ip.toLowerCase();
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return true;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
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

function sendJson(response, status, body) {
  setCors(response);
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function setCors(response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type, x-probe-secret");
}
