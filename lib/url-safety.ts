import { createNodeDnsResolver } from "@/lib/dns-resolve-node";
import { withDnsCache } from "@/lib/dns-resolve";
import { validatePublicUrlWithDns } from "@/lib/probe-url-safety";

type ValidationResult = { ok: true; url: string } | { ok: false; error: string };

/** Default bare hosts to https://, then run the shared public-URL + DNS checks. */
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
