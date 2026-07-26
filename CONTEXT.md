# Latencymap Context

## What this is

Latencymap is a **portfolio project** built for job applications and investor presentations. It is a working demo of one-time public URL latency tests: users enter a public HTTP/S URL, the central API validates it, calls five regional probes in parallel, and returns exact measurements in a terminal-style results table with a selected-row inspector.

Use [`docs/PORTFOLIO.md`](docs/PORTFOLIO.md) for pitch scripts, demo flow, and how to frame the project in interviews vs VC conversations.

## Core vocabulary

- **Evidence surface**: Regional results table, selected-row inspector, and share link shown after a test completes.
- **Equal evidence**: Every row in the table is backed by a real probe response. The UI never shows fake regional coverage.
- **First-run screen**: Terminal boot sequence, URL form, and concise safety copy before any test runs.
- **Row inspector**: Detail panel for the selected probe result — latency, HTTP status, region, Cloudflare colo, placement hint, and timestamp.
- **Clean technical workspace**: Dense, readable developer-tool UI with cobalt command accents and mineral operational surfaces.

## Architecture

```txt
Browser
  |
  v
Next.js app (Vercel) — /, /r/[token], /api/tests, /api/tests/[token]
  |
  +--> 5 regional Cloudflare Worker probes (parallel)
  |         |
  |         v
  |    target URL
  |
  +--> share links: base64-encoded results in /r/[token] (no database)
```

## Key constraints

- Only `http://` and `https://` URLs with SSRF protections on every fetch path.
- No accounts, billing, scheduled monitoring, or custom headers in the MVP.
- Production probe configuration via `PROBE_WORKERS_SUBDOMAIN` and `PROBE_SECRET`; Vercel fans out directly to five regional Workers; region metadata is committed in `lib/probe-regions.ts`.
- Anonymous rate limit: 10 test runs/hour/IP, max 5 probes per run.
- Latency colors: green `<150 ms`, yellow `150-300 ms`, red `>300 ms`, gray failed.

## Presenting this project

- **Live demo:** paste a public URL → Run Test → walk through table, inspector, share link (~60–90 s).
- **Engineering depth:** `lib/url-safety.ts`, `lib/probe-fetch.ts`, `lib/share-payload.ts`, `probes/cloudflare/src/worker.ts`.
- **Business angle:** wedge into API latency visibility; natural expansion to monitoring, teams, and more regions (not built yet).

## Related docs

- Portfolio pitch: `docs/PORTFOLIO.md`
- Plain-language guide: `public/docs/html/index.html` (served at `/docs/html/` in production)
- Product scope: `PRODUCT.md`, `MVP_PLAN.md`
- Agent instructions: `AGENTS.md`
- Layout decision: `docs/adr/0001-home-dashboard-layout.md`
- Visual system: `DESIGN.md`
