import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DnsResolver } from "@/lib/dns-resolve";
import { validateHostnameOnly, validatePublicUrlWithDns } from "@/lib/probe-url-safety";

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
