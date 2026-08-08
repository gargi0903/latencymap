import type { Dispatch, SetStateAction } from "react";

export type TerminalKeyHandlerOptions = {
  input: HTMLInputElement;
  isLoading: boolean;
  runTest: (targetUrl?: string) => Promise<void>;
  setUrl: Dispatch<SetStateAction<string>>;
  focusInput: () => void;
};

function shouldIgnoreKeyEvent(event: KeyboardEvent, input: HTMLInputElement) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
    return true;
  }

  if (isInteractiveTarget(event.target) && event.target !== input) {
    return true;
  }

  return document.activeElement === input;
}

export function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("button, a, textarea, select, [role='button']"));
}

export function handleTerminalKeyDown(event: KeyboardEvent, options: TerminalKeyHandlerOptions) {
  if (shouldIgnoreKeyEvent(event, options.input)) {
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
