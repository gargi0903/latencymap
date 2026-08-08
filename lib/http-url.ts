export type HttpUrlPartsResult = { ok: true } | { ok: false; error: string };

/** Normalize scheme/host casing, strip default ports, root slash, and fragments. */
export function normalizeHttpUrl(url: URL): URL {
  url.hash = "";
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }

  if (url.pathname === "/") {
    url.pathname = "";
  }

  return url;
}

/** Shared protocol, hostname, and credentials checks for public HTTP(S) URLs. */
export function validateHttpUrlParts(url: URL): HttpUrlPartsResult {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only HTTP and HTTPS URLs are allowed." };
  }

  if (!url.hostname) {
    return { ok: false, error: "URL must include a hostname." };
  }

  if (url.username || url.password) {
    return { ok: false, error: "URLs with embedded credentials are not allowed." };
  }

  return { ok: true };
}
