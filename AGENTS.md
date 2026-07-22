# AGENTS.md

## Project

Latencymap is a portfolio/demo MVP for testing public API or website latency from multiple real probe regions and visualizing results on a 3D globe.

Always read `MVP_PLAN.md` before making product, architecture, or implementation decisions. If this file and `MVP_PLAN.md` conflict, preserve the current explicit user direction in this file and update `MVP_PLAN.md` only when asked.

## Product Direction

- Build a developer-tool dashboard, not a marketing landing page.
- The first screen must be the usable latency test tool.
- Primary audience: backend/API developers checking public APIs.
- Secondary supported use cases: startup founders checking websites and general users checking public HTTP/S URLs.
- Keep MVP scope limited to one-time tests, saved results, history by normalized URL, and share links.
- Do not add accounts, billing, scheduled monitoring, alerts, badges, arbitrary HTTP methods, or custom request headers unless explicitly requested.

## Stack Direction

- Use Next.js on Vercel for the frontend and central API route handlers.
- Use Neon Postgres for persistence when `DATABASE_URL` is configured.
- Keep local JSON storage for development without a database.
- Deploy the application on Vercel.
- Deploy probes and supporting edge services on Cloudflare.
- Use Cloudflare Workers for regional probes with a provider-agnostic HTTP interface.
- Use Wrangler JSON config and named Worker environments for probe regions.
- Use `react-globe.gl` for the interactive 3D globe.
- Use `lucide-react` icons.
- Prefer simple, explicit code over premature abstractions.

## UI System

- `shadcn/ui` and Tailwind CSS are the default UI system for this project.
- Use prebuilt `shadcn/ui` components for common UI primitives because they are extensible, modular, and easy to customize.
- Use `components.json` as the source of truth for shadcn setup: New York style, RSC enabled, TSX, Tailwind CSS variables, `slate` base color, lucide icons, and `@/components/ui` aliases.
- Add or reuse shadcn components for primitive UI needs such as buttons, inputs, tables, dialogs, tooltips, tabs, dropdowns, forms, alerts, and toasts.
- Keep project-specific custom components for domain surfaces such as the globe, probe markers, latency summaries, result history, and share-page composition.
- Do not turn this into a generic component-library showcase. The UI should stay dense, clean, technical, and readable.
- Avoid marketing hero layouts. Keep the dashboard/tool experience as the first viewport.
- Exact probe numbers must remain visible in a table beside the globe.
- The 3D globe should show honest probe markers, not a fake heatmap.
- Use clear region labels, timestamps, status codes, Cloudflare colo values, and latency units.
- Failed probes must be visually distinct from slow probes.
- Use the latency color contract:
  - green: `<150 ms`
  - yellow: `150-300 ms`
  - red: `>300 ms`
  - gray: failed

## Architecture

```txt
Next.js app on Vercel
  /
  /r/[id]
  /api/tests
  /api/tests/[id]
        |
        v
Neon Postgres or local development storage
        |
        v
Regional probe endpoints
```

- Central API routes validate and normalize URLs, rate limit anonymous users, call probes in parallel, persist runs, and return saved results.
- Probe endpoints fetch the target URL with strict limits and return timing/status metadata only.
- Keep the probe HTTP contract provider-agnostic even when the implementation is Cloudflare Workers.
- Do not switch probes to Fly.io, Render, Railway, or another compute provider unless explicitly requested.
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
- set short timeouts, currently 5 seconds
- cap response bytes
- avoid storing response bodies
- avoid allowing user-supplied headers in the MVP
- rate limit anonymous users

Recommended anonymous limit:

```txt
10 test runs/hour/IP
each test run: max 5 probe requests
```

## URL Normalization

History should group by normalized full URL.

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
- Do not show fake regional data when `PROBE_ENDPOINTS` is missing.
- Keep local development behavior honest: a local probe is useful for flow testing, not real regional latency.
- Maintain compatibility with both Neon-backed persistence and local JSON development storage unless a task explicitly narrows the target.
- Preserve existing user changes in the working tree. Do not revert unrelated files.

## Validation Commands

Run the smallest relevant checks for the change. Common commands:

```bash
npm run lint
npm run typecheck
npm run build
```

For local app testing:

```bash
npm run dev:local
```

For Cloudflare probe development:

```bash
npm run probe:cf:dev
```

For local Node probe development:

```bash
npm run probe:dev
```

## Collaboration Notes

- When decisions are missing, continue the design interview one question at a time and include a recommended answer.
- When a reasonable MVP-safe default exists, choose it and document the assumption.
- Explain tradeoffs briefly when changing product scope, security behavior, deployment shape, or UI system conventions.
