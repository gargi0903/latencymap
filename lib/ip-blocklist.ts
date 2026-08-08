/**
 * SSRF denylist for addresses probes and the API must not fetch.
 */

import { isBlockedIpv4, isIpv4Literal } from "@/lib/ipv4-blocklist";
import { isBlockedIpv6 } from "@/lib/ipv6-blocklist";

export { BLOCKED_IPV4_CIDRS, isBlockedIpv4, isIpv4Literal } from "@/lib/ipv4-blocklist";

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
