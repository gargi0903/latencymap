#!/usr/bin/env node

const subdomain = process.argv[2]?.trim();

if (!subdomain) {
  process.stdout.write(`Usage: npm run probe:cf:print-env -- <your-workers-subdomain>

Example:
  npm run probe:cf:print-env -- acme.workers.dev

Set these in Vercel production:
`);
  process.stdout.write(`
PROBE_WORKERS_SUBDOMAIN=<your-workers-subdomain>
PROBE_SECRET=<same secret deployed to every Cloudflare Worker environment>
`);
  process.exit(1);
}

process.stdout.write(`Set these in Vercel production:

PROBE_WORKERS_SUBDOMAIN=${subdomain}
PROBE_SECRET=<same secret deployed to every Cloudflare Worker environment>
`);
