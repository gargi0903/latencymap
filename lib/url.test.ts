import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DnsResolver } from "@/lib/url";
import {
  BLOCKED_IPV4_CIDRS,
  clearDnsCacheForTests,
  createDohDnsResolver,
  isBlockedIp,
  isBlockedIpv4,
  validateHostnameOnly,
  validatePublicUrlWithDns,
  withDnsCache,
} from "@/lib/url";

describe("url ip blocklist", () => {
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
    expect(isBlockedIp("febf::1")).toBe(true);
    expect(isBlockedIp("ff02::1")).toBe(true);
  });

  it("blocks IPv4-compatible and IPv4-mapped private addresses", () => {
    expect(isBlockedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedIp("::ffff:7f00:1")).toBe(true);
    expect(isBlockedIp("0:0:0:0:0:ffff:0a00:1")).toBe(true);
    expect(isBlockedIp("::127.0.0.1")).toBe(true);
  });

  it("allows an IPv4-mapped public address", () => {
    expect(isBlockedIp("::ffff:93.184.216.34")).toBe(false);
  });

  it("treats malformed addresses as blocked", () => {
    expect(isBlockedIp("not-an-ip")).toBe(true);
    expect(isBlockedIpv4("999.999.999.999")).toBe(true);
    expect(isBlockedIp("2001:::1")).toBe(true);
  });
});

describe("createDohDnsResolver", () => {
  beforeEach(() => {
    clearDnsCacheForTests();
  });

  it("queries A and AAAA records via Cloudflare DoH", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = new URL(input);
      const type = url.searchParams.get("type");

      if (type === "1") {
        return new Response(
          JSON.stringify({
            Status: 0,
            Answer: [{ type: 1, data: "93.184.216.34" }],
          }),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify({
          Status: 0,
          Answer: [{ type: 28, data: "2606:2800:220:1:248:1893:25c8:1946" }],
        }),
        { status: 200 },
      );
    });

    await expect(createDohDnsResolver(fetchImpl)("example.com")).resolves.toEqual({
      ok: true,
      addresses: ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"],
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[0]).toMatchObject({
      href: "https://cloudflare-dns.com/dns-query?name=example.com&type=1",
    });
  });

  it("fails when no records are returned", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ Status: 3 }), { status: 200 }));

    await expect(createDohDnsResolver(fetchImpl)("missing.example")).resolves.toEqual({
      ok: false,
      error: "Hostname did not resolve.",
    });
  });
});

describe("withDnsCache", () => {
  beforeEach(() => {
    clearDnsCacheForTests();
  });

  it("caches successful lookups", async () => {
    const lookup = vi.fn<DnsResolver>(async () => ({ ok: true, addresses: ["93.184.216.34"] }));
    const resolver = withDnsCache(lookup);

    await resolver("example.com");
    await resolver("example.com");

    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("does not cache failed lookups", async () => {
    const lookup = vi.fn<DnsResolver>(async () => ({ ok: false, error: "Hostname did not resolve." }));
    const resolver = withDnsCache(lookup);

    await resolver("missing.example");
    await resolver("missing.example");

    expect(lookup).toHaveBeenCalledTimes(2);
  });
});

const publicResolver = vi.fn<DnsResolver>(async () => ({
  ok: true,
  addresses: ["93.184.216.34"],
}));

describe("validateHostnameOnly", () => {
  it("rejects blocked hostnames without DNS", () => {
    expect(validateHostnameOnly("https://localhost/health")).toEqual({
      ok: false,
      error: "Localhost URLs are not allowed.",
    });
  });

  it("allows public hostnames without DNS", () => {
    expect(validateHostnameOnly("https://example.com")).toEqual({
      ok: true,
      url: "https://example.com/",
    });
  });
});

describe("validatePublicUrlWithDns", () => {
  beforeEach(() => {
    vi.mocked(publicResolver).mockClear();
    vi.mocked(publicResolver).mockResolvedValue({
      ok: true,
      addresses: ["93.184.216.34"],
    });
  });

  it("rejects hostnames that resolve to private IPs", async () => {
    vi.mocked(publicResolver).mockResolvedValue({
      ok: true,
      addresses: ["10.0.0.5"],
    });

    await expect(validatePublicUrlWithDns("https://internal.example", publicResolver)).resolves.toEqual({
      ok: false,
      error: "This hostname resolves to a private or internal IP address.",
    });
  });

  it("rejects unresolved hostnames", async () => {
    vi.mocked(publicResolver).mockResolvedValue({
      ok: false,
      error: "Hostname did not resolve.",
    });

    await expect(validatePublicUrlWithDns("https://missing.example", publicResolver)).resolves.toEqual({
      ok: false,
      error: "Hostname did not resolve.",
    });
  });

  it("skips DNS for direct IP literals", async () => {
    await expect(validatePublicUrlWithDns("https://93.184.216.34", publicResolver)).resolves.toEqual({
      ok: true,
      url: "https://93.184.216.34/",
    });

    expect(publicResolver).not.toHaveBeenCalled();
  });

  it("allows hostnames that resolve to public IPs", async () => {
    await expect(validatePublicUrlWithDns("https://example.com", publicResolver)).resolves.toEqual({
      ok: true,
      url: "https://example.com/",
    });

    expect(publicResolver).toHaveBeenCalledWith("example.com");
  });
});
