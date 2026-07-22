import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const appHost = process.env.APP_HOST || "127.0.0.1";
const appPort = process.env.APP_PORT || "3000";
const probePort = process.env.PROBE_PORT || "8787";
const probeRegion = process.env.PROBE_REGION || "local";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const localProbeConfig = JSON.stringify([
  {
    id: probeRegion,
    label: "Local Probe",
    lat: 28.6139,
    lng: 77.209,
    endpoint: `http://127.0.0.1:${probePort}/probe`,
  },
]);

const appEnv = {
  ...process.env,
  APP_HOST: appHost,
  APP_PORT: appPort,
  PROBE_ENDPOINTS: getConfiguredProbeEndpoints() || localProbeConfig,
};

const probeEnv = {
  ...process.env,
  PORT: probePort,
  PROBE_REGION: probeRegion,
};

const children = [
  spawn(npmCommand, ["run", "probe:dev"], {
    env: probeEnv,
    stdio: "inherit",
  }),
  spawn(npmCommand, ["run", "dev", "--", "-H", appHost, "-p", appPort], {
    env: appEnv,
    stdio: "inherit",
  }),
];

let shuttingDown = false;

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    for (const other of children) {
      if (other !== child && !other.killed) {
        other.kill(signal || "SIGTERM");
      }
    }

    process.exitCode = code ?? 1;
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    shuttingDown = true;
    for (const child of children) {
      if (!child.killed) {
        child.kill(signal);
      }
    }
  });
}

function getConfiguredProbeEndpoints() {
  if (process.env.PROBE_ENDPOINTS) {
    return process.env.PROBE_ENDPOINTS;
  }

  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return null;
  }

  const contents = readFileSync(envPath, "utf8");
  const line = contents
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("PROBE_ENDPOINTS="));

  const value = line?.slice("PROBE_ENDPOINTS=".length).trim();
  return value || null;
}
