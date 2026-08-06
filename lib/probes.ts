import { PROBE_CLIENT_TIMEOUT_MS } from "@/lib/constants";
import { buildProbeResult, mapProbeWireResponse } from "@/lib/probe-response";
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
