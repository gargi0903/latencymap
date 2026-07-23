# Latencymap

A portfolio/demo MVP for testing a public API or website from multiple probe regions and showing honest regional latency results in a terminal-style dashboard.

## Stack

- Next.js app and route handlers
- URL-encoded share links (no database required)
- Cloudflare Worker probe services
- local Node.js probe service for development only

## Local Development

Install dependencies:

```bash
npm install
```

Run the app and a local development probe together:

```bash
npm run dev:local
```

Open:

```txt
http://localhost:3000
```

Tests require `PROBE_SECRET`. In production, also set `PROBE_COORDINATOR_ENDPOINT`.
`npm run dev:local` starts the Next.js app and a single local probe with no extra env setup.
Use `npm run dev:app` when you only want the Next.js app and will run probes separately.

## Environment

Copy `.env.example` to `.env.local` and fill values as needed.

```txt
PROBE_COORDINATOR_ENDPOINT=
PROBE_SECRET=
```

Production region metadata (labels and coordinates) is committed in `lib/probe-regions.ts`.
In production, the app calls the coordinator Worker once and maps results onto those regions.

For local development, run the local Node probe. A single local region is enough to test the flow, but it is not regional latency data.

## Probe Service

Run the local probe:

```bash
npm run probe:dev
```

The probe exposes:

```txt
POST /probe
```

Input:

```json
{
  "url": "https://api.example.com"
}
```

Output:

```json
{
  "region": "local",
  "placement_region": null,
  "cloudflare_colo": null,
  "execution_colo": null,
  "total_ms": 184,
  "status_code": 200,
  "error": null
}
```

Set a region label when deploying:

```bash
PROBE_REGION=us-east PORT=8787 npm run probe:dev
```

Both probe implementations expose a lightweight health check:

```txt
GET /healthz
```

## Regional Probe Deployment

The application deploys on Vercel. Probes deploy on Cloudflare Workers.

Use one Worker environment per intended probe region. `probes/cloudflare/wrangler.jsonc` defines five environments aligned with `lib/probe-regions.ts`:

- `iad`: targeted near `aws:us-east-1`
- `lhr`: targeted near `aws:eu-west-2`
- `sin`: targeted near `aws:ap-southeast-1`
- `syd`: targeted near `aws:ap-southeast-2`
- `gru`: targeted near `aws:sa-east-1`

Cloudflare Worker placement hints choose a Cloudflare data center close to the configured infrastructure region. They are not a guarantee that the Worker executed in the exact city label.

The probe exposes two colo fields so callers can distinguish ingress from execution:

| Field | Meaning |
| --- | --- |
| `cloudflare_colo` | Ingress colo from `request.cf.colo`: where the caller's request entered Cloudflare. When the central API on Vercel calls a probe, this is often the Vercel-to-Cloudflare entry point (for example `IAD`), not the probe's configured region. |
| `execution_colo` | Where the Worker actually executed the outbound fetch. Prefer `response.cf.colo` from the measured subrequest when available; otherwise infer from a lightweight `https://cloudflare.com/cdn-cgi/trace` fetch. |

`GET /healthz` also returns a `diagnostics` object with `trace_ms`, `trace_colo`, `ingress_colo`, and `source` (`trace` or `subrequest`) to help verify placement without running a full probe.

The UI shows each region's latency, HTTP status, Cloudflare colo values, placement region, and test timestamp in the selected-row inspector.

Run the Cloudflare Worker probe locally with Wrangler:

```bash
npm run probe:cf:dev
```

Deploy one environment:

```bash
npm run probe:cf:deploy:iad
```

Deploy all configured environments:

```bash
npm run probe:cf:deploy:regions
```

### Coordinator Worker (required for Vercel)

When Vercel calls each regional `/probe` URL directly, ingress often lands in one Cloudflare colo (for example `IAD`), so every probe can report the same `cloudflare_colo` even though each Worker has targeted placement.

Deploy the coordinator Worker after the five regional Workers are live. It accepts one `POST /probe` request, fans out to regional Workers through Service Bindings, and returns aggregated regional results.

```bash
npm run probe:cf:deploy:coordinator
```

Set this in Vercel:

```bash
PROBE_COORDINATOR_ENDPOINT=https://latencymap-probe-coordinator.<your-workers-subdomain>.workers.dev/probe
```

Print the exact production env block after deploy:

```bash
npm run probe:cf:print-env -- <your-workers-subdomain>
```

Deploy the coordinator secret separately:

```bash
npx wrangler secret put PROBE_SECRET --config probes/cloudflare/wrangler.jsonc --env coordinator
```

Or set the secret on every environment in one pass:

```bash
npm run probe:cf:secrets:set
```

Probe authentication is required. Set the same non-empty `PROBE_SECRET` in the Vercel app and every Cloudflare Worker environment before running or deploying probes:

```bash
npx wrangler secret put PROBE_SECRET --config probes/cloudflare/wrangler.jsonc --env iad
```

Repeat the secret command for each deployed environment.

## Production Deployment

### Prerequisites

- Vercel account linked to this repository
- Cloudflare account with Wrangler authenticated (`npx wrangler login`)

### 1. Deploy Cloudflare probes

Generate a strong shared secret and store it in every Worker environment:

```bash
# Repeat for iad, lhr, sin, syd, gru
npx wrangler secret put PROBE_SECRET --config probes/cloudflare/wrangler.jsonc --env iad
```

Deploy all five regional probes:

```bash
npm run probe:cf:deploy:regions
```

Verify health checks (replace subdomain as needed):

```bash
curl https://latencymap-probe-iad.<your-workers-subdomain>.workers.dev/healthz
```

### 2. Configure Vercel environment variables

In the Vercel project settings, set:

| Variable | Required | Notes |
| --- | --- | --- |
| `PROBE_COORDINATOR_ENDPOINT` | Yes | Coordinator `/probe` URL. Required in production. |
| `PROBE_SECRET` | Yes | Same value deployed to every Cloudflare probe. |

No database is required. Share links encode the full test run in `/r/<token>`.

Use `npm run probe:cf:print-env -- <your-workers-subdomain>` to print the production env block.

### 3. Deploy the Next.js app

```bash
npx vercel link
npx vercel env pull .env.local   # optional: sync env for local prod-like testing
npx vercel --prod
```

Or connect the GitHub repository in the Vercel dashboard and deploy from `main`.

`vercel.json` enables Fluid Compute, `iad1` region, and function timeouts. The app uses standard Next.js App Router routes:

- `/` — latency test dashboard
- `/api/tests` — `POST` to run a test
- `/api/tests/[token]` — `GET` decoded share payload JSON
- `/r/[token]` — shareable result page (base64url-encoded payload)

### 4. Smoke test production

```bash
curl -X POST https://<your-vercel-domain>/api/tests \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}'
```

Open the returned `sharePath` (or `/r/<token>`) and confirm regional probe results appear in the table and inspector.

### Production checklist

- [ ] `PROBE_SECRET` set in Vercel and all six Cloudflare environments
- [ ] `PROBE_COORDINATOR_ENDPOINT` points at the deployed coordinator `/probe` URL
- [ ] All probe `/healthz` endpoints return `ok: true`
- [ ] `npm run build` passes locally
- [ ] Test run succeeds from the production dashboard

## Safety

User-provided URLs are validated before fetches:

- only HTTP and HTTPS
- no embedded credentials
- no localhost
- no private/internal IPs
- no cloud metadata IPs
- redirect targets are re-validated
- request timeout is 12 seconds per probe measurement budget
- response body reads are capped
- anonymous test runs are rate limited (in-memory per serverless instance)
