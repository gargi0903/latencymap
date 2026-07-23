import {
  PROBE_FETCH_MEASURE_SAMPLE_COUNT,
  PROBE_FETCH_SAMPLE_SPREAD_RATIO,
} from "@/lib/probe-fetch";
import type { ProbeResult } from "@/lib/types";

export const LATENCY_FAST_MS = 150;
export const LATENCY_MODERATE_MS = 300;
export const LATENCY_MARGIN_OF_ERROR_PERCENT = Math.round(PROBE_FETCH_SAMPLE_SPREAD_RATIO * 100);

export const LATENCY_COLORS = {
  fast: "#16833a",
  moderate: "#b26a00",
  slow: "#c3362b",
  failed: "#737b8c",
} as const;

export function formatLatency(result: Pick<ProbeResult, "totalMs">) {
  return result.totalMs === null ? "Failed" : `${result.totalMs} ms`;
}

export function formatProbeStatus(result: Pick<ProbeResult, "error" | "statusCode">) {
  if (result.error) return result.error;
  return result.statusCode === null ? "n/a" : `${result.statusCode}`;
}

export function latencyMeasurementNote() {
  return `median ttfb from ${PROBE_FETCH_MEASURE_SAMPLE_COUNT} warmed requests · margin of error ±${LATENCY_MARGIN_OF_ERROR_PERCENT}% on repeat tests`;
}

export function latencyHexColor(totalMs: number | null, error: string | null) {
  if (error || totalMs === null) return LATENCY_COLORS.failed;
  if (totalMs < LATENCY_FAST_MS) return LATENCY_COLORS.fast;
  if (totalMs <= LATENCY_MODERATE_MS) return LATENCY_COLORS.moderate;
  return LATENCY_COLORS.slow;
}

export function formatProbeTimestamp(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatProbeMetadataValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "n/a";
  }

  return String(value);
}
