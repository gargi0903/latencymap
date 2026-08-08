type ParsedCidr = {
  network: number;
  mask: number;
};

export const BLOCKED_IPV4_CIDRS = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "127.0.0.0/8",
  "100.64.0.0/10",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "224.0.0.0/4",
  "240.0.0.0/4",
] as const;

const PARSED_IPV4_CIDRS: ParsedCidr[] = BLOCKED_IPV4_CIDRS.flatMap((cidr) => {
  const parsed = parseCidr(cidr);
  return parsed ? [parsed] : [];
});

export function isIpv4Literal(value: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) && value.split(".").every((part) => Number(part) <= 255);
}

export function isBlockedIpv4(ip: string): boolean {
  const address = parseIpv4(ip);
  if (address === null) {
    return true;
  }

  return PARSED_IPV4_CIDRS.some((cidr) => (address & cidr.mask) === cidr.network);
}

export function parseIpv4(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }

  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

export function ipv4FromLow32Bits(address: bigint): string {
  const ipv4 = Number(address & 0xffffffffn);
  return `${ipv4 >>> 24}.${(ipv4 >>> 16) & 0xff}.${(ipv4 >>> 8) & 0xff}.${ipv4 & 0xff}`;
}

function parseCidr(cidr: string): ParsedCidr | null {
  const [network, prefixLengthText] = cidr.split("/");
  const prefixLength = Number(prefixLengthText);
  const networkInt = parseIpv4(network);

  if (networkInt === null || Number.isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) {
    return null;
  }

  const mask = prefixLength === 0 ? 0 : ((~0 << (32 - prefixLength)) >>> 0);
  return { network: networkInt & mask, mask };
}
