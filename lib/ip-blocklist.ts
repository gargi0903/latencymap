/**
 * SSRF denylist for addresses probes and the API must not fetch.
 */

type ParsedCidr = {
  network: number;
  mask: number;
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

const IPV6_128_BIT_MASK = (1n << 128n) - 1n;
const IPV4_MAPPED_PREFIX = 0xffffn;
const IPV4_COMPATIBLE_PREFIX = 0n;

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
  const address = parseIpv6(ip);
  if (address === null) {
    return true;
  }

  if (address === 0n || address === 1n) {
    return true;
  }

  const first16Bits = Number(address >> 112n);
  if (
    (first16Bits & 0xfe00) === 0xfc00 || // unique-local fc00::/7
    (first16Bits & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (first16Bits & 0xff00) === 0xff00 // multicast ff00::/8
  ) {
    return true;
  }

  // IPv4-compatible and IPv4-mapped IPv6 literals can otherwise hide a blocked IPv4 address.
  const upper96Bits = address >> 32n;
  if (upper96Bits === IPV4_COMPATIBLE_PREFIX || upper96Bits === IPV4_MAPPED_PREFIX) {
    return isBlockedIpv4(ipv4FromLow32Bits(address));
  }

  // Documentation-only range (RFC 3849) is not publicly routable.
  return address >> 96n === 0x20010db8n;
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

function parseIpv6(ip: string): bigint | null {
  let value = ip.trim().toLowerCase();
  if (!value || value.includes("%")) {
    return null;
  }

  if (value.includes(".")) {
    const separator = value.lastIndexOf(":");
    const ipv4 = separator === -1 ? "" : value.slice(separator + 1);
    const ipv4Value = parseIpv4(ipv4);
    if (ipv4Value === null) {
      return null;
    }

    value = `${value.slice(0, separator)}:${((ipv4Value >>> 16) & 0xffff).toString(16)}:${(ipv4Value & 0xffff).toString(16)}`;
  }

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

  const parts =
    doubleColonParts.length === 2
      ? [...left, ...Array(8 - providedParts.length).fill("0"), ...right]
      : providedParts;

  return parts.reduce((address, part) => (address << 16n) | BigInt(`0x${part}`), 0n) & IPV6_128_BIT_MASK;
}

function ipv4FromLow32Bits(address: bigint): string {
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
