import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal } from "./env-local.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const envLocal = loadEnvLocal();
const baseEnv = { ...envLocal, ...process.env };

// Bind dual-stack (::) so http://localhost works when localhost resolves to ::1.
const appHost = process.env.APP_HOST || "::";
const appPort = process.env.APP_PORT || "3000";
const probeHost = process.env.PROBE_HOST || "127.0.0.1";
const probePort = process.env.PROBE_PORT || "8787";
const probeRegion = process.env.PROBE_REGION || "local";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const localProbeConfig = getLocalFiveRegionProbeConfig(probePort);

const appEnv = {
  ...baseEnv,
  APP_HOST: appHost,
  APP_PORT: appPort,
  PROBE_ENDPOINTS: getConfiguredProbeEndpoints() || localProbeConfig,
};

const probeEnv = {
  ...baseEnv,
  HOST: probeHost,
  PORT: probePort,
  PROBE_REGION: probeRegion,
};

const probe = spawn(npmCommand, ["run", "probe:dev"], {
  env: probeEnv,
  stdio: "inherit",
});
const app = spawn(npmCommand, ["run", "dev:app", "--", "-H", appHost, "-p", appPort], {
  env: appEnv,
  stdio: "inherit",
});
const children = [probe, app];

let shuttingDown = false;

probe.on("exit", (code) => {
  if (shuttingDown) {
    return;
  }

  console.warn(
    `Local probe exited${typeof code === "number" ? ` with code ${code}` : ""}. The Next app will stay running on http://${appHost}:${appPort}, but local probe requests will fail until the probe starts.`,
  );
});

app.on("exit", (code, signal) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  if (!probe.killed) {
    probe.kill(signal || "SIGTERM");
  }

  process.exitCode = code ?? 1;
});

for (const child of children) {
  child.on("error", () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    for (const other of children) {
      if (other !== child && !other.killed) {
        other.kill("SIGTERM");
      }
    }

    process.exitCode = 1;
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
  if (baseEnv.PROBE_ENDPOINTS) {
    return baseEnv.PROBE_ENDPOINTS;
  }

  return null;
}

function getLocalFiveRegionProbeConfig(probePort) {
  const regionsPath = path.join(repoRoot, "probes", "regions.example.json");
  const regions = JSON.parse(readFileSync(regionsPath, "utf8"));

  return JSON.stringify(
    regions.map((region) => ({
      id: region.id,
      label: region.label,
      lat: region.lat,
      lng: region.lng,
      endpoint: `http://127.0.0.1:${probePort}/probe`,
    })),
  );
}
