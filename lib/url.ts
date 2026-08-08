export type HttpUrlPartsResult = { ok: true } | { ok: false; error: string };

export function normalizeHttpUrl(url: URL): URL {
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

export function validateHttpUrlParts(url: URL): HttpUrlPartsResult {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only HTTP and HTTPS URLs are allowed." };
  }

  if (!url.hostname) {
    return { ok: false, error: "URL must include a hostname." };
  }

  if (url.username || url.password) {
    return { ok: false, error: "URLs with embedded credentials are not allowed." };
  }

  return { ok: true };
}

type ParsedCidr = {
  network: number;
  mask: number;
};

export const BLOCKED_IPV4_CIDRS = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "127.0.0.0/8",
  "100.64.0.0/10",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "224.0.0.0/4",
  "240.0.0.0/4",
] as const;

const PARSED_IPV4_CIDRS: ParsedCidr[] = BLOCKED_IPV4_CIDRS.flatMap((cidr) => {
  const parsed = parseCidr(cidr);
  return parsed ? [parsed] : [];
});

export function isIpv4Literal(value: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) && value.split(".").every((part) => Number(part) <= 255);
}

export function isBlockedIpv4(ip: string): boolean {
  const address = parseIpv4(ip);
  if (address === null) {
    return true;
  }

  return PARSED_IPV4_CIDRS.some((cidr) => (address & cidr.mask) === cidr.network);
}

export function parseIpv4(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }

  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

export function ipv4FromLow32Bits(address: bigint): string {
  const ipv4 = Number(address & 0xffffffffn);
  return `${ipv4 >>> 24}.${(ipv4 >>> 16) & 0xff}.${(ipv4 >>> 8) & 0xff}.${ipv4 & 0xff}`;
}

function parseCidr(cidr: string): ParsedCidr | null {
  const [network, prefixLengthText] = cidr.split("/");
  const prefixLength = Number(prefixLengthText);
  const networkInt = parseIpv4(network);

  if (networkInt === null || Number.isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) {
    return null;
  }

  const mask = prefixLength === 0 ? 0 : ((~0 << (32 - prefixLength)) >>> 0);
  return { network: networkInt & mask, mask };
}

const IPV6_128_BIT_MASK = (1n << 128n) - 1n;
const IPV4_MAPPED_PREFIX = 0xffffn;
const IPV4_COMPATIBLE_PREFIX = 0n;

export function isBlockedIpv6(ip: string): boolean {
  const address = parseIpv6(ip);
  if (address === null) {
    return true;
  }

  if (address === 0n || address === 1n) {
    return true;
  }

  const first16Bits = Number(address >> 112n);
  if (
    (first16Bits & 0xfe00) === 0xfc00 ||
    (first16Bits & 0xffc0) === 0xfe80 ||
    (first16Bits & 0xff00) === 0xff00
  ) {
    return true;
  }

  const upper96Bits = address >> 32n;
  if (upper96Bits === IPV4_COMPATIBLE_PREFIX || upper96Bits === IPV4_MAPPED_PREFIX) {
    return isBlockedIpv4(ipv4FromLow32Bits(address));
  }

  return address >> 96n === 0x20010db8n;
}

function parseIpv6(ip: string): bigint | null {
  let value = ip.trim().toLowerCase();
  if (!value || value.includes("%")) {
    return null;
  }

  const withEmbeddedIpv4 = expandEmbeddedIpv4(value);
  if (withEmbeddedIpv4 === null) {
    return null;
  }
  value = withEmbeddedIpv4;

  const hextets = expandIpv6Hextets(value);
  if (hextets === null) {
    return null;
  }

  return hextets.reduce((address, part) => (address << 16n) | BigInt(`0x${part}`), 0n) & IPV6_128_BIT_MASK;
}

function expandEmbeddedIpv4(value: string): string | null {
  if (!value.includes(".")) {
    return value;
  }

  const separator = value.lastIndexOf(":");
  const ipv4 = separator === -1 ? "" : value.slice(separator + 1);
  const ipv4Value = parseIpv4(ipv4);
  if (ipv4Value === null) {
    return null;
  }

  return `${value.slice(0, separator)}:${((ipv4Value >>> 16) & 0xffff).toString(16)}:${(ipv4Value & 0xffff).toString(16)}`;
}

