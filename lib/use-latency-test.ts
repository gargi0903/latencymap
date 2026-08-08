"use client";

import { FormEvent, useState } from "react";
import type { TestRun } from "@/lib/types";

type CreateTestResponse = {
  run: TestRun;
  sharePath: string;
  error?: string;
};

export async function fetchLatencyTest(trimmed: string): Promise<
  | { ok: true; run: TestRun; sharePath: string }
  | { ok: false; error: string }
> {
  try {
    const response = await fetch("/api/tests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: trimmed }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as CreateTestResponse | null;
      return { ok: false, error: body?.error ?? "Unable to run latency test." };
    }

    const body = (await response.json()) as CreateTestResponse;
    return { ok: true, run: body.run, sharePath: body.sharePath };
  } catch {
    return { ok: false, error: "Unable to reach the Latencymap API." };
  }
}

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
      const result = await fetchLatencyTest(trimmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setRun(result.run);
      setSharePath(result.sharePath);
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runTest();
  }

  return {
    url,
    setUrl,
    run,
    sharePath,
    error,
    isLoading,
    runTest,
    onSubmit,
  };
}
