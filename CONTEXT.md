# Latencymap Context

## What this is

Latencymap is a **portfolio project** built for job applications and investor presentations. It is a working demo of one-time public URL latency tests: users enter a public HTTP/S URL, the central API validates it, calls five regional probes in parallel, and returns exact measurements in a terminal-style results table with a selected-row inspector.

**Live demo:** [latencymap-six.vercel.app](https://latencymap-six.vercel.app)

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
Next.js app (Vercel) — /, /r/[id], /api/tests, /api/tests/[id]
  |
  +--> 5 regional Cloudflare Worker probes (parallel)
  |         |
  |         v
  |    target public URL
  |         |
  |         v
  |    measure + return metadata
  |
  +--> merge results → share link in /r/[id] (no database)
```

### Four components

1. **Frontend** — URL input, results table, row inspector, share button
2. **Central server (Vercel)** — validate URL, rate limit, fan-out, merge results
3. **Regional probes (Workers)** — five edge programs that measure latency per region
4. **Share links** — full test run encoded in the URL path

## Key constraints

- Only `http://` and `https://` URLs with SSRF protections on every fetch path.
- No accounts, billing, scheduled monitoring, or custom headers in the MVP.
- Production probe configuration via `PROBE_WORKERS_SUBDOMAIN` and `PROBE_SECRET`; Vercel fans out directly to five regional Workers (no coordinator, no database).
- Measurement stability: 3 warmups + 3 timed samples per region; slowest spike dropped; rounded to 10 ms.
- Anonymous rate limit: 10 test runs/hour/IP, max 5 probes per run.
- Latency colors: green `<150 ms`, yellow `150-300 ms`, red `>300 ms`, gray failed.

## Presenting this project

- **Live demo:** https://latencymap-six.vercel.app — paste a public URL → Run Test → table, inspector, share link (~60–90 s).
- **Engineering depth:** `lib/url-safety.ts`, `lib/probe-fetch.ts`, `lib/probe-response.ts`, `lib/share-payload.ts`, `probes/cloudflare/src/worker.ts`.
- **Business angle:** wedge into API latency visibility; natural expansion to monitoring, teams, and more regions (not built yet).

## Related docs

- Portfolio pitch: `docs/PORTFOLIO.md`
- Plain-language guide: `public/docs/html/index.html` (served at `/docs/html/` in production)
- Product scope: `PRODUCT.md`, `MVP_PLAN.md`
- Agent instructions: `AGENTS.md`
- Layout decision: `docs/adr/0001-home-dashboard-layout.md`
- Visual system: `DESIGN.md`
