import type { ProbeConfig } from "@/lib/types";

type ProbeRegionDefinition = {
  id: string;
  label: string;
  country: string;
};

const PROBE_REGIONS = [
  {
    id: "iad",
    label: "US East (Ashburn)",
    country: "United States",
  },
  {
    id: "lhr",
    label: "Europe West (London)",
    country: "United Kingdom",
  },
  {
    id: "sin",
    label: "Asia Southeast (Singapore)",
    country: "Singapore",
  },
  {
    id: "syd",
    label: "Australia East (Sydney)",
    country: "Australia",
  },
  {
    id: "gru",
    label: "South America (Sao Paulo)",
    country: "Brazil",
  },
] as const satisfies readonly ProbeRegionDefinition[];

export const PROBE_REGION_IDS = PROBE_REGIONS.map((region) => region.id);

const PROBE_COUNTRIES = PROBE_REGIONS.map((region) => region.country);

export const PROBE_COUNTRY_LIST = PROBE_COUNTRIES.join(" · ");

export function probeCountryName(regionId: string) {
  const region = PROBE_REGIONS.find((entry) => entry.id === regionId);
  if (region) {
    return region.country;
  }

  return regionId;
}

function getProbeEndpoint(regionId: string): string {
  const subdomain = process.env.PROBE_WORKERS_SUBDOMAIN?.trim();
  if (!subdomain) {
    return "";
  }

  return `https://latencymap-probe-${regionId}.${subdomain}/probe`;
}

export function getProbeRegions(): ProbeConfig[] {
  return PROBE_REGIONS.map((region) => ({
    id: region.id,
    label: region.label,
    endpoint: getProbeEndpoint(region.id),
  }));
}
