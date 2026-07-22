/**
 * Cloudflare Worker equivalent of the Node probe credential comparison.
 * Verification is delegated to Web Crypto, avoiding a direct JavaScript
 * comparison of secret values.
 */
export async function matchesProbeSecret(provided: string | null, expected: string): Promise<boolean> {
  const message = new TextEncoder().encode("latencymap-probe-auth-v1");
  const [providedKey, expectedKey] = await Promise.all([
    importHmacKey(provided || "\0"),
    importHmacKey(expected),
  ]);
  const providedSignature = await crypto.subtle.sign("HMAC", providedKey, message);

  return crypto.subtle.verify("HMAC", expectedKey, providedSignature, message);
}

function importHmacKey(value: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(value),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
