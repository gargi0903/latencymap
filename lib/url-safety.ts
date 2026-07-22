import dns from "node:dns/promises";
import net from "node:net";

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
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".localhost")) {
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

export function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    return isBlockedIpv4(ip);
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

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true;
  }

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
