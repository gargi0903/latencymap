# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are backend and API developers who need a quick, credible way to check how a public API or endpoint responds from multiple real probe regions.

Secondary users are startup founders checking public websites and general users testing public HTTP/S URLs. They are supported, but the product should stay API-first in language, defaults, and workflow emphasis.

## Product Purpose

Latencymap is a portfolio/demo MVP for one-time public endpoint latency tests. A user enters a URL, the app validates and normalizes it, runs bounded regional probe requests, stores the run, and shows the result as exact measurements beside an honest 3D globe.

Success means a user can complete the full loop from the first screen: enter a public URL, run the test, inspect status codes, latency values, timestamps, Cloudflare colo metadata, history for the normalized URL, and open or share a permanent result page. The initial screen is intentionally spare: one input and one primary action; operational detail appears only when there is a result to inspect.

## Positioning

Latencymap is a developer-tool dashboard, not a marketing landing page and not a monitoring SaaS. Its distinct promise is credible one-time latency evidence from real probes: exact table values, actual probe metadata, and honest globe markers instead of simulated heatmaps, customer claims, or synthetic regional coverage.

## Operating Context

The first viewport is the usable latency test tool. The main workflow is:

1. Enter a public `http://` or `https://` URL.
2. Run a one-time latency test.
3. Let the central Next.js API validate and normalize the URL, rate-limit anonymous users, call configured probes in parallel, persist the run, and return saved results.
4. Review the result summary and switch between the globe and exact probe table.
5. Optionally open a share link or inspect prior runs for the same normalized URL.

The frontend and central API route handlers run in a Next.js app intended for Vercel. Persistence uses Neon Postgres when `DATABASE_URL` is configured and local JSON storage for development without a database. Probes and supporting edge services are intended to run on Cloudflare Workers with a provider-agnostic HTTP interface.

Local development can use local JSON storage and a local probe for flow testing. Local probe results must be treated as development evidence only, not real regional latency.

## Capabilities and Constraints

MVP scope includes one-time manual tests, saved test results, history grouped by normalized full URL, and public share links.

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
- use short timeouts, currently 5 seconds
- cap response bytes
- never store fetched response bodies
- do not accept user-supplied headers in the MVP
- rate limit anonymous users

Recommended anonymous rate limit is 10 test runs per hour per IP, with each test run calling at most 5 probes.

History groups by normalized full URL: lowercase scheme and host, remove fragments, preserve path and query string, remove default ports, and only remove the trailing slash for the root path. Different paths or query strings are different URLs.

The UI presents one primary results view at a time: globe or table. Globe view retains a compact textual result summary, while table view is the authoritative exact measurement view. Failed probes must be visually distinct from slow probes. The latency color contract is green for `<150 ms`, yellow for `150-300 ms`, red for `>300 ms`, and gray for failed.

## Brand Commitments

The product name is Latencymap.

The interface should feel like a clean, technical operating console for developer use: cobalt primary action and active state, dark ink/navy operational surfaces, crisp typography, generous whitespace around the main task, and high-contrast data. See `DESIGN.md` for the current visual system.

The initial state contains the URL input, one clear test action, concise safety/help text, and a compact conditions rail for the bounded GET request. After a successful run, reveal a compact result summary, a two-option Globe/Table view switcher, the selected results view, and secondary share/history actions. Do not add charts, filter toolbars, metric-card grids, onboarding tours, or decorative dashboard modules.

Use `shadcn/ui` and Tailwind CSS for common UI primitives, following `components.json`: New York style, RSC enabled, TSX, Tailwind CSS variables, slate base color, lucide icons, and `@/components/ui` aliases. Keep project-specific components for domain surfaces such as the globe, probe markers, latency summaries, result history, and share-page composition.

Use `react-globe.gl` for the interactive 3D globe and `lucide-react` for icons.

## Evidence on Hand

- Product and architecture plan: `MVP_PLAN.md`.
- Active project instructions and scope constraints: `AGENTS.md` in the conversation context.
- App entry and dashboard surface: `app/page.tsx`, `components/latency-dashboard.tsx`, `components/results-view.tsx`, `components/globe-panel.tsx`, and `app/styles.css`.
- API and shared behavior: `app/api/tests/route.ts`, `app/api/tests/[id]/route.ts`, `lib/types.ts`, `lib/storage.ts`, `lib/probes.ts`, `lib/rate-limit.ts`, `lib/url-safety.ts`, and `lib/latency-display.ts`.
- Cloudflare probe direction: `probes/cloudflare/wrangler.jsonc`, `probes/cloudflare/src/worker.ts`, and `npm run probe:cf:*` scripts.
- Local development probe path: `probes/node/package.json` and `npm run probe:dev`.

No real customer testimonials, production benchmarks, customer logos, accounts, billing, alerting, SLA claims, or monitoring claims are currently on hand. Future UI must not fabricate them.

## Product Principles

1. Make the first screen useful: the URL input, run action, current status, results, and history matter more than explanation.
2. Preserve measurement honesty: show real probe markers, exact values, timestamps, status codes, Cloudflare colo metadata, and failure states.
3. Keep MVP scope tight: one-time tests, saved history, and share links come before monitoring-product features.
4. Protect infrastructure by default: every path that fetches a user URL must preserve validation, redirect, timeout, byte-cap, and rate-limit rules.
5. Prefer explicit, readable implementation over abstractions that hide the safety or probe contract.

## Accessibility & Inclusion

The web interface should be keyboard-usable, readable on small screens, resilient to long URLs, and clear without relying on color alone. Pair latency and failure colors with text, symbols, status codes, or table values.
