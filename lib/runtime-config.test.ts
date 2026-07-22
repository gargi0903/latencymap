import { afterEach, describe, expect, it } from "vitest";
import { assertLocalStorageAllowed, RuntimeConfigurationError } from "./runtime-config";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("assertLocalStorageAllowed", () => {
  it("allows local JSON storage outside production", () => {
    process.env.NODE_ENV = "development";

    expect(() => assertLocalStorageAllowed()).not.toThrow();
  });

  it("rejects local JSON storage in production", () => {
    process.env.NODE_ENV = "production";

    expect(() => assertLocalStorageAllowed()).toThrow(RuntimeConfigurationError);
  });
});
