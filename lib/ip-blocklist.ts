/**
 * SSRF denylist for addresses probes and the API must not fetch.
 */

type ParsedCidr = {
  network: number;
  mask: number;
};

type Ipv6Rule = {
  label: string;
  match: (ip: string) => boolean;
};

export const BLOCKED_IPV4_CIDRS = [
  "0.0.0.0/8", // current network
  "10.0.0.0/8", // private (RFC 1918)
  "127.0.0.0/8", // loopback
  "100.64.0.0/10", // carrier-grade NAT (RFC 6598)
  "169.254.0.0/16", // link-local, cloud metadata
  "172.16.0.0/12", // private (RFC 1918)
  "192.168.0.0/16", // private (RFC 1918)
  "198.18.0.0/15", // benchmark (RFC 2544)
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved
] as const;

export const BLOCKED_IPV6_RULES: readonly Ipv6Rule[] = [
  { label: "unspecified", match: (ip) => ip === "::" },
  { label: "loopback", match: (ip) => ip === "::1" },
  { label: "unique-local", match: (ip) => ip.startsWith("fc") || ip.startsWith("fd") },
  { label: "link-local", match: (ip) => ip.startsWith("fe80:") },
];

const PARSED_IPV4_CIDRS: ParsedCidr[] = BLOCKED_IPV4_CIDRS.flatMap((cidr) => {
  const parsed = parseCidr(cidr);
  return parsed ? [parsed] : [];
});

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

export function isBlockedIpv4(ip: string): boolean {
  const address = parseIpv4(ip);
  if (address === null) {
    return true;
  }

  return PARSED_IPV4_CIDRS.some((cidr) => (address & cidr.mask) === cidr.network);
}

export function isBlockedIpv6(ip: string): boolean {
  return BLOCKED_IPV6_RULES.some((rule) => rule.match(ip));
}

export function isIpv4Literal(value: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) && value.split(".").every((part) => Number(part) <= 255);
}

function parseIpv4(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }

  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
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
