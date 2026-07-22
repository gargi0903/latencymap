import { neon } from "@neondatabase/serverless";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 10;
const LOCAL_STORE_PATH = path.join(process.cwd(), ".data", "rate-limits.json");

type Bucket = {
  count: number;
  resetAt: number;
};

type LocalStore = {
  buckets: Record<string, Bucket>;
};

let schemaPromise: Promise<void> | null = null;

export async function checkRateLimit(key: string): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  if (process.env.DATABASE_URL) {
    return checkDatabaseRateLimit(key);
  }

  return checkLocalRateLimit(key);
}

async function checkDatabaseRateLimit(key: string): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  await ensureRateLimitSchema();
  const sql = neon(process.env.DATABASE_URL!);
  const now = new Date();
  const resetAt = new Date(now.getTime() + WINDOW_MS);

  const rows = await sql`
    insert into rate_limit_buckets (bucket_key, count, reset_at)
    values (${key}, 1, ${resetAt.toISOString()})
    on conflict (bucket_key) do update
      set
        count = case
          when rate_limit_buckets.reset_at <= ${now.toISOString()} then 1
          else rate_limit_buckets.count + 1
        end,
        reset_at = case
          when rate_limit_buckets.reset_at <= ${now.toISOString()} then ${resetAt.toISOString()}
          else rate_limit_buckets.reset_at
        end
    returning count, reset_at
  `;

  const bucket = rows[0];
  const count = Number(bucket.count);
  const bucketResetAt = new Date(String(bucket.reset_at)).getTime();

  if (count > MAX_REQUESTS) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucketResetAt - Date.now()) / 1000)),
    };
  }

  return { ok: true };
}

async function checkLocalRateLimit(key: string): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const now = Date.now();
  const store = await readLocalStore();
  const existing = store.buckets[key];

  if (!existing || existing.resetAt <= now) {
    store.buckets[key] = { count: 1, resetAt: now + WINDOW_MS };
    await writeLocalStore(store);
    return { ok: true };
  }

  if (existing.count >= MAX_REQUESTS) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  store.buckets[key] = existing;
  await writeLocalStore(store);
  return { ok: true };
}

function ensureRateLimitSchema() {
  if (!schemaPromise) {
    schemaPromise = createRateLimitSchema();
  }

  return schemaPromise;
}

async function createRateLimitSchema() {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const sql = neon(process.env.DATABASE_URL);
  await sql`
    create table if not exists rate_limit_buckets (
      bucket_key text primary key,
      count integer not null,
      reset_at timestamptz not null
    )
  `;
}

async function readLocalStore(): Promise<LocalStore> {
  try {
    const contents = await readFile(LOCAL_STORE_PATH, "utf8");
    return JSON.parse(contents) as LocalStore;
  } catch {
    return { buckets: {} };
  }
}

async function writeLocalStore(store: LocalStore) {
  await mkdir(path.dirname(LOCAL_STORE_PATH), { recursive: true });
  await writeFile(LOCAL_STORE_PATH, JSON.stringify(store, null, 2));
}
