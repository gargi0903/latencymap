import type { ProbeConfig, ProbeResult } from "@/lib/types";

type ProbeWireResponse = {
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
};

export function buildProbeResult(
  probe: ProbeConfig,
  testedAt: string,
  overrides: Partial<ProbeResult> = {},
): ProbeResult {
  return {
    region: probe.id,
    label: probe.label,
    lat: probe.lat,
    lng: probe.lng,
    totalMs: null,
    ttfbMs: null,
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
  const totalMs = coerceNumber(wire?.total_ms ?? wire?.totalMs);

  return buildProbeResult(probe, testedAt, {
    totalMs,
    ttfbMs: totalMs,
    statusCode: coerceNumber(wire?.status_code ?? wire?.statusCode),
    error: wire?.error ?? null,
    cloudflareColo: coerceString(wire?.cloudflare_colo ?? wire?.cloudflareColo),
    placementRegion: coerceString(wire?.placement_region ?? wire?.placementRegion),
  });
}

function coerceNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function coerceString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
