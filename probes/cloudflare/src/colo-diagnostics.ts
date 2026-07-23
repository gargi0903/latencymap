import { getCloudflareResponseColo } from "../../../lib/cf-response";

export const TRACE_ENDPOINT = "https://cloudflare.com/cdn-cgi/trace";
export const TRACE_TIMEOUT_MS = 1500;

export type ColoDiagnostics = {
  trace_ms: number | null;
  trace_colo: string | null;
  ingress_colo: string | null;
  source: "trace" | "subrequest" | null;
};

export function parseTraceColo(text: string): string | null {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("colo=")) {
      continue;
    }

    const value = trimmed.slice("colo=".length).trim();
    return value.length > 0 ? value : null;
  }

  return null;
}

export function getResponseColo(response: Response): string | null {
  return getCloudflareResponseColo(response);
}

export async function resolveTraceColo(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = TRACE_TIMEOUT_MS,
): Promise<{ colo: string | null; traceMs: number | null }> {
  const boundFetch = fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await boundFetch(
      new Request(TRACE_ENDPOINT, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          accept: "text/plain",
        },
      }),
    );

    const traceMs = Math.round(performance.now() - started);
    if (!response.ok) {
      return { colo: null, traceMs };
    }

    const text = await response.text();
    return {
      colo: parseTraceColo(text) ?? getResponseColo(response),
      traceMs,
    };
  } catch {
    return { colo: null, traceMs: null };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildColoDiagnostics(input: {
  ingressColo: string | null;
  executionColo: string | null;
  traceMs: number | null;
  source: ColoDiagnostics["source"];
}): ColoDiagnostics {
  return {
    trace_ms: input.traceMs,
    trace_colo: input.executionColo,
    ingress_colo: input.ingressColo,
    source: input.source,
  };
}

export function pickExecutionColo(
  subrequestColo: string | null,
  traceColo: string | null,
): { colo: string | null; source: ColoDiagnostics["source"] } {
  if (subrequestColo) {
    return { colo: subrequestColo, source: "subrequest" };
  }

  if (traceColo) {
    return { colo: traceColo, source: "trace" };
  }

  return { colo: null, source: null };
}
