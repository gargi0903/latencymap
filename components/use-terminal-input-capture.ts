"use client";

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";

const INTERACTIVE_SELECTOR = "button, a, textarea, select, [role='button']";

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
}

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

function handleTerminalKeyDown(
  event: KeyboardEvent,
  options: {
    input: HTMLInputElement;
    isLoading: boolean;
    runTest: (targetUrl?: string) => Promise<void>;
    setUrl: Dispatch<SetStateAction<string>>;
    focusInput: () => void;
  },
) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  if (isInteractiveTarget(event.target) && event.target !== options.input) {
    return;
  }

  if (document.activeElement === options.input) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    options.focusInput();
    if (!options.isLoading) {
      void options.runTest();
    }
    return;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    options.focusInput();
    options.setUrl((current) => current.slice(0, -1));
    return;
  }

  if (event.key.length === 1) {
    event.preventDefault();
    options.focusInput();
    options.setUrl((current) => current + event.key);
  }
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

  useEffect(() => {
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
  }, [bootReadyRef, inputRef, isLoadingRef, runTestRef, setUrl, skipBoot]);
}
