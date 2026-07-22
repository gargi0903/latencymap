import { spawn } from "node:child_process";
import { loadEnvLocal } from "./env-local.mjs";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  process.stderr.write("Usage: node scripts/run-with-env-local.mjs <command> [...args]\n");
  process.exit(1);
}

const child = spawn(command, args, {
  env: { ...loadEnvLocal(), ...process.env },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on("error", () => {
  process.exit(1);
});
