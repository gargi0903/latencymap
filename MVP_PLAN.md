# Latencymap MVP Plan

## Product Goal

Build a portfolio-quality demo that proves the core idea:

> Enter a public URL, test it from multiple real probe regions, show latency results, and generate a shareable result page.

Optimize for low cost, simple architecture, and a credible demo. This is not a full monitoring SaaS yet.

## Primary Audience

Primary user: backend/API developers checking their own public APIs.

Secondary supported use cases:
- startup founders checking public website latency
- general users testing public HTTP/HTTPS URLs

Positioning should stay API-first, even though websites are allowed.

## MVP Scope

Included:
- one-time manual latency tests
- any public `http://` or `https://` URL
- real probes in 3-5 regions
- shareable public result page (URL-encoded payload, no database)
- developer-tool terminal dashboard UI
- regional results table with selected-row inspector

Excluded for MVP:
- user accounts
- scheduled monitoring
- alerting
- billing
- team dashboards
- README badges
- 20+ regions
- full P50/P95/P99 monitoring
- arbitrary HTTP methods
- custom request headers
- server-side history or database persistence

## User Flow

```txt
Home page
  -> user enters a public URL
  -> clicks Run Test
  -> backend validates URL
  -> backend calls probes in parallel
  -> user sees regional results table + inspector
  -> user can copy/open a shareable result URL
```

## Recommended Tech Stack

Frontend and central backend:
- Next.js on Vercel
- Next.js route handlers for backend API

Database:
- none required; share links encode the full test run in the URL path

Probe service:
- Cloudflare Workers for production regional probes
- local Node.js probe for development flow testing only

3D map:
- deferred; current UI uses a terminal-style results table

## Architecture

```txt
Next.js app on Vercel
  /
  /r/[token]
  /api/tests
  /api/tests/[token]
        |
        v
Regional probe endpoints
```

## API Shape

Central backend:

```txt
POST /api/tests
GET /api/tests/:token
```

`:token` is a base64url-encoded share payload, not a database id.

Probe service:

```txt
POST /probe
```

Probe input:

```json
{
  "url": "https://api.example.com"
}
```

Probe output:

```json
{
  "region": "sin",
  "placement_region": "aws:ap-southeast-1",
  "cloudflare_colo": "SIN",
  "total_ms": 184,
  "status_code": 200,
  "error": null
}
```

Probe configuration:

```txt
PROBE_COORDINATOR_ENDPOINT=https://latencymap-probe-coordinator.<subdomain>.workers.dev/probe
PROBE_SECRET=<shared secret>
```

Region metadata (id, label, lat, lng) is committed in `lib/probe-regions.ts`.

## Probe Behavior

Use `GET` with strict limits.

Rules:
- allow only `http://` and `https://`
- timeout after 12 seconds per probe measurement budget
- follow max 3 redirects
- validate each redirect target before following
- do not store response body
- read only a tiny amount of response body, or stop after headers if practical
- return total request time, status code, and error

MVP timing data:
- `region`
- `total_ms`
- `status_code`
- `error`
- `tested_at`

Skip for MVP:
- DNS timing
- TCP timing
- TLS timing
- download timing
- browser page performance metrics

## URL Normalization

Share links preserve the normalized full URL inside the encoded payload.

Normalization rules:
- lowercase scheme and host
- remove URL fragments
- preserve path
- preserve query string
- remove default ports: `:443` for HTTPS, `:80` for HTTP
- only remove trailing slash for the root path

Examples treated as different URLs:

```txt
https://api.example.com/users
https://api.example.com/users?limit=10
https://api.example.com/health
```

## Abuse Protection

This must exist from day one because the app asks your servers to request user-provided URLs.

Protections:
- block `localhost`
- block `127.0.0.1`
- block `0.0.0.0`
- block private IPv4 ranges:
  - `10.0.0.0/8`
  - `172.16.0.0/12`
  - `192.168.0.0/16`
- block link-local/cloud metadata IPs, especially `169.254.169.254`
- block unsupported schemes like `file:`, `ftp:`, `ssh:`
- allow only HTTP and HTTPS
- limit redirects to 3
- validate every redirect target
- use 12 second probe measurement budget
- cap response bytes
- rate limit by IP
- do not allow custom headers in MVP
- do not allow arbitrary HTTP methods in MVP

Recommended anonymous rate limit:

```txt
10 test runs/hour/IP
each test run: max 5 probe requests
```

## UI Direction

Use a developer-tool dashboard style.

The first screen should be the actual tool, not a marketing landing page.

Layout:

```txt
Terminal-style prompt
URL input
Regional results table in fixed probe order
Selected-row inspector with status, colo, placement, and timestamp
Share link action
```

Results behavior:
- keep countries in stable probe-region order
- color latency values with the latency contract
- show exact probe metadata in the selected-row inspector
- failed probes shown distinctly

Latency colors:

```txt
green  = <150 ms
yellow = 150-300 ms
red    = >300 ms
gray   = failed
```

## Resolved Implementation Notes

- Probe hosting: Cloudflare Workers with one environment per region (`iad`, `lhr`, `sin`, `syd`, `gru`).
- Persistence: URL-encoded share links via `lib/share-payload.ts` (no database).
- Rate limiting: in-memory buckets per serverless instance.
- Probe env vars: `PROBE_COORDINATOR_ENDPOINT` and `PROBE_SECRET`; region metadata in `lib/probe-regions.ts`.
- UI results: terminal dashboard with a shared `ProbeResultsPanel` for dashboard and share pages.
