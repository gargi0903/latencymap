"use client";

import { FormEvent, useState } from "react";
import type { TestRun } from "@/lib/types";

type CreateTestResponse = {
  run: TestRun;
  sharePath: string;
  error?: string;
};

export function useLatencyTest() {
  const [url, setUrl] = useState("");
  const [run, setRun] = useState<TestRun | null>(null);
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function runTest(targetUrl?: string) {
    const trimmed = (targetUrl ?? url).trim();
    if (!trimmed) return;

    setUrl(trimmed);
    setError(null);
    setRun(null);
    setSharePath(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/tests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as CreateTestResponse | null;
        setError(body?.error ?? "Unable to run latency test.");
        return;
      }

      const body = (await response.json()) as CreateTestResponse;
      setRun(body.run);
      setSharePath(body.sharePath);
    } catch {
      setError("Unable to reach the Latencymap API.");
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runTest();
  }

  function reset() {
    setRun(null);
    setSharePath(null);
    setError(null);
  }

  const hasResults = Boolean(run);

  return {
    url,
    setUrl,
    run,
    sharePath,
    error,
    isLoading,
    hasResults,
    runTest,
    onSubmit,
    reset,
  };
}
