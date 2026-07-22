const DEFAULT_REGION = "cloudflare";
const MAX_BODY_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5000;

const worker = {
  async fetch(request, env) {
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
      const body = JSON.parse(text);

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

async function fetchWithTiming(targetUrl) {
  const started = performance.now();
  let currentUrl = targetUrl;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const validation = normalizeAndValidatePublicUrl(currentUrl);
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

function normalizeAndValidatePublicUrl(rawUrl) {
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

  const hostname = stripIpv6Brackets(url.hostname);
  if (isBlockedHostname(hostname)) {
    return { ok: false, error: "Localhost URLs are not allowed." };
  }

  if (isIpv4Address(hostname)) {
    return isBlockedIpv4(hostname)
      ? { ok: false, error: "Private or internal IP addresses are not allowed." }
      : { ok: true, url: url.toString() };
  }

  if (isLikelyIpv6Address(hostname)) {
    return isBlockedIpv6(hostname)
      ? { ok: false, error: "Private or internal IP addresses are not allowed." }
      : { ok: true, url: url.toString() };
  }

  return { ok: true, url: url.toString() };
}

async function readLimitedRequestText(request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    throw new Error("Request body too large.");
  }

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks = [];
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

async function drainLimitedBody(response) {
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

function complete(started, statusCode, error) {
  return {
    totalMs: Math.round(performance.now() - started),
    statusCode,
    error,
  };
}

function isRedirect(status) {
  return status >= 300 && status < 400;
}

function isBlockedHostname(hostname) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  );
}

function isIpv4Address(value) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) && value.split(".").every((part) => Number(part) <= 255);
}

function isBlockedIpv4(ip) {
  const [a, b] = ip.split(".").map(Number);
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

function isLikelyIpv6Address(value) {
  return value.includes(":");
}

function isBlockedIpv6(ip) {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function stripIpv6Brackets(hostname) {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

function json(body, status, extraHeaders) {
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
