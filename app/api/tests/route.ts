import { NextRequest, NextResponse } from "next/server";
import { ProbeConfigurationError, runRegionalTest } from "@/lib/probes";
import { normalizeAndValidatePublicUrl } from "@/lib/url-safety";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ProbeResult, TestRun } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function parseUrlBody(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("url" in body)) return null;
  const url = (body as { url: unknown }).url;
  return typeof url === "string" && url.length > 0 && url.length <= 2048 ? url : null;
}

export async function POST(request: NextRequest) {
  const allowed = await checkRateLimit(clientIp(request));
  if (!allowed.ok) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${allowed.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  const inputUrl = parseUrlBody(await request.json().catch(() => null));
  if (!inputUrl) {
    return NextResponse.json({ error: "Expected JSON body with a url field." }, { status: 400 });
  }

  const validation = await normalizeAndValidatePublicUrl(inputUrl);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  let results: ProbeResult[];
  try {
    results = await runRegionalTest(validation.url);
  } catch (error) {
    if (error instanceof ProbeConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  const run: TestRun = {
    id: crypto.randomUUID(),
    inputUrl,
    normalizedUrl: validation.url,
    createdAt: new Date().toISOString(),
    results,
  };

  return NextResponse.json({ run });
}
