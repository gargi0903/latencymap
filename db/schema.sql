create table if not exists test_runs (
  id text primary key,
  input_url text not null,
  normalized_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists test_runs_normalized_url_created_at_idx
  on test_runs (normalized_url, created_at desc);

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
  tested_at timestamptz not null,
  cloudflare_colo text,
  placement_region text
);

create unique index if not exists probe_results_test_run_id_region_key
  on probe_results (test_run_id, region);

create table if not exists rate_limit_buckets (
  bucket_key text primary key,
  count integer not null,
  reset_at timestamptz not null
);
