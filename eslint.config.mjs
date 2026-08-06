import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// FlatCompat resolves the short "next/*" ids to this package; resolve it
// explicitly so dependency analysis can see the real eslint-config-next use.
require.resolve("eslint-config-next");

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      ".agents/**",
      ".impeccable/**",
      ".next/**",
      ".next-dev/**",
      ".wrangler/**",
      "probes/**/.wrangler/**",
      "node_modules/**",
      "scripts/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
