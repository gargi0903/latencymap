import { NextRequest, NextResponse } from "next/server";
import { sharePathForRun } from "@/lib/share-payload";
import { ProbeConfigurationError, runRegionalTest } from "@/lib/probes";
import { createTestRequestSchema } from "@/lib/test-request";
import { buildTestRun } from "@/lib/test-run";
import { normalizeAndValidatePublicUrl } from "@/lib/url-safety";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const allowed = await checkRateLimit(ip);
  if (!allowed.ok) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${allowed.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  const parsed = createTestRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected JSON body with a url field." }, { status: 400 });
  }

  const validation = await normalizeAndValidatePublicUrl(parsed.data.url);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  let results;
  try {
    results = await runRegionalTest(validation.url);
  } catch (error) {
    if (error instanceof ProbeConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    throw error;
  }

  const run = buildTestRun({
    inputUrl: parsed.data.url,
    normalizedUrl: validation.url,
    results,
  });

  return NextResponse.json({ run, sharePath: sharePathForRun(run) });
}
