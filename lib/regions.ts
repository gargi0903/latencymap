import { PROBE_CLIENT_TIMEOUT_MS } from "@/lib/measure";
import type { ProbeConfig, ProbeResult } from "@/lib/types";

const PROBE_REGIONS = [
  { id: "iad", label: "US East (Ashburn)", country: "United States" },
  { id: "lhr", label: "Europe West (London)", country: "United Kingdom" },
  { id: "sin", label: "Asia Southeast (Singapore)", country: "Singapore" },
  { id: "syd", label: "Australia East (Sydney)", country: "Australia" },
  { id: "gru", label: "South America (Sao Paulo)", country: "Brazil" },
] as const;

export const PROBE_REGION_IDS = PROBE_REGIONS.map((region) => region.id);

export const PROBE_COUNTRY_LIST = PROBE_REGIONS.map((region) => region.country).join(" · ");

export function probeCountryName(regionId: string) {
  return PROBE_REGIONS.find((entry) => entry.id === regionId)?.country ?? regionId;
}

function getProbeEndpoint(regionId: string): string {
  const subdomain = process.env.PROBE_WORKERS_SUBDOMAIN?.trim();
  if (!subdomain) {
    return "";
  }

  return `https://latencymap-probe-${regionId}.${subdomain}/probe`;
}

export function getProbeRegions(): ProbeConfig[] {
  return PROBE_REGIONS.map((region) => ({
    id: region.id,
    label: region.label,
    endpoint: getProbeEndpoint(region.id),
  }));
}

type ProbeWireResponse = {
  total_ms?: number;
  status_code?: number;
  cloudflare_colo?: string | null;
  placement_region?: string | null;
  error?: string | null;
};

export function buildProbeResult(
  probe: ProbeConfig,
  testedAt: string,
  overrides: Partial<ProbeResult> = {},
): ProbeResult {
  return {
    region: probe.id,
    label: probe.label,
    totalMs: null,
    statusCode: null,
    error: null,
    testedAt,
    cloudflareColo: null,
    placementRegion: null,
    ...overrides,
  };
}

export function mapProbeWireResponse(probe: ProbeConfig, testedAt: string, body: unknown): ProbeResult {
  const wire = (body ?? null) as ProbeWireResponse | null;
  const totalMs = coerceNumber(wire?.total_ms);

  return buildProbeResult(probe, testedAt, {
    totalMs,
    statusCode: coerceNumber(wire?.status_code),
    error: wire?.error ?? null,
    cloudflareColo: coerceString(wire?.cloudflare_colo),
    placementRegion: coerceString(wire?.placement_region),
  });
}

function coerceNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function coerceString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function formatProbeFetchError(error: unknown, probe: ProbeConfig): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "Probe timed out.";
  }

  if (isConnectionRefusedError(error)) {
    return `Probe unreachable at ${probe.endpoint}. Check regional Worker deployment and PROBE_WORKERS_SUBDOMAIN.`;
  }

  return "Probe failed.";
}

function isConnectionRefusedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : "cause" in error ? getErrorCode(error.cause) : null;
  return code === "ECONNREFUSED" || code === "ENOTFOUND";
}

function getErrorCode(value: unknown): unknown {
  return value && typeof value === "object" && "code" in value ? value.code : null;
}

export class ProbeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProbeConfigurationError";
  }
}

export async function runRegionalTest(url: string): Promise<ProbeResult[]> {
  const probes = getProbeRegions();
  const probeSecret = getProbeSecret();

  if (probes.some((probe) => !probe.endpoint?.trim())) {
    throw new ProbeConfigurationError(
      "PROBE_WORKERS_SUBDOMAIN is required. Deploy regional Cloudflare Workers and set the env var.",
    );
  }

  return Promise.all(probes.map((probe) => callRemoteProbe(probe, url, probeSecret)));
}

export function getProbeSecret(): string {
  const secret = process.env.PROBE_SECRET?.trim();
  if (!secret) {
    throw new ProbeConfigurationError(
      "No probe credential configured. Set PROBE_SECRET to the same non-empty secret deployed to every Worker.",
    );
  }

  return secret;
}

async function callRemoteProbe(probe: ProbeConfig, url: string, probeSecret: string): Promise<ProbeResult> {
  const testedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_CLIENT_TIMEOUT_MS);

  if (!probe.endpoint) {
    return buildProbeResult(probe, testedAt, {
      error: "Probe endpoint is not configured.",
    });
  }

  try {
    const response = await fetch(probe.endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-probe-secret": probeSecret,
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as { error?: string | null } | null;
      return buildProbeResult(probe, testedAt, {
        statusCode: response.status,
        error: errorBody?.error ?? `Probe returned HTTP ${response.status}.`,
      });
    }

    const body = await response.json().catch(() => null);
    return mapProbeWireResponse(probe, testedAt, body);
  } catch (error) {
    return buildProbeResult(probe, testedAt, {
      error: formatProbeFetchError(error, probe),
    });
  } finally {
    clearTimeout(timeout);
  }
}
