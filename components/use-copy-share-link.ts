"use client";

import { useCallback, useState } from "react";

export function useCopyShareLink(sharePath: string | null) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const copyShareLink = useCallback(async () => {
    if (!sharePath) {
      return;
    }

    try {
      await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("idle");
    }
  }, [sharePath]);

  return { copyState, copyShareLink };
}