function expandIpv6Hextets(value: string): string[] | null {
  const doubleColonParts = value.split("::");
  if (doubleColonParts.length > 2) {
    return null;
  }

  const left = doubleColonParts[0] ? doubleColonParts[0].split(":") : [];
  const right = doubleColonParts.length === 2 && doubleColonParts[1] ? doubleColonParts[1].split(":") : [];
  const providedParts = [...left, ...right];
  if (
    providedParts.some((part) => !/^[\da-f]{1,4}$/.test(part)) ||
    providedParts.length > 8 ||
    (doubleColonParts.length === 1 && providedParts.length !== 8)
  ) {
    return null;
  }

  return doubleColonParts.length === 2
    ? [...left, ...Array(8 - providedParts.length).fill("0"), ...right]
    : providedParts;
}

export function isBlockedIp(ip: string): boolean {
  const value = ip.trim().toLowerCase();

  if (isIpv4Literal(value)) {
    return isBlockedIpv4(value);
  }

  if (value.includes(":")) {
    return isBlockedIpv6(value);
  }

  return true;
}

export type DnsResolveResult = { ok: true; addresses: string[] } | { ok: false; error: string };

export type DnsResolver = (hostname: string) => Promise<DnsResolveResult>;

const DEFAULT_DNS_CACHE_TTL_MS = 60_000;
const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";

type DnsCacheEntry = {
  addresses: string[];
  expiresAt: number;
};

const dnsCache = new Map<string, DnsCacheEntry>();

export function clearDnsCacheForTests() {
  dnsCache.clear();
}

export function withDnsCache(resolver: DnsResolver, ttlMs = DEFAULT_DNS_CACHE_TTL_MS): DnsResolver {
  return async (hostname) => {
    const cached = dnsCache.get(hostname);
    if (cached && cached.expiresAt > Date.now()) {
      return { ok: true, addresses: cached.addresses };
    }

    const result = await resolver(hostname);
    if (result.ok) {
      dnsCache.set(hostname, {
        addresses: result.addresses,
        expiresAt: Date.now() + ttlMs,
      });
    }

    return result;
  };
}

type DohResponse = {
  Status: number;
  Answer?: Array<{ type: number; data: string }>;
};

export function createDohDnsResolver(fetchImpl: typeof fetch = fetch): DnsResolver {
  const boundFetch = fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  return async (hostname) => {
    try {
      const [ipv4, ipv6] = await Promise.all([
        queryDohRecords(hostname, 1, boundFetch),
        queryDohRecords(hostname, 28, boundFetch),
      ]);
      const addresses = [...ipv4, ...ipv6];

      if (addresses.length === 0) {
        return { ok: false, error: "Hostname did not resolve." };
      }

      return { ok: true, addresses };
    } catch {
      return { ok: false, error: "Hostname did not resolve." };
    }
  };
}

async function queryDohRecords(hostname: string, type: number, fetchImpl: typeof fetch) {
  const url = new URL(DOH_ENDPOINT);
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", String(type));

  const response = await fetchImpl(url, {
    headers: { accept: "application/dns-json" },
  });

  if (!response.ok) {
    throw new Error("DNS query failed.");
  }

  const payload = (await response.json()) as DohResponse;
  if (payload.Status !== 0 || !payload.Answer?.length) {
    return [];
  }

  const addresses: string[] = [];
  for (const record of payload.Answer) {
    if (record.type === type) {
      addresses.push(record.data);
    }
  }
  return addresses;
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "ip6-localhost", "ip6-loopback"]);

export type UrlValidationResult = { ok: true; url: string } | { ok: false; error: string };

export type ParsedPublicUrlResult = { ok: true; url: URL } | { ok: false; error: string };

export function stripIpv6Brackets(hostname: string) {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

function isBlockedHostname(hostname: string) {
  return (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  );
}

function isLikelyIpv6Address(value: string) {
  return value.includes(":");
}

export function parsePublicHttpUrl(rawUrl: string): ParsedPublicUrlResult {
  let url: URL;
  try {
    url = new URL(String(rawUrl).trim());
  } catch {
    return { ok: false, error: "Enter a valid absolute URL." };
  }

  const parts = validateHttpUrlParts(url);
  if (!parts.ok) {
    return parts;
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
