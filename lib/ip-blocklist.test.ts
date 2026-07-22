import { describe, expect, it } from "vitest";
import { BLOCKED_IPV4_CIDRS, isBlockedIp, isBlockedIpv4 } from "./ip-blocklist";

describe("ip-blocklist", () => {
  it("documents every blocked IPv4 range as CIDR notation", () => {
    expect(BLOCKED_IPV4_CIDRS).toContain("10.0.0.0/8");
    expect(BLOCKED_IPV4_CIDRS).toContain("169.254.0.0/16");
    expect(BLOCKED_IPV4_CIDRS.length).toBeGreaterThan(0);
  });

  it("blocks loopback, private, metadata, and reserved IPv4", () => {
    expect(isBlockedIpv4("127.0.0.1")).toBe(true);
    expect(isBlockedIpv4("10.0.0.1")).toBe(true);
    expect(isBlockedIpv4("172.16.0.1")).toBe(true);
    expect(isBlockedIpv4("192.168.1.1")).toBe(true);
    expect(isBlockedIpv4("169.254.169.254")).toBe(true);
    expect(isBlockedIpv4("239.255.255.255")).toBe(true);
  });

  it("allows public IPv4", () => {
    expect(isBlockedIpv4("93.184.216.34")).toBe(false);
    expect(isBlockedIpv4("8.8.8.8")).toBe(false);
  });

  it("blocks private IPv6 ranges", () => {
    expect(isBlockedIp("::1")).toBe(true);
    expect(isBlockedIp("fc00::1")).toBe(true);
    expect(isBlockedIp("fe80::1")).toBe(true);
  });

  it("treats malformed addresses as blocked", () => {
    expect(isBlockedIp("not-an-ip")).toBe(true);
    expect(isBlockedIpv4("999.999.999.999")).toBe(true);
  });
});
