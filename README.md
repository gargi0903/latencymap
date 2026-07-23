# Latencymap

A portfolio/demo MVP for testing a public API or website from multiple probe regions and showing the results on a 3D globe.

## Stack

- Next.js app and route handlers
- URL-encoded share links (no database required)
- Cloudflare Worker probe services
- local Node.js probe service for development only
- `react-globe.gl` for the interactive globe

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

Tests require `PROBE_ENDPOINTS`. The app does not show fake regional data when probes are missing.
`npm run dev:local` supplies a single local probe endpoint when `PROBE_ENDPOINTS` is not already set. Use `npm run dev` when you want to run only the Next.js app against separately managed probes.

## Environment

Copy `.env.example` to `.env.local` and fill values as needed.

```txt
PROBE_ENDPOINTS=
PROBE_SECRET=
```

`PROBE_ENDPOINTS` is a JSON array:

```json
[
  {
    "id": "us-east",
    "label": "US East",
    "lat": 39.0438,
    "lng": -77.4874,
    "endpoint": "https://example-probe-us-east.com/probe"
  }
]
```

For local development, run one or more probe services yourself and point `PROBE_ENDPOINTS` at them. A single local probe is useful for testing the flow, but it is not regional latency data.

For real MVP data, deploy 3-5 Cloudflare Worker probe environments and set `PROBE_ENDPOINTS` to those `/probe` URLs. A ready-to-edit 5-region template lives in `probes/regions.example.json`.

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

Use one Worker environment per intended probe region. `probes/cloudflare/wrangler.jsonc` defines five environments:

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

The UI stores and displays `cloudflare_colo` beside the configured region label today. `execution_colo` is available in probe JSON for operators and future UI work.

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

### Coordinator Worker (recommended for Vercel)

When Vercel calls each regional `/probe` URL directly, ingress often lands in one Cloudflare colo (for example `IAD`), so every probe can report the same `cloudflare_colo` even though each Worker has targeted placement.

Deploy the coordinator Worker after the five regional Workers are live. It accepts one `POST /probe` request, fans out to regional Workers through Service Bindings, and returns aggregated regional results.

```bash
npm run probe:cf:deploy:coordinator
```

Set this in Vercel alongside the existing probe metadata:

```bash
PROBE_COORDINATOR_ENDPOINT=https://latencymap-probe-coordinator.<your-workers-subdomain>.workers.dev/probe
```

`PROBE_ENDPOINTS` remains required for region labels and globe coordinates. When `PROBE_COORDINATOR_ENDPOINT` is set, the app calls the coordinator once instead of calling each regional endpoint directly. Direct regional `/probe` URLs continue to work for debugging and backwards compatibility.

Deploy the coordinator secret separately:

```bash
npx wrangler secret put PROBE_SECRET --config probes/cloudflare/wrangler.jsonc --env coordinator
```

After deployment, set `PROBE_ENDPOINTS` in Vercel or `.env.local` to the JSON array from `probes/regions.example.json`, replacing `<your-workers-subdomain>` with your actual Workers subdomain.

Example:

```json
[
  {
    "id": "iad",
    "label": "US East (Ashburn)",
    "lat": 39.0438,
    "lng": -77.4874,
    "endpoint": "https://latencymap-probe-iad.<your-workers-subdomain>.workers.dev/probe"
  }
]
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
| `PROBE_ENDPOINTS` | Yes | Single-line JSON array from `probes/regions.example.json` with real Worker URLs. |
| `PROBE_COORDINATOR_ENDPOINT` | No | When set, Vercel calls this `/probe` URL once and the coordinator fans out to regional Workers via Service Bindings. |
| `PROBE_SECRET` | Yes | Same value deployed to every Cloudflare probe. |

No database is required. Share links encode the full test run in `/r/<token>`.

`PROBE_ENDPOINTS` must be valid JSON on one line in Vercel. Copy from `probes/regions.example.json`, replace `<your-workers-subdomain>`, and minify if needed.

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

Open the returned `sharePath` (or `/r/<token>`) and confirm regional probe results appear on the globe and table.

### Production checklist

- [ ] `PROBE_SECRET` set in Vercel and all five Cloudflare environments
- [ ] `PROBE_ENDPOINTS` points at deployed `/probe` URLs (not localhost)
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
- request timeout is 5 seconds
- response body reads are capped
- anonymous test runs are rate limited (in-memory per serverless instance)
