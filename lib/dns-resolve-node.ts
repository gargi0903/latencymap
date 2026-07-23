import dns from "node:dns/promises";
import type { DnsResolver } from "@/lib/dns-resolve";

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
