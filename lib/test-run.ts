import { encodeSharePayload } from "@/lib/share-payload";
import type { CreateTestRunInput, TestRun } from "@/lib/types";

export function buildTestRun(input: CreateTestRunInput): TestRun {
  const run: TestRun = {
    id: "",
    inputUrl: input.inputUrl,
    normalizedUrl: input.normalizedUrl,
    createdAt: new Date().toISOString(),
    results: input.results,
  };
  run.id = encodeSharePayload(run);
  return run;
}
