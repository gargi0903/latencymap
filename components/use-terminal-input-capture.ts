"use client";

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import { handleTerminalKeyDown, isInteractiveTarget } from "@/lib/terminal";

type TerminalInputCaptureOptions = {
  inputRef: RefObject<HTMLInputElement | null>;
  bootReadyRef: RefObject<boolean>;
  isLoadingRef: RefObject<boolean>;
  runTestRef: RefObject<(targetUrl?: string) => Promise<void>>;
  skipBoot: () => void;
  setUrl: Dispatch<SetStateAction<string>>;
  focusWhenReady: boolean;
};

function focusTerminalInput(input: HTMLInputElement | null) {
  input?.focus({ preventScroll: true });
}

function bindTerminalListeners(options: Omit<TerminalInputCaptureOptions, "focusWhenReady">) {
  const { inputRef, bootReadyRef, isLoadingRef, runTestRef, skipBoot, setUrl } = options;

  function focusInput() {
    if (!bootReadyRef.current) {
      skipBoot();
      return;
    }

    focusTerminalInput(inputRef.current);
  }

  function onPointerDown(event: PointerEvent) {
    if (!bootReadyRef.current) {
      event.preventDefault();
      skipBoot();
      return;
    }

    if (isInteractiveTarget(event.target)) {
      return;
    }

    focusInput();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!bootReadyRef.current) {
      event.preventDefault();
      skipBoot();
      return;
    }

    const input = inputRef.current;
    if (!input) {
      return;
    }

    handleTerminalKeyDown(event, {
      input,
      isLoading: Boolean(isLoadingRef.current),
      runTest: runTestRef.current,
      setUrl,
      focusInput,
    });
  }

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);

  return () => {
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
  };
}

export function useTerminalInputCapture({
  inputRef,
  bootReadyRef,
  isLoadingRef,
  runTestRef,
  skipBoot,
  setUrl,
  focusWhenReady,
}: TerminalInputCaptureOptions) {
  useEffect(() => {
    if (focusWhenReady) {
      focusTerminalInput(inputRef.current);
    }
  }, [focusWhenReady, inputRef]);

  useEffect(
    () =>
      bindTerminalListeners({
        inputRef,
        bootReadyRef,
        isLoadingRef,
        runTestRef,
        skipBoot,
        setUrl,
      }),
    [bootReadyRef, inputRef, isLoadingRef, runTestRef, setUrl, skipBoot],
  );
}
