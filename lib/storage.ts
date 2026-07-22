import { neon } from "@neondatabase/serverless";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertLocalStorageAllowed } from "@/lib/runtime-config";
import type { CreateTestRunInput, ProbeResult, TestRun } from "@/lib/types";

const LOCAL_STORE_PATH = path.join(process.cwd(), ".data", "latencymap.json");

type LocalStore = {
  runs: TestRun[];
};

export async function createTestRun(input: CreateTestRunInput): Promise<TestRun> {
  const run: TestRun = {
    id: crypto.randomUUID(),
    inputUrl: input.inputUrl,
    normalizedUrl: input.normalizedUrl,
    createdAt: new Date().toISOString(),
    results: input.results,
  };

  if (process.env.DATABASE_URL) {
    await ensureSchema();
    const sql = neon(process.env.DATABASE_URL);
    await sql.transaction((transaction) => [
      transaction`
        insert into test_runs (id, input_url, normalized_url, created_at)
        values (${run.id}, ${run.inputUrl}, ${run.normalizedUrl}, ${run.createdAt})
      `,
      ...run.results.map(
        (result) => transaction`
          insert into probe_results (
            id,
            test_run_id,
            region,
            label,
            lat,
            lng,
            total_ms,
            status_code,
            error,
            tested_at,
            cloudflare_colo,
            placement_region
          )
          values (
            ${crypto.randomUUID()},
            ${run.id},
            ${result.region},
            ${result.label},
            ${result.lat},
            ${result.lng},
            ${result.totalMs},
            ${result.statusCode},
            ${result.error},
            ${result.testedAt},
            ${result.cloudflareColo ?? null},
            ${result.placementRegion ?? null}
          )
        `,
      ),
    ]);

    return run;
  }

  assertLocalStorageAllowed();
  const store = await readLocalStore();
  store.runs.unshift(run);
  await writeLocalStore(store);
  return run;
}

export async function getTestRun(id: string): Promise<TestRun | null> {
  if (process.env.DATABASE_URL) {
    await ensureSchema();
    const sql = neon(process.env.DATABASE_URL);
    const runs = await sql`
      select id, input_url, normalized_url, created_at
      from test_runs
      where id = ${id}
      limit 1
    `;

    if (runs.length === 0) {
      return null;
    }

    const results = await sql`
      select region, label, lat, lng, total_ms, status_code, error, tested_at, cloudflare_colo, placement_region
      from probe_results
      where test_run_id = ${id}
      order by label asc
    `;

    const run = mapRun(runs[0], results);
    return isRealProbeRun(run) ? run : null;
  }

  assertLocalStorageAllowed();
  const store = await readLocalStore();
  const run = store.runs.find((candidate) => candidate.id === id) ?? null;
  return run && isRealProbeRun(run) ? run : null;
}

export async function listRunsForUrl(normalizedUrl: string, limit: number): Promise<TestRun[]> {
  if (process.env.DATABASE_URL) {
    await ensureSchema();
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      select
        runs.id,
        runs.input_url,
        runs.normalized_url,
        runs.created_at,
        results.region,
        results.label,
        results.lat,
        results.lng,
        results.total_ms,
        results.status_code,
        results.error,
        results.tested_at,
        results.cloudflare_colo,
        results.placement_region
      from (
        select id, input_url, normalized_url, created_at
        from test_runs
        where normalized_url = ${normalizedUrl}
        order by created_at desc
        limit ${limit}
      ) as runs
      join probe_results as results on results.test_run_id = runs.id
      order by runs.created_at desc, results.label asc
    `;

    const runs = groupRunRows(rows);

    return runs.filter(isRealProbeRun);
  }

  assertLocalStorageAllowed();
  const store = await readLocalStore();
  return store.runs
    .filter((run) => run.normalizedUrl === normalizedUrl && isRealProbeRun(run))
    .slice(0, limit);
}

let schemaPromise: Promise<void> | null = null;

function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = createSchema();
  }

  return schemaPromise;
}

async function createSchema() {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const sql = neon(process.env.DATABASE_URL);
  await sql`
    create table if not exists test_runs (
      id text primary key,
      input_url text not null,
      normalized_url text not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists test_runs_normalized_url_created_at_idx on test_runs (normalized_url, created_at desc)`;
  await sql`
    create table if not exists probe_results (
      id text primary key,
      test_run_id text not null references test_runs(id) on delete cascade,
      region text not null,
      label text not null,
      lat double precision not null,
      lng double precision not null,
      total_ms integer,
      status_code integer,
      error text,
      tested_at timestamptz not null
    )
  `;
  await sql`alter table probe_results add column if not exists cloudflare_colo text`;
  await sql`alter table probe_results add column if not exists placement_region text`;
  await sql`create unique index if not exists probe_results_test_run_id_region_key on probe_results (test_run_id, region)`;
  await sql`
    create table if not exists rate_limit_buckets (
      bucket_key text primary key,
      count integer not null,
      reset_at timestamptz not null
    )
  `;
}

function mapRun(run: Record<string, unknown>, results: Record<string, unknown>[]): TestRun {
  return {
    id: String(run.id),
    inputUrl: String(run.input_url),
    normalizedUrl: String(run.normalized_url),
    createdAt: new Date(String(run.created_at)).toISOString(),
    results: results.map(mapProbeResult),
  };
}

function mapProbeResult(result: Record<string, unknown>): ProbeResult {
  return {
    region: String(result.region),
    label: String(result.label),
    lat: Number(result.lat),
    lng: Number(result.lng),
    totalMs: result.total_ms === null ? null : Number(result.total_ms),
    statusCode: result.status_code === null ? null : Number(result.status_code),
    error: result.error === null ? null : String(result.error),
    testedAt: new Date(String(result.tested_at)).toISOString(),
    cloudflareColo: result.cloudflare_colo === null || result.cloudflare_colo === undefined ? null : String(result.cloudflare_colo),
    placementRegion: result.placement_region === null || result.placement_region === undefined ? null : String(result.placement_region),
  };
}

function groupRunRows(rows: Record<string, unknown>[]): TestRun[] {
  const grouped = new Map<string, { run: Record<string, unknown>; results: Record<string, unknown>[] }>();

  for (const row of rows) {
    const id = String(row.id);
    const group = grouped.get(id);
    if (group) {
      group.results.push(row);
    } else {
      grouped.set(id, { run: row, results: [row] });
    }
  }

  return Array.from(grouped.values(), ({ run, results }) => mapRun(run, results));
}

async function readLocalStore(): Promise<LocalStore> {
  try {
    const contents = await readFile(LOCAL_STORE_PATH, "utf8");
    return JSON.parse(contents) as LocalStore;
  } catch {
    return { runs: [] };
  }
}

async function writeLocalStore(store: LocalStore) {
  await mkdir(path.dirname(LOCAL_STORE_PATH), { recursive: true });
  await writeFile(LOCAL_STORE_PATH, JSON.stringify(store, null, 2));
}

function isRealProbeRun(run: TestRun): boolean {
  return run.results.length > 0 && run.results.every((result) => !isLegacyDemoProbe(result));
}

function isLegacyDemoProbe(result: ProbeResult): boolean {
  return result.region.endsWith("-demo") || result.label.toLowerCase().includes(" demo");
}
