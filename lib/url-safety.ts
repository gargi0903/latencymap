import dns from "node:dns/promises";
import net from "node:net";
import { isBlockedIp } from "./ip-blocklist";

export { isBlockedIp } from "./ip-blocklist";

const BLOCKED_HOSTS = new Set(["localhost", "ip6-localhost", "ip6-loopback"]);

type ValidationResult =
  | { ok: true; url: string; hostname: string }
  | { ok: false; error: string };

type ParsedUrlResult = { ok: true; url: URL } | { ok: false; error: string };

export async function normalizeAndValidatePublicUrl(rawUrl: string): Promise<ValidationResult> {
  const parsed = parseHttpUrl(rawUrl);
  if (!parsed.ok) {
    return parsed;
  }

  const url = parsed.url;
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
  if (
    BLOCKED_HOSTS.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return { ok: false, error: "Localhost URLs are not allowed." };
  }

  const directIp = net.isIP(hostname) ? hostname : null;
  if (directIp && isBlockedIp(directIp)) {
    return { ok: false, error: "Private or internal IP addresses are not allowed." };
  }

  if (!directIp) {
    const resolved = await resolveHostname(hostname);
    if (!resolved.ok) {
      return resolved;
    }

    if (resolved.addresses.some(isBlockedIp)) {
      return { ok: false, error: "This hostname resolves to a private or internal IP address." };
    }
  }

  return {
    ok: true,
    url: url.toString(),
    hostname,
  };
}

function parseHttpUrl(rawUrl: string): ParsedUrlResult {
  let url: URL;
  try {
    url = new URL(withDefaultHttpsScheme(rawUrl));
  } catch {
    return { ok: false, error: "Enter a valid URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only HTTP and HTTPS URLs are allowed." };
  }

  if (!url.hostname) {
    return { ok: false, error: "URL must include a hostname." };
  }

  if (url.username || url.password) {
    return { ok: false, error: "URLs with embedded credentials are not allowed." };
  }

  return { ok: true, url };
}

function withDefaultHttpsScheme(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  return hasUrlScheme(trimmed) ? trimmed : `https://${trimmed}`;
}

function hasUrlScheme(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}

async function resolveHostname(hostname: string) {
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) {
      return { ok: false as const, error: "Hostname did not resolve." };
    }

    return { ok: true as const, addresses: records.map((record) => record.address) };
  } catch {
    return { ok: false as const, error: "Hostname did not resolve." };
  }
}

