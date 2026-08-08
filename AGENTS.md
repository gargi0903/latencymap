# AGENTS.md

## Project

Latencymap is a portfolio/demo MVP for testing public API or website latency from multiple real probe regions and visualizing results in a terminal-style dashboard.

Use this file as the source of truth for product, architecture, and implementation decisions.

## Product Direction

- Build a developer-tool dashboard, not a marketing landing page.
- The first screen must be the usable latency test tool.
- Primary audience: backend/API developers checking public APIs.
- Secondary supported use cases: startup founders checking websites and general users checking public HTTP/S URLs.
- Keep MVP scope limited to one-time tests, saved results via share links, and shareable result pages.
- Do not add accounts, billing, scheduled monitoring, alerts, badges, arbitrary HTTP methods, or custom request headers unless explicitly requested.

## Stack Direction

- Use Next.js on Vercel for the frontend and central API route handlers.
- Use URL-encoded share links for result persistence (no database required).
- Deploy the application on Vercel.
- Deploy probes and supporting edge services on Cloudflare.
- Use Cloudflare Workers for regional probes with a provider-agnostic HTTP interface.
- Use Wrangler JSON config and named Worker environments for probe regions.
- Use a terminal-style regional results table with a selected-row inspector.
- Prefer simple, explicit code over premature abstractions.

## UI System

- The current UI uses custom terminal-style components in `components/` and CSS in `app/styles.css`.
- Tailwind CSS is available for utility classes where helpful (`app/layout.tsx`).
- Keep project-specific custom components for domain surfaces such as probe results, latency summaries, and share-page composition. Split only when a module is reused across pages, owns a substantial page experience, or is independently tested — avoid unjustified micro-splits.
- Do not turn this into a generic component-library showcase. The UI should stay dense, clean, technical, and readable.
- Avoid marketing hero layouts. Keep the dashboard/tool experience as the first viewport.
- Exact probe numbers must remain available in the results table and selected-row inspector.
- Use clear region labels, timestamps, status codes, Cloudflare colo values, and latency units.
- Failed probes must be visually distinct from slow probes.
- Use the latency color contract:
  - green: `<150 ms`
  - yellow: `150-300 ms`
  - red: `>300 ms`
  - gray: failed

## Architecture

```txt
Browser
  → Next.js on Vercel (validate URL, rate limit, fan-out)
  → 5 × Cloudflare Worker probes (parallel)
  → target public URL
  → merge results → encode share link → dashboard
```

- Central API routes validate and normalize URLs, rate limit anonymous users, call probes in parallel, encode runs into share links, and return results to the UI.
- Probe endpoints fetch the target URL with strict limits and return timing/status metadata only.
- Keep the probe HTTP contract provider-agnostic even when the implementation is Cloudflare Workers.
- Do not switch workers to Fly.io, Render, Railway, or another compute provider unless explicitly requested.
- Use Cloudflare Worker placement hints where available.
- Expose actual `request.cf.colo` in probe results so the UI remains honest about where Cloudflare executed the request.

## Probe Contract

Each probe should expose:

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
  "region": "sin",
  "placement_region": "aws:ap-southeast-1",
  "cloudflare_colo": "SIN",
  "total_ms": 184,
  "status_code": 200,
  "error": null
}
```

Also keep:

```txt
GET /healthz
```

## URL Safety And Abuse Protection

Any implementation that fetches user-provided URLs must:

- allow only `http://` and `https://`
- reject embedded credentials
- block localhost names and loopback IPs
- block private/internal IPv4 ranges
- block private/internal IPv6 ranges
- block link-local and cloud metadata IPs such as `169.254.169.254`
- validate DNS-resolved targets where practical
- validate every redirect target before following it
- cap redirects at 3
- set short timeouts, currently 12 seconds per probe measurement budget
- cancel/discard response bodies after headers (do not store them)
- cap inbound probe request bodies (16 KiB)
- avoid storing response bodies
- avoid allowing user-supplied headers in the MVP
- rate limit anonymous users

Recommended anonymous limit:

```txt
10 test runs/hour/IP
each test run: max 5 probe requests
```

## URL Normalization

History (if added later) should group by normalized full URL.

- Lowercase scheme and host.
- Remove URL fragments.
- Preserve path.
- Preserve query string.
- Remove default ports: `:443` for HTTPS and `:80` for HTTP.
- Only remove trailing slash for the root path.

Treat these as different URLs:

```txt
https://api.example.com/users
https://api.example.com/users?limit=10
https://api.example.com/health
```

## Implementation Notes

- Use TypeScript strictness in app code.
- Prefer shared types from `lib/types.ts` when crossing API, storage, and UI boundaries.
- Keep route handlers small and push reusable validation/probe/storage behavior into `lib/`.
- Never store fetched response bodies.
- Do not show fake regional data when probe configuration is missing.
- `PROBE_WORKERS_SUBDOMAIN` and `PROBE_SECRET` are required for real regional tests; Vercel derives Worker URLs from the subdomain and region metadata in `lib/regions.ts`.
- Regional measurement uses Cloudflare Workers only (no separate local measurement server).
- Maintain stateless share links that encode full test runs in the URL.
- Preserve existing user changes in the working tree. Do not revert unrelated files.

## Validation Commands

Run the smallest relevant checks for the change. Common commands:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

For local app testing:

```bash
npm run dev
```

For Cloudflare Worker development:

```bash
npm run workers:dev
```

## Collaboration Notes

- When decisions are missing, continue the design interview one question at a time and include a recommended answer.
- When a reasonable MVP-safe default exists, choose it and document the assumption.
- Explain tradeoffs briefly when changing product scope, security behavior, deployment shape, or UI system conventions.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `gargi0903/latencymap`.

### Loopy

Use Loopy for repeatable AI-agent workflows: discover loop opportunities in code or threads, find published loops from [Loop Library](https://signals.forwardfuture.com/loop-library/), audit or repair an existing loop, craft a new bounded loop, run one with an evidence receipt, debrief completed runs, or prepare a loop for publication.

- Saved project loops live in root `LOOPS.md` when the user asks to keep one
- Installing Loopy does not grant runtime permissions or authorize consequential actions
