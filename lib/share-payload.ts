import type { ProbeResult, TestRun } from "@/lib/types";

/** Compact wire format for URL-encoded share links. */
type WireProbe = {
  g: string;
  l: string;
  a: number;
  o: number;
  m: number | null;
  s: number | null;
  e: string | null;
  d: string;
  c?: string | null;
  p?: string | null;
};

type WirePayload = {
  u: string;
  i?: string;
  t: string;
  r: WireProbe[];
};

const SHARE_VERSION = 1;

type ShareEnvelope = {
  v: number;
  p: WirePayload;
};

export function encodeSharePayload(run: TestRun): string {
  const wire = testRunToWire(run);
  const json = JSON.stringify({ v: SHARE_VERSION, p: wire } satisfies ShareEnvelope);
  return toBase64Url(encodeUtf8(json));
}

export function decodeSharePayload(token: string): TestRun | null {
  try {
    const json = decodeUtf8(fromBase64Url(token));
    const envelope = JSON.parse(json) as ShareEnvelope;
    if (envelope.v !== SHARE_VERSION || !envelope.p?.u || !Array.isArray(envelope.p.r)) {
      return null;
    }

    return wireToTestRun(envelope.p);
  } catch {
    return null;
  }
}

export function sharePathForRun(run: TestRun): string {
  return `/r/${run.id || encodeSharePayload(run)}`;
}

function testRunToWire(run: TestRun): WirePayload {
  return {
    u: run.normalizedUrl,
    ...(run.inputUrl !== run.normalizedUrl ? { i: run.inputUrl } : {}),
    t: run.createdAt,
    r: run.results.map(probeToWire),
  };
}

function wireToTestRun(wire: WirePayload): TestRun {
  const run: TestRun = {
    id: "",
    inputUrl: wire.i ?? wire.u,
    normalizedUrl: wire.u,
    createdAt: wire.t,
    results: wire.r.map(wireToProbe),
  };
  run.id = encodeSharePayload(run);
  return run;
}

function probeToWire(result: ProbeResult): WireProbe {
  const wire: WireProbe = {
    g: result.region,
    l: result.label,
    a: result.lat,
    o: result.lng,
    m: result.totalMs,
    s: result.statusCode,
    e: result.error,
    d: result.testedAt,
  };

  if (result.cloudflareColo) wire.c = result.cloudflareColo;
  if (result.placementRegion) wire.p = result.placementRegion;
  return wire;
}

function wireToProbe(wire: WireProbe): ProbeResult {
  return {
    region: wire.g,
    label: wire.l,
    lat: wire.a,
    lng: wire.o,
    totalMs: wire.m,
    statusCode: wire.s,
    error: wire.e,
    testedAt: wire.d,
    cloudflareColo: wire.c ?? null,
    placementRegion: wire.p ?? null,
  };
}

function toBase64Url(bytes: Uint8Array): string {
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(bytes).toString("base64")
      : btoa(String.fromCharCode(...bytes));

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(token: string): Uint8Array {
  const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(padded, "base64"));
  }

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodeUtf8(value: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value);
  }

  return new Uint8Array(Buffer.from(value, "utf8"));
}

function decodeUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder().decode(bytes);
  }

  return Buffer.from(bytes).toString("utf8");
}
