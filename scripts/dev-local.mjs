import { spawn } from "node:child_process";
import { loadEnvLocal } from "./env-local.mjs";

const envLocal = loadEnvLocal();
const baseEnv = { ...envLocal, ...process.env };

const appHost = process.env.APP_HOST || "::";
const appPort = process.env.APP_PORT || "3000";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const appEnv = {
  ...baseEnv,
  APP_HOST: appHost,
  APP_PORT: appPort,
};

const app = spawn(npmCommand, ["run", "dev:app", "--", "-H", appHost, "-p", appPort], {
  env: appEnv,
  stdio: "inherit",
});

let shuttingDown = false;

function beginShutdown(exitCode) {
  if (shuttingDown) {
    return false;
  }

  shuttingDown = true;
  process.exitCode = exitCode;
  return true;
}

app.on("exit", (code) => {
  beginShutdown(code ?? 1);
});

app.on("error", () => {
  beginShutdown(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    shuttingDown = true;
    if (!app.killed) {
      app.kill(signal);
    }
  });
}
