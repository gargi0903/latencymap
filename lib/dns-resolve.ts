export type DnsResolveResult = { ok: true; addresses: string[] } | { ok: false; error: string };

export type DnsResolver = (hostname: string) => Promise<DnsResolveResult>;

const DEFAULT_DNS_CACHE_TTL_MS = 60_000;
const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";

type DnsCacheEntry = {
  addresses: string[];
  expiresAt: number;
};

const dnsCache = new Map<string, DnsCacheEntry>();

export function clearDnsCacheForTests() {
  dnsCache.clear();
}

export function withDnsCache(resolver: DnsResolver, ttlMs = DEFAULT_DNS_CACHE_TTL_MS): DnsResolver {
  return async (hostname) => {
    const cached = dnsCache.get(hostname);
    if (cached && cached.expiresAt > Date.now()) {
      return { ok: true, addresses: cached.addresses };
    }

    const result = await resolver(hostname);
    if (result.ok) {
      dnsCache.set(hostname, {
        addresses: result.addresses,
        expiresAt: Date.now() + ttlMs,
      });
    }

    return result;
  };
}

type DohResponse = {
  Status: number;
  Answer?: Array<{ type: number; data: string }>;
};

export function createDohDnsResolver(fetchImpl: typeof fetch = fetch): DnsResolver {
  const boundFetch = fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  return async (hostname) => {
    try {
      const [ipv4, ipv6] = await Promise.all([
        queryDohRecords(hostname, 1, boundFetch),
        queryDohRecords(hostname, 28, boundFetch),
      ]);
      const addresses = [...ipv4, ...ipv6];

      if (addresses.length === 0) {
        return { ok: false, error: "Hostname did not resolve." };
      }

      return { ok: true, addresses };
    } catch {
      return { ok: false, error: "Hostname did not resolve." };
    }
  };
}

async function queryDohRecords(hostname: string, type: number, fetchImpl: typeof fetch) {
  const url = new URL(DOH_ENDPOINT);
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", String(type));

  const response = await fetchImpl(url, {
    headers: { accept: "application/dns-json" },
  });

  if (!response.ok) {
    throw new Error("DNS query failed.");
  }

  const payload = (await response.json()) as DohResponse;
  if (payload.Status !== 0 || !payload.Answer?.length) {
    return [];
  }

  const addresses: string[] = [];
  for (const record of payload.Answer) {
    if (record.type === type) {
      addresses.push(record.data);
    }
  }
  return addresses;
}
