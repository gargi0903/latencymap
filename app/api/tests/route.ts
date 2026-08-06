import { NextRequest, NextResponse } from "next/server";
import { sharePathForRun } from "@/lib/share-payload";
import { ProbeConfigurationError, runRegionalTest } from "@/lib/probes";
import { createTestRequestSchema } from "@/lib/test-request";
import { buildTestRun } from "@/lib/test-run";
import { normalizeAndValidatePublicUrl } from "@/lib/url-safety";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function parseCreateTestBody(request: NextRequest) {
  return createTestRequestSchema.safeParse(await request.json().catch(() => null));
}

async function measureValidatedUrl(url: string) {
  try {
    return { ok: true as const, results: await runRegionalTest(url) };
  } catch (error) {
    if (error instanceof ProbeConfigurationError) {
      return { ok: false as const, error: error.message };
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  const allowed = await checkRateLimit(clientIp(request));
  if (!allowed.ok) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${allowed.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  const parsed = await parseCreateTestBody(request);
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected JSON body with a url field." }, { status: 400 });
  }

  const validation = await normalizeAndValidatePublicUrl(parsed.data.url);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  return createTestResponse(parsed.data.url, validation.url);
}

async function createTestResponse(inputUrl: string, normalizedUrl: string) {
  const measured = await measureValidatedUrl(normalizedUrl);
  if (!measured.ok) {
    return NextResponse.json({ error: measured.error }, { status: 503 });
  }

  const run = buildTestRun({
    inputUrl,
    normalizedUrl,
    results: measured.results,
  });

  return NextResponse.json({ run, sharePath: sharePathForRun(run) });
}
