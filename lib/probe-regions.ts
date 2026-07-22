export const PROBE_COUNTRIES = [
  "United States",
  "United Kingdom",
  "Singapore",
  "Australia",
  "Brazil",
] as const;

export const PROBE_COUNTRY_LIST = PROBE_COUNTRIES.join(" · ");

const PROBE_COUNTRY_BY_ID: Record<string, string> = {
  iad: "United States",
  lhr: "United Kingdom",
  sin: "Singapore",
  syd: "Australia",
  gru: "Brazil",
  local: "Local",
};

export function probeCountryName(regionId: string) {
  return PROBE_COUNTRY_BY_ID[regionId] ?? regionId;
}
