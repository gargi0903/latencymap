# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are backend and API developers who need a quick, credible read on how a public API behaves from multiple global probe regions.

Secondary users are startup founders checking public websites and general users testing public HTTP/S URLs. These users are supported, but the product language and default workflows should stay API-first.

## Product Purpose

Latencymap is a portfolio/demo MVP for running one-time latency tests against public APIs or websites, saving the results, and visualizing exact regional probe measurements on a 3D globe with a results table.

Success means a user can enter a public URL, run a test, see honest probe results with status and timing metadata, review history for the normalized URL, and share a permanent result page.

## Positioning

Latencymap is a developer-tool dashboard for one-time public endpoint latency checks, not a monitoring SaaS and not a marketing landing page. Its differentiator is showing real probe measurements and Cloudflare colo metadata beside an honest 3D globe representation, rather than a simulated heatmap or synthetic regional claims.

## Operating Context

The first screen is the usable latency test tool. The core workflow is:

1. Enter a public `http://` or `https://` URL.
2. Run a one-time test.
3. Let the central Next.js API validate and normalize the URL, rate-limit anonymous users, call probes in parallel, and persist the run.
4. Show the globe, exact table values, timestamps, status codes, Cloudflare colo values, latency units, URL history, and share-link action.

The application runs as a Next.js app on Vercel. Persistence uses Neon Postgres when `DATABASE_URL` is configured and local JSON storage for development without a database. Regional probes and supporting edge services run on Cloudflare Workers through a provider-agnostic HTTP probe contract.

## Capabilities and Constraints

MVP scope includes one-time tests, saved results, history grouped by normalized full URL, and share links. Do not add accounts, billing, scheduled monitoring, alerts, badges, arbitrary HTTP methods, or custom request headers unless explicitly requested.

Probe results must use the provider-agnostic `POST /probe` contract and expose `region`, `placement_region`, `cloudflare_colo`, `total_ms`, `status_code`, and `error`. Keep `GET /healthz`.

User-provided URL fetching must remain abuse-resistant: allow only HTTP/S, reject embedded credentials, block localhost, loopback, private/internal IP ranges, link-local and metadata IPs, validate redirect targets, cap redirects at 3, use 5 second timeouts, cap response bytes, never store response bodies, and rate limit anonymous users.

URL history groups by normalized full URL: lowercase scheme and host, remove fragments, preserve path and query string, remove default ports, and only remove the trailing slash for the root path.

The UI must show exact probe numbers in a table beside the globe. Failed probes must be visually distinct from slow probes. Latency colors are green for `<150 ms`, yellow for `150-300 ms`, red for `>300 ms`, and gray for failed.

## Brand Commitments

The product name is Latencymap. The UI should feel like a dense, clean, technical dashboard for repeated use, not a generic component showcase or promotional page.

Use `shadcn/ui` and Tailwind CSS as the default UI system, following `components.json`: New York style, RSC enabled, TSX, Tailwind CSS variables, slate base color, lucide icons, and `@/components/ui` aliases. Use `react-globe.gl` or the existing 3D globe stack for the interactive globe and `lucide-react` for icons.

## Evidence on Hand

- Product and architecture plan: `MVP_PLAN.md`.
- Project instructions and product constraints: `AGENTS.md`.
- Existing app shell and dashboard UI: `app/page.tsx`, `components/latency-dashboard.tsx`, `components/results-view.tsx`, `components/globe-panel.tsx`, `components/ui/globe.tsx`, and `app/styles.css`.
- Existing shared types and API/storage behavior: `lib/types.ts`, `app/api/tests/route.ts`, `app/api/history/route.ts`, and `lib/storage.ts`.
- No customer testimonials, production benchmarks, accounts, billing, alerting, or SLA claims are currently on hand; future UI must not fabricate them.

## Product Principles

1. Make the first viewport useful: URL input, test action, results, and status belong ahead of marketing or explanation.
2. Stay honest about measurement: show real probe markers, actual timestamps, status codes, Cloudflare colo values, and failures.
3. Keep MVP scope tight: optimize for credible one-time tests, saved history, and shareable results before SaaS features.
4. Protect infrastructure by default: every user-provided URL path must preserve the safety and rate-limit contract.
5. Prefer explicit, readable implementation over premature abstractions.

## Accessibility & Inclusion

The interface should remain readable, keyboard-usable, and resilient to small screens and long URLs. Do not rely on color alone for failed probes or status communication; pair color with text, symbols, or table values.
