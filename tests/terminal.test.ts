/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest";
import { handleTerminalKeyDown, isInteractiveTarget } from "@/components/dashboard";

function makeEvent(partial: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    key: partial.key,
    defaultPrevented: partial.defaultPrevented ?? false,
    metaKey: partial.metaKey ?? false,
    ctrlKey: partial.ctrlKey ?? false,
    altKey: partial.altKey ?? false,
    target: partial.target ?? document.body,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe("handleTerminalKeyDown ignores", () => {
  it("ignores modified keys and focused input", () => {
    const input = document.createElement("input");
    const focusInput = vi.fn();
    const runTest = vi.fn(async () => undefined);
    const setUrl = vi.fn();

    handleTerminalKeyDown(makeEvent({ key: "a", metaKey: true }), {
      input,
      isLoading: false,
      runTest,
      setUrl,
      focusInput,
    });
    expect(focusInput).not.toHaveBeenCalled();

    Object.defineProperty(document, "activeElement", { configurable: true, get: () => input });
    handleTerminalKeyDown(makeEvent({ key: "a", target: input }), {
      input,
      isLoading: false,
      runTest,
      setUrl,
      focusInput,
    });
    expect(focusInput).not.toHaveBeenCalled();
  });
});

describe("handleTerminalKeyDown edits", () => {
  it("runs a test on Enter when idle", () => {
    const input = document.createElement("input");
    const focusInput = vi.fn();
    const runTest = vi.fn(async () => undefined);
    const setUrl = vi.fn();
    const event = makeEvent({ key: "Enter" });

    handleTerminalKeyDown(event, { input, isLoading: false, runTest, setUrl, focusInput });
    expect(event.preventDefault).toHaveBeenCalled();
    expect(focusInput).toHaveBeenCalled();
    expect(runTest).toHaveBeenCalled();
  });

  it("edits the url on Backspace and printable keys", () => {
    const input = document.createElement("input");
    const focusInput = vi.fn();
    const runTest = vi.fn(async () => undefined);
    const setUrl = vi.fn((updater) => (typeof updater === "function" ? updater("ab") : updater));

    handleTerminalKeyDown(makeEvent({ key: "Backspace" }), {
      input,
      isLoading: false,
      runTest,
      setUrl,
      focusInput,
    });
    expect(setUrl).toHaveBeenCalled();

    handleTerminalKeyDown(makeEvent({ key: "z" }), {
      input,
      isLoading: false,
      runTest,
      setUrl,
      focusInput,
    });
    expect(setUrl).toHaveBeenCalledTimes(2);
  });
});

describe("isInteractiveTarget", () => {
  it("detects interactive elements", () => {
    const button = document.createElement("button");
    expect(isInteractiveTarget(button)).toBe(true);
    expect(isInteractiveTarget(document.createElement("div"))).toBe(false);
    expect(isInteractiveTarget(null)).toBe(false);
  });
});
