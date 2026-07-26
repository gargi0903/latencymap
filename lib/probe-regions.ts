import type { ProbeConfig } from "@/lib/types";

type ProbeRegionDefinition = {
  id: string;
  label: string;
  country: string;
  lat: number;
  lng: number;
};

const PROBE_REGIONS = [
  {
    id: "iad",
    label: "US East (Ashburn)",
    country: "United States",
    lat: 39.0438,
    lng: -77.4874,
  },
  {
    id: "lhr",
    label: "Europe West (London)",
    country: "United Kingdom",
    lat: 51.5072,
    lng: -0.1276,
  },
  {
    id: "sin",
    label: "Asia Southeast (Singapore)",
    country: "Singapore",
    lat: 1.3521,
    lng: 103.8198,
  },
  {
    id: "syd",
    label: "Australia East (Sydney)",
    country: "Australia",
    lat: -33.8688,
    lng: 151.2093,
  },
  {
    id: "gru",
    label: "South America (Sao Paulo)",
    country: "Brazil",
    lat: -23.5558,
    lng: -46.6396,
  },
] as const satisfies readonly ProbeRegionDefinition[];

export const PROBE_REGION_IDS = PROBE_REGIONS.map((region) => region.id);

const LOCAL_PROBE_REGION = {
  id: "local",
  label: "Local development",
  country: "Local",
  lat: 0,
  lng: 0,
} as const;

const PROBE_COUNTRIES = PROBE_REGIONS.map((region) => region.country);

export const PROBE_COUNTRY_LIST = PROBE_COUNTRIES.join(" · ");

export function probeCountryName(regionId: string) {
  const region = PROBE_REGIONS.find((entry) => entry.id === regionId);
  if (region) {
    return region.country;
  }

  if (regionId === LOCAL_PROBE_REGION.id) {
    return LOCAL_PROBE_REGION.country;
  }

  return regionId;
}

function toProbeConfig(region: ProbeRegionDefinition): ProbeConfig {
  return {
    id: region.id,
    label: region.label,
    lat: region.lat,
    lng: region.lng,
  };
}

function getProductionProbeEndpoint(regionId: string): string {
  const subdomain = process.env.PROBE_WORKERS_SUBDOMAIN?.trim();
  if (!subdomain) {
    return "";
  }

  return `https://latencymap-probe-${regionId}.${subdomain}/probe`;
}

function getProductionProbeRegions(): ProbeConfig[] {
  return PROBE_REGIONS.map((region) => ({
    ...toProbeConfig(region),
    endpoint: getProductionProbeEndpoint(region.id),
  }));
}

export function getLocalProbeEndpoint() {
  const explicit = process.env.LOCAL_PROBE_ENDPOINT?.trim();
  if (explicit) {
    return explicit;
  }

  const host = process.env.PROBE_HOST?.trim() || "127.0.0.1";
  const port = process.env.PROBE_PORT?.trim() || "8787";
  return `http://${host}:${port}/probe`;
}

function getLocalProbeRegion(endpoint = getLocalProbeEndpoint()): ProbeConfig {
  return {
    id: LOCAL_PROBE_REGION.id,
    label: LOCAL_PROBE_REGION.label,
    lat: LOCAL_PROBE_REGION.lat,
    lng: LOCAL_PROBE_REGION.lng,
    endpoint,
  };
}

export function isProductionProbeMode() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.PROBE_WORKERS_SUBDOMAIN?.trim());
}

export function getProbeRegions(): ProbeConfig[] {
  if (isProductionProbeMode()) {
    return getProductionProbeRegions();
  }

  return [getLocalProbeRegion()];
}
