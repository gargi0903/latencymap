/** Conceptual parts of Latencymap — no code file names. */

window.LATENCYMAP_CONCEPTS = [
  // Product
  {
    id: "product",
    layer: "product",
    title: "What Latencymap is",
    summary: "A web tool that checks how fast a public website responds from different places in the world.",
    detail:
      "You paste a normal public link (like https://example.com). The tool visits that link from several remote locations, measures how long it takes, and shows you the results on a 3D globe and in a table. You can share the results with someone else using a link.",
    connects: ["dashboard", "probes", "share-link"],
  },
  {
    id: "dashboard",
    layer: "ui",
    title: "The dashboard (what you see)",
    summary: "The main screen with a URL box, a Run button, the globe, and the results table.",
    detail:
      "This is the page that loads when you open the site. You type a URL, click Run Test, and wait a few seconds. Then you see colored dots on a globe (one per test location) and exact numbers in a table. You can switch between globe view and table view — both show the same real data.",
    connects: ["api", "globe", "results-table"],
  },
  {
    id: "globe",
    layer: "ui",
    title: "The 3D globe",
    summary: "An interactive map showing where each test ran and how fast it was.",
    detail:
      "Each dot is a real test location, not a decorative heatmap. Green means fast (under 150 ms), yellow is moderate, red is slow, and gray means the test failed. Clicking a dot shows more detail about that region.",
    connects: ["probes", "latency-colors"],
  },
  {
    id: "results-table",
    layer: "ui",
    title: "The results table",
    summary: "A precise list of every measurement: region, latency, status, and time.",
    detail:
      "The globe gives you a spatial picture; the table gives you exact numbers. Both views use the same underlying results. The table shows region name, milliseconds, HTTP status code (like 200 for OK), Cloudflare data-center code, and when the test ran.",
    connects: ["probes", "latency-colors"],
  },
  {
    id: "latency-colors",
    layer: "ui",
    title: "Latency colors",
    summary: "A simple color code so you can spot fast vs slow vs failed at a glance.",
    detail:
      "Green: under 150 milliseconds. Yellow: 150–300 ms. Red: over 300 ms. Gray: the test failed (timeout, blocked URL, server error, etc.). These colors are consistent everywhere in the UI.",
    connects: [],
  },

  // Backend
  {
    id: "api",
    layer: "server",
    title: "The central server (API)",
    summary: "The brain on Vercel that receives your URL, checks it is safe, and coordinates the tests.",
    detail:
      "When you click Run Test, your browser sends the URL to this server. The server does not blindly fetch anything — it first validates the URL, checks you have not run too many tests recently, then asks the probes to measure the target. When probes reply, the server packages everything into a result you can view and share.",
    connects: ["url-safety", "rate-limit", "probes", "share-link"],
  },
  {
    id: "url-safety",
    layer: "server",
    title: "URL safety checks",
    summary: "Rules that stop the tool from being abused to attack private networks.",
    detail:
      "Only public http and https links are allowed. The server blocks localhost, internal company networks, cloud admin addresses, and links with embedded passwords. It also checks where the domain name actually points before fetching. If a website redirects elsewhere, each redirect is checked too (up to 3 hops).",
    connects: ["probes"],
  },
  {
    id: "rate-limit",
    layer: "server",
    title: "Rate limiting",
    summary: "A cap on how many tests one person can run per hour.",
    detail:
      "Anonymous users can run about 10 tests per hour from the same network address. Each test uses up to 5 probe locations. This prevents someone from using the tool to hammer websites or burn through infrastructure costs.",
    connects: [],
  },

  // Probes
  {
    id: "probes",
    layer: "probe",
    title: "Probes (measurement workers)",
    summary: "Small programs in different regions that actually visit your URL and time the response.",
    detail:
      "A probe is like a robot in a data center. It receives a URL from the central server, opens it, measures how long the response takes, records the status code, and sends back only timing metadata — never the full page content. In production there are five regions (US East, London, Singapore, Sydney, São Paulo). On your laptop there is just one local probe for practice.",
    connects: ["coordinator", "probe-secret", "probe-contract"],
  },
  {
    id: "coordinator",
    layer: "probe",
    title: "The coordinator (production only)",
    summary: "A boss probe that asks all regional probes at once and collects their answers.",
    detail:
      "In production the central server talks to one coordinator instead of calling five regions separately. The coordinator fans out the request to every regional probe in parallel and returns one combined answer. This gives more honest regional data.",
    connects: ["probes"],
  },
  {
    id: "probe-secret",
    layer: "probe",
    title: "Probe password (PROBE_SECRET)",
    summary: "A shared secret so only the real app can ask probes to run tests.",
    detail:
      "Probes refuse requests from strangers. The app and every probe share the same secret password (an environment variable called PROBE_SECRET). The app sends it with each probe request. Without the correct secret, probes ignore the request.",
    connects: ["probes", "local-dev"],
  },
  {
    id: "probe-contract",
    layer: "probe",
    title: "What a probe returns",
    summary: "A small JSON report: region, milliseconds, status code, and data-center info.",
    detail:
      "Each probe answers with: which region it represents, total time in milliseconds, HTTP status code (or null if it failed), error message if any, and Cloudflare colo codes showing where the request entered and executed. Probes also expose a health check endpoint so operators can verify they are running.",
    connects: [],
  },

  // Data
  {
    id: "share-link",
    layer: "data",
    title: "Share links",
    summary: "Results are embedded in the URL itself — no database needed.",
    detail:
      "After a test completes, the server encodes the full result into a long string and puts it in a URL like /r/AbCdEf…. Anyone with that link can see the same results. Nothing is stored in a database. The link is the storage. This keeps the MVP simple and cheap.",
    connects: ["dashboard"],
  },
  {
    id: "url-normalization",
    layer: "data",
    title: "URL normalization",
    summary: "Rules for treating URLs as the same or different when grouping history.",
    detail:
      "https://API.EXAMPLE.COM and https://api.example.com count as the same URL. Trailing slashes on the root are ignored. But /users and /users?limit=10 are different URLs. History groups results by these normalized URLs.",
    connects: [],
  },

  // Dev & deploy
  {
    id: "local-dev",
    layer: "dev",
    title: "Running on your computer",
    summary: "Two programs start together: the website and one practice probe.",
    detail:
      "The command npm run dev:local starts the website on port 3000 and a local probe on port 8787. You still need a PROBE_SECRET in a local config file. This setup lets you try the full flow, but the single local probe does not represent real world geography.",
    connects: ["probe-secret", "probes"],
  },
  {
    id: "production",
    layer: "dev",
    title: "Running in production",
    summary: "Website on Vercel, probes on Cloudflare, coordinator ties regions together.",
    detail:
      "The public site is hosted on Vercel. Probes run as Cloudflare Workers in five regions. Vercel needs PROBE_SECRET and PROBE_COORDINATOR_ENDPOINT configured. Users on the internet get real multi-region latency; developers on localhost get a simplified single-region test.",
    connects: ["coordinator", "probes", "api"],
  },
  {
    id: "npm",
    layer: "dev",
    title: "npm commands",
    summary: "Shortcuts typed in the terminal to install, run, and check the project.",
    detail:
      "npm is the package manager for this project. npm install downloads dependencies. npm run dev:local starts the site plus local probe. npm test runs automated checks. You do not need to understand JavaScript to run these commands — they are documented in Getting started.",
    connects: ["local-dev"],
  },

  // Stack terms (glossary-style)
  {
    id: "nextjs",
    layer: "glossary",
    title: "Next.js",
    summary: "The framework used to build the website and server routes.",
    detail:
      "Next.js combines a web front end (pages you see) with server-side logic (API routes). It is a popular way to build full-stack web apps with one project. Latencymap uses it for the dashboard, share pages, and the /api/tests endpoint.",
    connects: ["dashboard", "api"],
  },
  {
    id: "vercel",
    layer: "glossary",
    title: "Vercel",
    summary: "The hosting platform where the public website and API run.",
    detail:
      "When you deploy, Vercel runs the Next.js app on their servers. Environment variables like PROBE_SECRET are configured in the Vercel dashboard.",
    connects: ["production", "api"],
  },
  {
    id: "cloudflare-workers",
    layer: "glossary",
    title: "Cloudflare Workers",
    summary: "Lightweight programs that run on Cloudflare's edge network worldwide.",
    detail:
      "Probes are implemented as Workers so they execute close to target regions. Cloudflare picks a data center near each configured region. Workers are stateless and cheap to run at small scale.",
    connects: ["probes", "coordinator"],
  },
  {
    id: "typescript",
    layer: "glossary",
    title: "TypeScript",
    summary: "JavaScript with extra type labels — the language this project is written in.",
    detail:
      "You do not need to know TypeScript to understand what Latencymap does. It is the implementation language: files end in .ts or .tsx. The docs explain behavior in plain English instead of pointing you at those files.",
    connects: [],
  },
];

window.LATENCYMAP_LAYER_LABELS = {
  product: "Product",
  ui: "What you see",
  server: "Central server",
  probe: "Probes",
  data: "Data & links",
  dev: "Running the project",
  glossary: "Terms",
};

window.LATENCYMAP_LAYER_COLORS = {
  product: "#2457f5",
  ui: "#6b4ce6",
  server: "#16833a",
  probe: "#b26a00",
  data: "#0e7490",
  dev: "#52636d",
  glossary: "#737b8c",
};
