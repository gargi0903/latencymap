# Latencymap

Test any public HTTP/S URL from five real global regions in parallel. See exact latency in a terminal-style dashboard and share results with a link — **no database, no account**.

**Live demo:** [latencymap-six.vercel.app](https://latencymap-six.vercel.app)

Built as a portfolio project to show full-stack engineering: Next.js on Vercel, regional probes on Cloudflare Workers, SSRF-safe URL fetching, and a deliberately scoped MVP.

## What it does

1. Paste a public URL (for example `https://api.example.com`).
2. The app validates the URL, rate-limits the request, and calls **five regional probes in parallel**.
3. Each probe measures GET latency from its region and returns status code, milliseconds, and where Cloudflare actually ran the request.
4. Results appear in a color-coded table. Click any row to inspect details.
5. Copy a **share link** (`/r/...`) that encodes the full test run. Anyone with the link sees the same results.

### Probe regions

| Region ID | Location |
| --- | --- |
| `iad` | US East (Ashburn) |
| `lhr` | Europe West (London) |
| `sin` | Asia Southeast (Singapore) |
| `syd` | Australia East (Sydney) |
| `gru` | South America (São Paulo) |

## Architecture

```txt
Browser
  → Next.js on Vercel (validate URL, rate limit, fan-out)
  → 5 × Cloudflare Worker probes (parallel)
  → target public URL
  → merge results → encode share link → dashboard
```

### Four components

| Component | Role |
| --- | --- |
| **Frontend** | URL input, results table, row inspector, share button |
| **Central server (Vercel)** | Validates URL, calls all probes, merges results |
| **Regional probes (Workers)** | Five edge programs that measure latency per region |
| **Share links** | Full test run encoded in `/r/[token]` — no database |

### Design choices

- **Stateless share links** — The full test run is packed into the URL path. No Postgres, Redis, or server-side history.
- **Direct fan-out** — Vercel calls five regional Workers in parallel (no coordinator, no database).
- **Honest regional metadata** — Placement is a hint; the UI shows actual `cloudflare_colo` from each probe.
- **Stable latency** — Three warmups plus three timed samples per region; slowest spike dropped; rounded to 10 ms.
- **SSRF protection** — URL validation and DNS checks on the API and every probe before fetch.

Latency colors: green `<150 ms`, yellow `150–300 ms`, red `>300 ms`, gray = failed.

## Quick start

```bash
npm install
cp .env.example .env.local   # set PROBE_WORKERS_SUBDOMAIN and PROBE_SECRET
npm run dev:local
```

Open [http://localhost:3000](http://localhost:3000).

`dev:local` starts the Next.js app. Set `PROBE_WORKERS_SUBDOMAIN` and `PROBE_SECRET` to run real regional tests against deployed Workers.

### Common commands

| Command | What it does |
| --- | --- |
| `npm run dev:local` | Next.js app (recommended) |
| `npm run dev:app` | Next.js only |
| `npm run probe:cf:dev` | Cloudflare Worker via Wrangler |
| `npm run test` | Run Vitest unit tests |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

## Project layout

```txt
app/                      Next.js pages and API routes
  page.tsx                Home dashboard
  r/[id]/page.tsx         Shareable result page
  api/tests/              POST run test (share page decodes /r/[id])

components/               Terminal-style UI (dashboard, table, inspector)
lib/                      Shared logic (probes, URL safety, share encoding, rate limit)
  probe-response.ts       Map probe wire format → ProbeResult
  share-payload.ts        Encode/decode share tokens
  url-safety.ts           Central API SSRF validation
  probe-fetch.ts          Shared measurement algorithm (warmups + samples)
probes/
  cloudflare/             Regional Workers (5 environments)
docs/                     Product, design, portfolio, and architecture docs
public/docs/html/         Plain-language docs (served at /docs/html/ when deployed)
scripts/                  Dev and deploy helpers
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PROBE_WORKERS_SUBDOMAIN` | Yes | Your Workers subdomain (e.g. `latencymap-gargi.workers.dev`) |
| `PROBE_SECRET` | Yes | Shared secret between the app and all Workers |

Production probe URLs are derived from `PROBE_WORKERS_SUBDOMAIN` and region metadata in `lib/probe-regions.ts`:

```txt
https://latencymap-probe-{regionId}.{PROBE_WORKERS_SUBDOMAIN}/probe
```

Copy `.env.example` to `.env.local` for local development. Set the same variables in **Vercel project settings** for production — `.env.local` does not affect the deployed app.

## Production deployment

### 1. Deploy Cloudflare probes

Set the same `PROBE_SECRET` on every Worker environment, then deploy all five regions:

```bash
npm run probe:cf:secrets:set
npm run probe:cf:deploy:regions
```

Verify:

```bash
curl https://latencymap-probe-iad.<your-subdomain>/healthz
```

### 2. Configure Vercel

Set `PROBE_WORKERS_SUBDOMAIN` and `PROBE_SECRET` in the Vercel project settings, then redeploy.

Print the env block after deploy:

```bash
npm run probe:cf:print-env -- <your-workers-subdomain>
```

### 3. Deploy the app

Connect the repo in the Vercel dashboard, or:

```bash
npx vercel --prod
```

### 4. Smoke test

```bash
curl -X POST https://<your-domain>/api/tests \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}'
```

Open the returned `sharePath` and confirm regional results appear.

## Safety

User-provided URLs are validated on the API and every probe:

- HTTP/HTTPS only, no embedded credentials
- Blocks localhost, private IPs, and cloud metadata endpoints
- DNS resolution checked before fetch
- Re-validates redirect targets (max 3 redirects)
- 12-second timeout per probe; response body cancelled (not stored)
- Inbound probe request body capped at 16 KiB
- Rate limited: 10 test runs/hour/IP, max 5 probes per run
- Probes protected with shared `x-probe-secret` header

## Stack

| Layer | Technology |
| --- | --- |
| Frontend + API | Next.js 15, React 19, TypeScript |
| Hosting | Vercel |
| Probes | Cloudflare Workers, Wrangler |
| Tests | Vitest |
| Styling | Custom terminal CSS + Tailwind |

## What's not in this MVP

No accounts, billing, scheduled monitoring, alerts, custom headers, arbitrary HTTP methods, or server-side history. See [`docs/MVP_PLAN.md`](docs/MVP_PLAN.md) for scope boundaries.

## More documentation

| Doc | For |
| --- | --- |
| [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) | Deep technical overview and source file map |
| [`docs/PORTFOLIO.md`](docs/PORTFOLIO.md) | Interview pitch, demo script, talking points |
| [`docs/MVP_PLAN.md`](docs/MVP_PLAN.md) | Product scope and MVP boundaries |
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | Product definition |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Visual system |
| [`public/docs/html/index.html`](public/docs/html/index.html) | Plain-language guide (live at `/docs/html/`) |
| [`CONTEXT.md`](CONTEXT.md) | Short project context and vocabulary |
| [`AGENTS.md`](AGENTS.md) | Agent and contributor instructions |
