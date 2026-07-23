import dns from "node:dns/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDnsCacheForTests,
  createDohDnsResolver,
  withDnsCache,
} from "@/lib/dns-resolve";
import { createNodeDnsResolver } from "@/lib/dns-resolve-node";

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn(),
  },
}));

describe("createNodeDnsResolver", () => {
  beforeEach(() => {
    clearDnsCacheForTests();
    vi.mocked(dns.lookup).mockReset();
  });

  it("returns resolved addresses", async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

    await expect(createNodeDnsResolver()("example.com")).resolves.toEqual({
      ok: true,
      addresses: ["93.184.216.34"],
    });
  });

  it("fails when lookup throws", async () => {
    vi.mocked(dns.lookup).mockRejectedValue(new Error("ENOTFOUND"));

    await expect(createNodeDnsResolver()("missing.example")).resolves.toEqual({
      ok: false,
      error: "Hostname did not resolve.",
    });
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
    vi.mocked(dns.lookup).mockReset();
    vi.mocked(dns.lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it("caches successful lookups", async () => {
    const resolver = withDnsCache(createNodeDnsResolver());

    await resolver("example.com");
    await resolver("example.com");

    expect(vi.mocked(dns.lookup)).toHaveBeenCalledTimes(1);
  });

  it("does not cache failed lookups", async () => {
    vi.mocked(dns.lookup).mockRejectedValueOnce(new Error("ENOTFOUND"));
    const resolver = withDnsCache(createNodeDnsResolver());

    await resolver("missing.example");
    await resolver("missing.example");

    expect(vi.mocked(dns.lookup)).toHaveBeenCalledTimes(2);
  });
});
