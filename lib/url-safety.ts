import dns from "node:dns/promises";
import type { DnsResolver, UrlValidationResult } from "@/lib/url";
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

const resolvePublicHostname = withDnsCache(createNodeDnsResolver());

export async function normalizeAndValidatePublicUrl(rawUrl: string): Promise<UrlValidationResult> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a valid URL." };
  }

  const candidate = hasUrlScheme(trimmed) ? trimmed : `https://${trimmed}`;
  const result = await validatePublicUrlWithDns(candidate, resolvePublicHostname);
  if (!result.ok && result.error === "Enter a valid absolute URL.") {
    return { ok: false, error: "Enter a valid URL." };
  }
  return result;
}

function hasUrlScheme(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}
