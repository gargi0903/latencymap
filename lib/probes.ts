import { PROBE_CLIENT_TIMEOUT_MS } from "@/lib/constants";
import { formatProbeFetchError } from "@/lib/probe-client-errors";
import { buildProbeResult, mapProbeWireResponse } from "@/lib/probe-response";
import { getProbeRegions, isProductionProbeMode } from "@/lib/probe-regions";
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
