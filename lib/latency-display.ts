import type { ProbeResult } from "@/lib/types";

export const LATENCY_FAST_MS = 150;
export const LATENCY_MODERATE_MS = 300;

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
export function latencyHexColor(totalMs: number | null, error: string | null) {
  if (error || totalMs === null) return LATENCY_COLORS.failed;
  if (totalMs < LATENCY_FAST_MS) return LATENCY_COLORS.fast;
  if (totalMs <= LATENCY_MODERATE_MS) return LATENCY_COLORS.moderate;
  return LATENCY_COLORS.slow;
}

export function latencyTailwindClass(totalMs: number | null, error: string | null) {
  const color = latencyHexColor(totalMs, error);
  if (color === LATENCY_COLORS.fast) return "bg-[#16833a]";
  if (color === LATENCY_COLORS.moderate) return "bg-[#b26a00]";
  if (color === LATENCY_COLORS.slow) return "bg-[#c3362b]";
  return "bg-[#737b8c]";
}

