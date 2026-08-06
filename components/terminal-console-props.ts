"use client";

import type { FormEvent, ReactNode, RefObject } from "react";

export type TerminalConsoleProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  url: string;
  setUrl: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  showBoot: boolean;
  bootReady: boolean;
  bootLines: ReactNode[] | null;
  isLoading: boolean;
  error: string | null;
  hasResults: boolean;
};
