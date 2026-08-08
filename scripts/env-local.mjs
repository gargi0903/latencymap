import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function parseEnvLocalLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separator = trimmed.indexOf("=");
  if (separator === -1) {
    return null;
  }

  const key = trimmed.slice(0, separator).trim();
  const value = stripWrappingQuotes(trimmed.slice(separator + 1).trim());
  return { key, value };
}

export function loadEnvLocal(cwd = process.cwd()) {
  const envPath = path.join(cwd, ".env.local");
  if (!existsSync(envPath)) {
    return {};
  }

  const vars = {};

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const parsed = parseEnvLocalLine(line);
    if (!parsed) {
      continue;
    }

    vars[parsed.key] = parsed.value;
  }

  return vars;
}
