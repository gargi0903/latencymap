import { PROBE_CLIENT_TIMEOUT_MS } from "@/lib/constants";
import type { ProbeConfig, ProbeResult } from "@/lib/types";

export class ProbeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProbeConfigurationError";
  }
}

export async function runRegionalTest(url: string): Promise<ProbeResult[]> {
  const probes = getProbeConfig();
  const probeSecret = getProbeSecret();

  return Promise.all(
    probes.slice(0, 5).map(async (probe) => {
      const testedAt = new Date().toISOString();
      return callRemoteProbe(probe, url, testedAt, probeSecret);
    }),
  );
}

export function getProbeConfig(): ProbeConfig[] {
  const raw = process.env.PROBE_ENDPOINTS;
  if (!raw) {
    throw new ProbeConfigurationError("No probe endpoints configured. Set PROBE_ENDPOINTS to real deployed probe URLs.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ProbeConfigurationError("PROBE_ENDPOINTS must be a valid JSON array of real probe endpoints.");
  }

  if (!Array.isArray(parsed)) {
    throw new ProbeConfigurationError("PROBE_ENDPOINTS must be a JSON array.");
  }

  const usable = parsed.filter(isUsableProbeConfig);
  if (usable.length === 0) {
    throw new ProbeConfigurationError("PROBE_ENDPOINTS did not contain any usable probe endpoints.");
  }

  return usable;
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

async function callRemoteProbe(probe: ProbeConfig, url: string, testedAt: string, probeSecret: string): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch(probe.endpoint!, {
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
      status_code?: number;
      statusCode?: number;
      cloudflare_colo?: string | null;
      cloudflareColo?: string | null;
      placement_region?: string | null;
      placementRegion?: string | null;
      error?: string | null;
    } | null;

    return {
      region: probe.id,
      label: probe.label,
      lat: probe.lat,
      lng: probe.lng,
      totalMs: coerceNumber(body?.total_ms ?? body?.totalMs),
      statusCode: coerceNumber(body?.status_code ?? body?.statusCode),
      error: body?.error ?? null,
      testedAt,
      cloudflareColo: coerceString(body?.cloudflare_colo ?? body?.cloudflareColo),
      placementRegion: coerceString(body?.placement_region ?? body?.placementRegion),
    };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "Probe timed out." : "Probe failed.";
    return {
      region: probe.id,
      label: probe.label,
      lat: probe.lat,
      lng: probe.lng,
      totalMs: null,
      statusCode: null,
      error: message,
      testedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function coerceNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function coerceString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isUsableProbeConfig(value: unknown): value is ProbeConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const probe = value as Partial<ProbeConfig>;
  return (
    typeof probe.id === "string" &&
    typeof probe.label === "string" &&
    typeof probe.lat === "number" &&
    typeof probe.lng === "number" &&
    typeof probe.endpoint === "string" &&
    isValidHttpUrl(probe.endpoint)
  );
}
