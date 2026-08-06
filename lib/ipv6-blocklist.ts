/**
 * IPv6 parsing and blocked unique-local / link-local / mapped ranges.
 */

import { ipv4FromLow32Bits, isBlockedIpv4, parseIpv4 } from "@/lib/ipv4-blocklist";

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
