# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are backend and API developers who need a quick, credible way to check how a public API or endpoint responds from multiple real probe regions.

Secondary users are startup founders checking public websites and general users testing public HTTP/S URLs. They are supported, but the product should stay API-first in language, defaults, and workflow emphasis.

## Product Purpose

Latencymap is a **portfolio project** for job applications and investor demos. It proves one-time public endpoint latency testing end-to-end: a user enters a URL, the app validates and normalizes it, runs bounded regional probe requests, and shows exact measurements in a terminal-style dashboard.

Success means a reviewer can complete the full loop in one session: enter a public URL, run the test, inspect status codes, latency values, timestamps, Cloudflare colo metadata, and open or share a permanent result page.

See `docs/PORTFOLIO.md` for elevator pitch, demo script, and interview vs VC framing.

## Positioning

Latencymap is a developer-tool dashboard, not a marketing landing page and not a monitoring SaaS. Its distinct promise is credible one-time latency evidence from real probes: exact table values, actual probe metadata, and honest regional rows instead of simulated heatmaps, customer claims, or synthetic regional coverage.

**For hiring:** demonstrates full-stack TypeScript, edge probes, SSRF-safe URL fetching, and stateless share-link design.

**For investors:** wedges into API latency visibility with near-zero database COGS; natural expansion to monitoring, teams, and alerting (not in MVP scope).

## Operating Context

The first viewport is the usable latency test tool. The main workflow is:

1. Enter a public `http://` or `https://` URL.
2. Run a one-time latency test.
3. Let the central Next.js API validate and normalize the URL, rate-limit anonymous users, call configured probes in parallel, persist the run, and return saved results.
4. Review the regional results table and selected-row inspector.
5. Optionally open a share link.

The frontend and central API route handlers run in a Next.js app intended for Vercel. Persistence uses URL-encoded share links. Probes and supporting edge services run on Cloudflare Workers with a provider-agnostic HTTP interface.

Local development uses a local Node probe for flow testing. Local probe results must be treated as development evidence only, not real regional latency.

## Capabilities and Constraints

MVP scope includes one-time manual tests and public share links.

Do not add accounts, billing, scheduled monitoring, alerts, badges, arbitrary HTTP methods, custom request headers, team dashboards, 20+ region coverage, or percentile monitoring unless explicitly requested.

Central API routes should stay small and push reusable validation, probe, rate-limit, and storage behavior into `lib/`. Shared data crossing API, storage, and UI boundaries should use `lib/types.ts`.

Probe endpoints expose:

```txt
POST /probe
GET /healthz
```

The probe response contract includes `region`, `placement_region`, `cloudflare_colo`, `total_ms`, `status_code`, and `error`. The implementation may use Cloudflare Worker placement hints where available and should expose the actual `request.cf.colo` value so the UI remains honest about execution location.

User-provided URL fetching must remain abuse-resistant:

- allow only `http://` and `https://`
- reject embedded credentials
- block localhost names and loopback IPs
- block private/internal IPv4 and IPv6 ranges
- block link-local and metadata targets such as `169.254.169.254`
- validate DNS-resolved targets where practical
- validate every redirect target before following it
- cap redirects at 3
- use short timeouts, currently 12 seconds per probe measurement budget
- cap response bytes
- never store fetched response bodies
- do not accept user-supplied headers in the MVP
- rate limit anonymous users

Recommended anonymous rate limit is 10 test runs per hour per IP, with each test run calling at most 5 probes.

History groups by normalized full URL: lowercase scheme and host, remove fragments, preserve path and query string, remove default ports, and only remove the trailing slash for the root path. Different paths or query strings are different URLs.

The UI presents a terminal-style regional results table with a selected-row inspector. Failed probes must be visually distinct from slow probes. The latency color contract is green for `<150 ms`, yellow for `150-300 ms`, red for `>300 ms`, and gray for failed.

## Brand Commitments

The product name is Latencymap.

The interface should feel like a clean, technical operating console for developer use: cobalt primary action and active state, dark ink/navy operational surfaces, crisp typography, generous whitespace around the main task, and high-contrast data. See `DESIGN.md` for the current visual system.

The initial state contains the URL input and one clear test action in a terminal-style prompt. After a successful run, reveal the regional results table, selected-row inspector, margin-of-error note, and share action. Do not add charts, filter toolbars, metric-card grids, onboarding tours, or decorative dashboard modules.

Use Tailwind CSS for styling. Keep project-specific components for domain surfaces such as probe results, latency summaries, and share-page composition.

## Evidence on Hand

- Product and architecture plan: `MVP_PLAN.md`.
- Active project instructions and scope constraints: `AGENTS.md` in the conversation context.
- App entry and dashboard surface: `app/page.tsx`, `components/latency-dashboard.tsx`, `components/results-view.tsx`, `components/probe-results-panel.tsx`, and `app/styles.css`.
- API and shared behavior: `app/api/tests/route.ts`, `app/api/tests/[id]/route.ts`, `lib/types.ts`, `lib/probes.ts`, `lib/rate-limit.ts`, `lib/url-safety.ts`, and `lib/latency-display.ts`.
- Cloudflare probe direction: `probes/cloudflare/wrangler.jsonc`, `probes/cloudflare/src/worker.ts`, and `npm run probe:cf:*` scripts.
- Local development probe path: `probes/node/server.ts` and `npm run probe:dev`.

No real customer testimonials, production benchmarks, customer logos, accounts, billing, alerting, SLA claims, or monitoring claims are currently on hand. Future UI must not fabricate them.

## Product Principles

1. Make the first screen useful: the URL input, run action, current status, results, and share link matter more than explanation.
2. Preserve measurement honesty: show exact values, timestamps, status codes, Cloudflare colo metadata, and failure states.
3. Keep MVP scope tight: one-time tests and share links come before monitoring-product features.
4. Protect infrastructure by default: every path that fetches a user URL must preserve validation, redirect, timeout, byte-cap, and rate-limit rules.
5. Prefer explicit, readable implementation over abstractions that hide the safety or probe contract.

## Accessibility & Inclusion

The web interface should be keyboard-usable, readable on small screens, resilient to long URLs, and clear without relying on color alone. Pair latency and failure colors with text, symbols, status codes, or table values.
