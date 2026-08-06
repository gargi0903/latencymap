import { describe, expect, it } from "vitest";
import { parseEnvLocalLine } from "../scripts/env-local.mjs";

describe("parseEnvLocalLine", () => {
  it("skips blanks and comments", () => {
    expect(parseEnvLocalLine("")).toBeNull();
    expect(parseEnvLocalLine("  # comment")).toBeNull();
    expect(parseEnvLocalLine("NOVALUE")).toBeNull();
  });

  it("parses keys and quoted values", () => {
    expect(parseEnvLocalLine("FOO=bar")).toEqual({ key: "FOO", value: "bar" });
    expect(parseEnvLocalLine(`FOO="bar baz"`)).toEqual({ key: "FOO", value: "bar baz" });
    expect(parseEnvLocalLine("FOO='bar'")).toEqual({ key: "FOO", value: "bar" });
  });
});
