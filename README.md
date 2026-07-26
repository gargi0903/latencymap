# Latencymap

Test any public HTTP/S URL from five real global regions in parallel. See exact latency in a terminal-style dashboard and share results with a link — **no database, no account**.

Built as a portfolio project to show full-stack engineering: Next.js on Vercel, regional probes on Cloudflare Workers, SSRF-safe URL fetching, and a deliberately scoped MVP.

## What it does

1. You paste a public URL (for example `https://api.example.com`).
2. The app validates the URL, rate-limits the request, and calls **five regional probes in parallel**.
3. Each probe measures GET latency from its region and returns status code, milliseconds, and where Cloudflare actually ran the request.
4. Results appear in a color-coded table. Click any row to inspect details.
5. You get a **share link** (`/r/...`) that encodes the full test run. Anyone with the link sees the same results.

### Probe regions

| Region ID | Location |
| --- | --- |
| `iad` | US East (Ashburn) |
| `lhr` | Europe West (London) |
| `sin` | Asia Southeast (Singapore) |
| `syd` | Australia East (Sydney) |
| `gru` | South America (São Paulo) |

## How it works

```txt
Browser
  → Next.js on Vercel (validate URL, rate limit, fan-out)
  → 5 × Cloudflare Worker probes in parallel
  → target public URL
  → merge results → encode share link → return to browser
```

**Two ideas worth knowing:**

- **Stateless share links** — The full test run (URL, timestamp, all probe results) is packed into the `/r/[token]` URL itself. No Postgres, no Redis, no server-side history.
- **Honest regional metadata** — Cloudflare placement is a *hint*, not a guarantee. The UI shows both the intended region and the actual `cloudflare_colo` (the data center that ran the probe).

Latency colors: green `<150 ms`, yellow `150–300 ms`, red `>300 ms`, gray = failed.

## Quick start

```bash
npm install
npm run dev:local
```

Open [http://localhost:3000](http://localhost:3000).

`dev:local` starts the Next.js app and a single local probe — enough to test the flow, but not real regional latency.

Copy `.env.example` to `.env.local` if you need custom env values. Local dev works without extra setup.

### Common commands

| Command | What it does |
| --- | --- |
| `npm run dev:local` | App + local probe (recommended) |
| `npm run dev:app` | Next.js only |
| `npm run probe:dev` | Local Node probe only |
| `npm run probe:cf:dev` | Cloudflare Worker probe via Wrangler |
| `npm run test` | Run Vitest unit tests |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build |

## Project layout

```txt
app/                  Next.js pages and API routes
  page.tsx            Home dashboard
  r/[id]/page.tsx     Shareable result page
  api/tests/          POST to run a test, GET to decode token

components/           Terminal-style UI (dashboard, results table, inspector)
lib/                  Shared logic (probes, URL safety, share encoding, rate limit)
probes/
  cloudflare/         Production regional probes (5 Worker environments)
  node/               Local dev probe only
public/docs/html/     Plain-language docs (served at /docs/html/ when deployed)
scripts/              Dev and deploy helpers
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PROBE_SECRET` | Yes (prod) | Shared secret between Vercel app and all probes |
| `PROBE_WORKERS_SUBDOMAIN` | Yes (prod) | Your Workers subdomain (e.g. `acme.workers.dev`) |

Production probe URLs are derived from `PROBE_WORKERS_SUBDOMAIN` and region metadata in `lib/probe-regions.ts`.

## Production deployment

### 1. Deploy Cloudflare probes

Set the same `PROBE_SECRET` on every Worker environment, then deploy all five regions:

```bash
npx wrangler secret put PROBE_SECRET --config probes/cloudflare/wrangler.jsonc --env iad
# repeat for lhr, sin, syd, gru — or use:
npm run probe:cf:secrets:set

npm run probe:cf:deploy:regions
```

Verify: `curl https://latencymap-probe-iad.<subdomain>.workers.dev/healthz`

### 2. Configure Vercel

Set `PROBE_WORKERS_SUBDOMAIN` and `PROBE_SECRET` in the Vercel project settings.

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
- Re-validates redirect targets (max 3 redirects)
- 12-second timeout per probe, capped response body reads
- Rate limited: 10 test runs/hour/IP, max 5 probes per run

## What's not in this MVP

No accounts, billing, scheduled monitoring, alerts, custom headers, arbitrary HTTP methods, or server-side history. See `MVP_PLAN.md` for scope boundaries.

## More documentation

| Doc | For |
| --- | --- |
| [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) | Deep technical overview and source file map |
| [`docs/PORTFOLIO.md`](docs/PORTFOLIO.md) | Interview pitch, demo script, talking points |
| [`public/docs/html/index.html`](public/docs/html/index.html) | Plain-language guide (live at `/docs/html/`) |
| [`CONTEXT.md`](CONTEXT.md) | Short project context and vocabulary |
| [`AGENTS.md`](AGENTS.md) | Agent and contributor instructions |
