export type ProbeResult = {
  region: string;
  label: string;
  totalMs: number | null;
  statusCode: number | null;
  error: string | null;
  testedAt: string;
  cloudflareColo?: string | null;
  placementRegion?: string | null;
};

export type TestRun = {
  id: string;
  inputUrl: string;
  normalizedUrl: string;
  createdAt: string;
  results: ProbeResult[];
};

export type ProbeConfig = {
  id: string;
  label: string;
  endpoint?: string;
};
