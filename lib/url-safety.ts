import dns from "node:dns/promises";
import net from "node:net";
import { normalizeHttpUrl, validateHttpUrlParts } from "./http-url";
import { isBlockedIp } from "./ip-blocklist";

export { isBlockedIp } from "./ip-blocklist";

const BLOCKED_HOSTS = new Set(["localhost", "ip6-localhost", "ip6-loopback"]);
const DNS_CACHE_TTL_MS = 60_000;

type DnsCacheEntry = {
  addresses: string[];
  expiresAt: number;
};

const dnsCache = new Map<string, DnsCacheEntry>();

export function clearDnsCacheForTests() {
  dnsCache.clear();
}

type ValidationResult =
  | { ok: true; url: string; hostname: string }
  | { ok: false; error: string };

type ParsedUrlResult = { ok: true; url: URL } | { ok: false; error: string };

export async function normalizeAndValidatePublicUrl(rawUrl: string): Promise<ValidationResult> {
  const parsed = parseHttpUrl(rawUrl);
  if (!parsed.ok) {
    return parsed;
  }

  const url = normalizeHttpUrl(parsed.url);

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

  const parts = validateHttpUrlParts(url);
  if (!parts.ok) {
    return parts;
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
  const cached = dnsCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true as const, addresses: cached.addresses };
  }

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) {
      return { ok: false as const, error: "Hostname did not resolve." };
    }

    const addresses = records.map((record) => record.address);
    dnsCache.set(hostname, {
      addresses,
      expiresAt: Date.now() + DNS_CACHE_TTL_MS,
    });

    return { ok: true as const, addresses };
  } catch {
    return { ok: false as const, error: "Hostname did not resolve." };
  }
}

