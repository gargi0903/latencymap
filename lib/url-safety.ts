import dns from "node:dns/promises";
import type { DnsResolver } from "@/lib/url";
import { validatePublicUrlWithDns, withDnsCache } from "@/lib/url";

export function createNodeDnsResolver(): DnsResolver {
  return async (hostname) => {
    try {
      const records = await dns.lookup(hostname, { all: true, verbatim: true });
      if (records.length === 0) {
        return { ok: false, error: "Hostname did not resolve." };
      }

      return { ok: true, addresses: records.map((record) => record.address) };
    } catch {
      return { ok: false, error: "Hostname did not resolve." };
    }
  };
}

type ValidationResult = { ok: true; url: string } | { ok: false, error: string };

export async function normalizeAndValidatePublicUrl(rawUrl: string): Promise<ValidationResult> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a valid URL." };
  }

  const candidate = hasUrlScheme(trimmed) ? trimmed : `https://${trimmed}`;
  const result = await validatePublicUrlWithDns(candidate, withDnsCache(createNodeDnsResolver()));
  if (!result.ok && result.error === "Enter a valid absolute URL.") {
    return { ok: false, error: "Enter a valid URL." };
  }
  return result;
}

function hasUrlScheme(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}
