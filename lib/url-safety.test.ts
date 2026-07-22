import { describe, expect, it, vi, beforeEach } from "vitest";
import dns from "node:dns/promises";
import { isBlockedIp, normalizeAndValidatePublicUrl } from "@/lib/url-safety";

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn(),
  },
}));

const publicIpv4 = [{ address: "93.184.216.34", family: 4 }];

describe("isBlockedIp", () => {
  it("blocks loopback and private IPv4 ranges", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("10.0.0.1")).toBe(true);
    expect(isBlockedIp("172.16.0.1")).toBe(true);
    expect(isBlockedIp("192.168.1.1")).toBe(true);
    expect(isBlockedIp("169.254.169.254")).toBe(true);
  });

  it("allows public IPv4", () => {
    expect(isBlockedIp("93.184.216.34")).toBe(false);
    expect(isBlockedIp("8.8.8.8")).toBe(false);
  });

  it("blocks private IPv6 ranges", () => {
    expect(isBlockedIp("::1")).toBe(true);
    expect(isBlockedIp("fc00::1")).toBe(true);
    expect(isBlockedIp("fe80::1")).toBe(true);
  });
});

describe("normalizeAndValidatePublicUrl", () => {
  beforeEach(() => {
    vi.mocked(dns.lookup).mockResolvedValue(publicIpv4);
  });

  it("rejects unsupported schemes and credentials", async () => {
    await expect(normalizeAndValidatePublicUrl("ftp://example.com")).resolves.toEqual({
      ok: false,
      error: "Only HTTP and HTTPS URLs are allowed.",
    });
    await expect(normalizeAndValidatePublicUrl("https://user:pass@example.com")).resolves.toEqual({
      ok: false,
      error: "URLs with embedded credentials are not allowed.",
    });
  });

  it("rejects localhost hostnames", async () => {
    await expect(normalizeAndValidatePublicUrl("http://localhost/health")).resolves.toEqual({
      ok: false,
      error: "Localhost URLs are not allowed.",
    });
  });

  it("rejects direct private IPs", async () => {
    await expect(normalizeAndValidatePublicUrl("http://127.0.0.1")).resolves.toEqual({
      ok: false,
      error: "Private or internal IP addresses are not allowed.",
    });
  });

  it("rejects hostnames that resolve to private IPs", async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);

    await expect(normalizeAndValidatePublicUrl("https://internal.example")).resolves.toEqual({
      ok: false,
      error: "This hostname resolves to a private or internal IP address.",
    });
  });

  it("normalizes scheme, host, default ports, fragments, and root slash", async () => {
    const result = await normalizeAndValidatePublicUrl("HTTPS://Example.COM:443/#frag");

    expect(result).toEqual({
      ok: true,
      url: "https://example.com/",
      hostname: "example.com",
    });
  });

  it("preserves non-root paths and query strings", async () => {
    const result = await normalizeAndValidatePublicUrl("example.com/users?limit=10");

    expect(result).toEqual({
      ok: true,
      url: "https://example.com/users?limit=10",
      hostname: "example.com",
    });
  });
});
