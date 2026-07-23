# Latencymap Context

## What this is

Latencymap is a portfolio/demo MVP for one-time public URL latency tests. Users enter a public HTTP/S URL, the central API validates it, calls regional probes in parallel, stores the run, and returns exact measurements with an honest 3D globe view.

## Core vocabulary

- **Evidence surface**: Summary metrics, globe/table results, share link, and same-URL history shown after a test completes.
- **Equal evidence**: Globe and table are both authoritative views of the same probe data. The UI switches between them rather than showing fake regional coverage.
- **First-run screen**: Dashboard shell, URL form, concise safety copy, and a bounded-request conditions rail before any test runs.
- **Clean technical workspace**: Dense, readable developer-tool UI with cobalt command accents and mineral operational surfaces.

## Architecture

```txt
Next.js app (Vercel)
  /, /r/[id], /api/tests, /api/tests/[id]
        |
        v
Neon Postgres or local JSON in .data/
        |
        v
Cloudflare Worker probes (production) or Node probe (local dev)
```

## Key constraints

- Only `http://` and `https://` URLs with SSRF protections on every fetch path.
- No accounts, billing, scheduled monitoring, or custom headers in the MVP.
- Production probe configuration via `PROBE_COORDINATOR_ENDPOINT` and `PROBE_SECRET`; region metadata is committed in `lib/probe-regions.ts`.
- Anonymous rate limit: 10 test runs/hour/IP, max 5 probes per run.
- Latency colors: green `<150 ms`, yellow `150-300 ms`, red `>300 ms`, gray failed.

## Related docs

- Product scope: `PRODUCT.md`, `MVP_PLAN.md`
- Agent instructions: `AGENTS.md`
- Layout decision: `docs/adr/0001-home-dashboard-layout.md`
- Visual system: `DESIGN.md`
