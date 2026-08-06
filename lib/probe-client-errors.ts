import { getLocalProbeEndpoint } from "@/lib/probe-regions";
import type { ProbeConfig } from "@/lib/types";

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
