import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createTestRun, listRunsForUrl } from "@/lib/storage";
import { ProbeConfigurationError, runRegionalTest } from "@/lib/probes";
import { RuntimeConfigurationError } from "@/lib/runtime-config";
import { normalizeAndValidatePublicUrl } from "@/lib/url-safety";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const requestSchema = z.object({
  url: z.string().min(1).max(2048),
});

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  let allowed;
  try {
    allowed = await checkRateLimit(ip);
  } catch (error) {
    if (error instanceof RuntimeConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    throw error;
  }
  if (!allowed.ok) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${allowed.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
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

  const run = await createTestRun({
    inputUrl: parsed.data.url,
    normalizedUrl: validation.url,
    results,
  });
  const history = await listRunsForUrl(validation.url, 5);

  return NextResponse.json({ run, history });
}
