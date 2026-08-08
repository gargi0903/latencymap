import { spawnSync } from "node:child_process";

const region = process.argv[2];
const wrangler = process.platform === "win32" ? "wrangler.cmd" : "wrangler";
const args = ["secret", "list", "--config", "probes/cloudflare/wrangler.jsonc", "--format", "json"];

if (region) {
  args.push("--env", region);
}

const result = spawnSync(wrangler, args, { encoding: "utf8" });
if (result.status !== 0) {
  process.stderr.write(result.stderr || "Could not verify deployed Cloudflare Worker secrets.\n");
  process.exit(result.status || 1);
}

try {
  const secrets = JSON.parse(result.stdout);
  const hasProbeSecret = Array.isArray(secrets) && secrets.some((secret) => secret?.name === "PROBE_SECRET");
  if (hasProbeSecret) {
    process.exit(0);
  }
} catch {}

const target = region ? `the ${region} environment` : "the default Worker environment";
process.stderr.write(
  `PROBE_SECRET is not deployed to ${target}. Run "wrangler secret put PROBE_SECRET --config probes/cloudflare/wrangler.jsonc${region ? ` --env ${region}` : ""}" before deploying.\n`,
);
process.exit(1);
