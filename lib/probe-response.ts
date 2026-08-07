import type { ProbeConfig, ProbeResult } from "@/lib/types";

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
