import { PROBE_CLIENT_TIMEOUT_MS } from "@/lib/constants";
import { getLocalProbeEndpoint, getProbeRegions, isProductionProbeMode } from "@/lib/probe-regions";
import type { ProbeConfig, ProbeResult } from "@/lib/types";

export class ProbeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProbeConfigurationError";
  }
}

export async function runRegionalTest(url: string): Promise<ProbeResult[]> {
  const probes = getProbeRegions();
  const probeSecret = getProbeSecret();

  if (isProductionProbeMode() && probes.some((probe) => !probe.endpoint?.trim())) {
    throw new ProbeConfigurationError(
      "PROBE_WORKERS_SUBDOMAIN is required in production. Deploy regional probe Workers and set the env var in Vercel.",
    );
  }

  return Promise.all(probes.map((probe) => callRemoteProbe(probe, url, probeSecret)));
}

export function getProbeSecret(): string {
  const secret = process.env.PROBE_SECRET?.trim();
  if (!secret) {
    throw new ProbeConfigurationError(
      "No probe credential configured. Set PROBE_SECRET to the same non-empty secret deployed to every probe.",
    );
  }

  return secret;
}

async function callRemoteProbe(probe: ProbeConfig, url: string, probeSecret: string): Promise<ProbeResult> {
  const testedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_CLIENT_TIMEOUT_MS);

  if (!probe.endpoint) {
    return {
      region: probe.id,
      label: probe.label,
      lat: probe.lat,
      lng: probe.lng,
      totalMs: null,
      ttfbMs: null,
      statusCode: null,
      error: "Probe endpoint is not configured.",
      testedAt,
    };
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
      return {
        region: probe.id,
        label: probe.label,
        lat: probe.lat,
        lng: probe.lng,
        totalMs: null,
        ttfbMs: null,
        statusCode: response.status,
        error: errorBody?.error ?? `Probe returned HTTP ${response.status}.`,
        testedAt,
        cloudflareColo: null,
        placementRegion: null,
      };
    }

    const body = (await response.json().catch(() => null)) as {
      total_ms?: number;
      totalMs?: number;
      ttfb_ms?: number;
      ttfbMs?: number;
      status_code?: number;
      statusCode?: number;
      cloudflare_colo?: string | null;
      cloudflareColo?: string | null;
      placement_region?: string | null;
      placementRegion?: string | null;
      error?: string | null;
    } | null;

    const totalMs = coerceNumber(body?.total_ms ?? body?.totalMs);

    return {
      region: probe.id,
      label: probe.label,
      lat: probe.lat,
      lng: probe.lng,
      totalMs,
      ttfbMs: totalMs,
      statusCode: coerceNumber(body?.status_code ?? body?.statusCode),
      error: body?.error ?? null,
      testedAt,
      cloudflareColo: coerceString(body?.cloudflare_colo ?? body?.cloudflareColo),
      placementRegion: coerceString(body?.placement_region ?? body?.placementRegion),
    };
  } catch (error) {
    const message = formatProbeFetchError(error, probe);
    return {
      region: probe.id,
      label: probe.label,
      lat: probe.lat,
      lng: probe.lng,
      totalMs: null,
      ttfbMs: null,
      statusCode: null,
      error: message,
      testedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function formatProbeFetchError(error: unknown, probe: ProbeConfig): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "Probe timed out.";
  }

  if (isConnectionRefusedError(error)) {
    if (process.env.NODE_ENV === "production") {
      return `Probe unreachable at ${probe.endpoint}. Check regional probe deployment and PROBE_WORKERS_SUBDOMAIN.`;
    }

    return `Probe unreachable at ${probe.endpoint ?? getLocalProbeEndpoint()}. Start the local probe with npm run probe:dev or use npm run dev:local.`;
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

function coerceNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function coerceString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
