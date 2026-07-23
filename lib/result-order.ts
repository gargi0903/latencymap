import { PROBE_REGION_IDS } from "@/lib/probe-regions";
import type { ProbeResult } from "@/lib/types";

const REGION_ORDER = new Map<string, number>(PROBE_REGION_IDS.map((id, index) => [id, index]));

/** Keep probe rows in stable geographic order instead of reshuffling by latency. */
export function sortResultsByRegionOrder(results: ProbeResult[]): ProbeResult[] {
  return [...results].sort((left, right) => {
    const leftIndex = REGION_ORDER.get(left.region) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = REGION_ORDER.get(right.region) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
}

export function defaultSelectedRegion(results: ProbeResult[]): string | null {
  return sortResultsByRegionOrder(results)[0]?.region ?? null;
}
