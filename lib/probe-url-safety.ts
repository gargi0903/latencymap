import type { DnsResolver } from "@/lib/dns-resolve";
import { isBlockedIp, isIpv4Literal } from "@/lib/ip-blocklist";

const BLOCKED_HOSTNAMES = new Set(["localhost", "ip6-localhost", "ip6-loopback"]);

export type UrlValidationResult = { ok: true; url: string } | { ok: false; error: string };

export type ParsedPublicUrlResult = { ok: true; url: URL } | { ok: false; error: string };

export function stripIpv6Brackets(hostname: string) {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

export function isBlockedHostname(hostname: string) {
  return (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  );
}

export function isLikelyIpv6Address(value: string) {
  return value.includes(":");
}

export function normalizeHttpUrl(url: URL) {
  url.hash = "";
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }

  if (url.pathname === "/") {
    url.pathname = "";
  }

  return url;
}

export function parsePublicHttpUrl(rawUrl: string): ParsedPublicUrlResult {
  let url: URL;
  try {
    url = new URL(String(rawUrl).trim());
  } catch {
    return { ok: false, error: "Enter a valid absolute URL." };
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

  normalizeHttpUrl(url);
  return { ok: true, url };
}

export function validateHostnameOnly(rawUrl: string): UrlValidationResult {
  const parsed = parsePublicHttpUrl(rawUrl);
  if (!parsed.ok) {
    return parsed;
  }

  const hostname = stripIpv6Brackets(parsed.url.hostname);
  if (isBlockedHostname(hostname)) {
    return { ok: false, error: "Localhost URLs are not allowed." };
  }

  if (isIpv4Literal(hostname) || isLikelyIpv6Address(hostname)) {
    return isBlockedIp(hostname)
      ? { ok: false, error: "Private or internal IP addresses are not allowed." }
      : { ok: true, url: parsed.url.toString() };
  }

  return { ok: true, url: parsed.url.toString() };
}

export async function validatePublicUrlWithDns(
  rawUrl: string,
  resolveAddresses: DnsResolver,
): Promise<UrlValidationResult> {
  const hostnameResult = validateHostnameOnly(rawUrl);
  if (!hostnameResult.ok) {
    return hostnameResult;
  }

  const parsed = parsePublicHttpUrl(rawUrl);
  if (!parsed.ok) {
    return parsed;
  }

  const hostname = stripIpv6Brackets(parsed.url.hostname);
  if (isIpv4Literal(hostname) || isLikelyIpv6Address(hostname)) {
    return hostnameResult;
  }

  const resolved = await resolveAddresses(hostname);
  if (!resolved.ok) {
    return resolved;
  }

  if (resolved.addresses.some(isBlockedIp)) {
    return { ok: false, error: "This hostname resolves to a private or internal IP address." };
  }

  return { ok: true, url: parsed.url.toString() };
}
