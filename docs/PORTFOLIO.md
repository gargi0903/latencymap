# Latencymap — Portfolio & Pitch Guide

**Live demo:** [latencymap-six.vercel.app](https://latencymap-six.vercel.app)

Use this document when presenting Latencymap in **job interviews**, **portfolio reviews**, or **investor conversations**. It matches what the product actually ships today.

## One-liner

**LatencyMap is a developer tool that tests any public HTTP/S URL from five real global regions in parallel, shows exact latency with honest Cloudflare colo metadata, and generates a shareable result link — with zero database.**

## Elevator pitch (30 seconds)

> APIs and websites feel fast from your laptop, but users are everywhere. LatencyMap lets you paste a public URL, run one test, and see how it responds from the US, UK, Singapore, Sydney, and São Paulo in seconds. Every number is real — region, milliseconds, HTTP status, and the actual Cloudflare data center that ran the probe. Results are encoded into a share link, so there is no database, no account, and almost no operating cost. I built the full stack: Next.js on Vercel, regional probes on Cloudflare Workers, and production-grade SSRF protection on every fetch path.

## The problem

- Backend and API developers need a **quick, credible** way to check public endpoint latency from multiple regions.
- Existing options are often heavy (full monitoring SaaS), expensive, or synthetic — not a fast one-off check before launch or after a deploy.
- Founders and operators want the same signal without signing up for a monitoring product.

## The solution

A **terminal-style dashboard** where you:

1. Enter a public URL
2. Run a bounded test (5 probes in parallel)
3. Review a regional results table with color-coded latency
4. Inspect any row for status code, colo, placement region, and timestamp
5. Copy a share link that encodes the full run in the URL

## What to demo live

**Best demo URL:** a well-known public API (e.g. `https://example.com` or your own public endpoint).

| Step | What to show | What to say |
| --- | --- | --- |
| 1 | Home dashboard | "The first screen is the tool — not a marketing page." |
| 2 | Paste URL, click Run Test | "One action triggers validation, rate limiting, and five parallel probes." |
| 3 | Results table | "Each row is a real region. Colors follow a simple contract: green under 150 ms, yellow 150–300, red above 300, gray if failed." |
| 4 | Click a row — inspector | "We expose honest metadata: Cloudflare colo, placement hint, status code, tested-at timestamp." |
| 5 | Share link | "No database — the full test run is encoded in `/r/[token]`. Anyone with the link sees the same results." |

**Demo length:** 60–90 seconds for interviews; 3–5 minutes for VC with architecture follow-up.

## Technical highlights (engineering interviews)

| Area | What you built | Why it matters |
| --- | --- | --- |
| **Distributed probes** | 5 Cloudflare Workers with targeted placement hints | Real regional measurement, not simulated data |
| **Direct fan-out** | Vercel calls five regional Workers in parallel | No coordinator, no database, simple ops |
| **Stateless persistence** | Base64url-encoded share payloads in `lib/share-payload.ts` | No DB cost, portable links |
| **Stable latency** | Warmups + 3 samples per region in `lib/probe-fetch.ts` | Reduces jitter; drops one slow spike |
| **SSRF protection** | URL validation + DNS checks on API and every probe | Safe to expose a URL-fetch tool on the public internet |
| **Provider-agnostic contract** | `POST /probe` with shared secret auth | Probes could move off Cloudflare without rewriting the app |
| **Honest UI** | Terminal table + inspector; no fake regional coverage | Trust is the product |
| **Abuse controls** | Rate limit, redirect caps, 16 KiB probe request cap, body discard, 12s timeout | Production-minded MVP |

## Architecture (whiteboard version)

```txt
Browser
  → Next.js on Vercel (validate URL, rate limit, fan-out)
  → 5 × Cloudflare Worker probes (parallel)
  → target public URL
  → merge results → encode share link → return to browser
```

**Stack:** Next.js 15 · TypeScript · Vercel · Cloudflare Workers · Wrangler · Vitest

## Deliberate scope choices (shows judgment)

Say these out loud — they signal product sense:

- **No accounts or billing** — keeps the MVP deployable and demoable in one session
- **No scheduled monitoring** — one-time tests only; avoids competing with Datadog on day one
- **No database** — share links are the persistence layer
- **No custom headers or arbitrary HTTP methods** — reduces abuse surface
- **GET-only probes** — enough for latency evidence; keeps the contract simple

## Future expansion (VC conversation — not built yet)

Frame these as **natural next steps**, not current features:

- Scheduled monitoring and alerting for API teams
- Accounts, team workspaces, and API keys
- More regions and percentile metrics (P50/P95)
- History stored server-side instead of URL-only
- Paid tiers for higher rate limits and private probes

## Skills this project demonstrates

- Full-stack TypeScript (Next.js App Router, API routes, React client components)
- Edge computing (Cloudflare Workers, placement hints, Wrangler multi-env deploy)
- Security engineering (SSRF, DNS validation, redirect re-checks, rate limiting)
- System design (parallel fan-out, stateless share encoding, provider-agnostic probe contract)
- Developer UX (dense terminal dashboard, honest data, no fake metrics)
- DevOps (Vercel + Cloudflare split, env-based probe configuration, health checks)

## Interview vs VC framing

| Audience | Lead with | Avoid |
| --- | --- | --- |
| **Hiring manager / engineer** | Architecture, SSRF design, probe contract, test coverage, tradeoffs | Over-selling as a SaaS business |
| **VC / founder** | Problem, wedge (one-click global latency), low COGS, expansion path | Deep implementation details unless asked |
| **Portfolio reviewer** | Live demo + share link + GitHub walkthrough of `lib/` and `probes/` | Claiming production traffic or customers you do not have |

## Links to include on resume / deck

- **Live app:** https://latencymap-six.vercel.app
- **GitHub:** https://github.com/gargi0903/latencymap
- **Docs:** `/docs/html/index.html` when deployed (served from `public/docs/html/`)
- **Architecture:** `README.md` and `public/docs/html/architecture.html`

## Honesty checklist

Do **not** claim unless true:

- Paying customers or revenue
- 24/7 monitoring or alerts (MVP is one-time tests only)
- A 3D globe (deferred; current UI is a terminal-style table)
- Guaranteed probe city placement (show `cloudflare_colo` as the honest execution location)
