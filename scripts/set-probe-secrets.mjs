#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const regions = ["iad", "lhr", "sin", "syd", "gru", "coordinator"];
const wrangler = process.platform === "win32" ? "wrangler.cmd" : "wrangler";
const config = "probes/cloudflare/wrangler.jsonc";

process.stdout.write("Setting PROBE_SECRET on all Cloudflare probe environments...\n");
process.stdout.write("You will be prompted once per environment.\n\n");

let failed = false;

for (const region of regions) {
  process.stdout.write(`-> ${region}\n`);
  const result = spawnSync(
    wrangler,
    ["secret", "put", "PROBE_SECRET", "--config", config, "--env", region],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    failed = true;
    process.stderr.write(`Failed to set PROBE_SECRET for ${region}.\n`);
  }
}

process.exit(failed ? 1 : 0);
