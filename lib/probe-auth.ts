import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compares shared probe credentials without leaking which byte differs.
 * This is for the Next.js caller. Cloudflare Workers use their Web Crypto
 * equivalent because Worker bundles cannot import node:crypto.
 */
export function matchesProbeSecret(provided: string | null, expected: string): boolean {
  const providedHash = sha256(provided ?? "");
  const expectedHash = sha256(expected);

  return timingSafeEqual(providedHash, expectedHash);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest();
}
