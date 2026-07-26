---
name: Latencymap
description: A network field sheet for credible, one-time regional endpoint tests.
colors:
  canvas: "#eef0ec"
  surface: "#ffffff"
  ink: "#10212d"
  muted: "#52636d"
  line: "#c9d2d7"
  input: "#81909b"
  cobalt: "#2457f5"
  cobalt-dark: "#173baf"
  cobalt-soft: "#e7edff"
  chartreuse-signal: "#c9f238"
  good: "#16833a"
  warn: "#b26a00"
  slow: "#c3362b"
  failed: "#737b8c"
typography:
  ui: "IBM Plex Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  data: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace"
rounded:
  control: "2px"
  panel: "2px"
spacing:
  compact: "8px"
  standard: "16px"
  section: "24px"
---

# Design System: Latencymap

## North Star

**Network field sheet.** Latencymap should feel like a precise instrument prepared for one task: send a bounded request and inspect credible regional evidence. It is calm, physical, and sparse—never a dark SaaS dashboard or a marketing page.

## Surface and Color

The physical scene is a developer working in daylight with a printed field log beside an endpoint console. A mineral canvas carries white work bands, blue-grey rules, and deep blue-black text. Cobalt owns action, focus, and active state. Its pale tint is for selected data and quiet utility surfaces. Chartreuse is reserved for a small live signal only; it never becomes decoration or a competing action color.

Latency colors are semantic and fixed:

- Green: `<150 ms`
- Amber: `150–300 ms`
- Red: `>300 ms`
- Gray: failed probe

Every semantic color must be reinforced by text, a numeric value, status code, or icon.

## Typography and Data

Use IBM Plex Sans (with system fallbacks) for controls, labels, and headings because its compact proportions keep dense operational text calm. Use IBM Plex Mono (with system fallbacks) only for URLs, timing values, status codes, timestamps, colo codes, and short operational labels. Titles stay sentence case and compact; no display hero typography, persistent uppercase treatment, or ornamental lettering.

## Layout and Sequence

The first viewport is the usable test tool:

1. A terminal boot sequence introduces the product and probe regions.
2. A URL prompt and input field accept a public HTTP/S URL.
3. A cobalt Run action submits the test.
4. A quiet safety note follows directly beneath the command.

After a result, the same system shows the regional results table, selected-row inspector, margin-of-error note, and share link. Mobile stacks controls while preserving the command-first order and the authoritative table view.

## Components

- **Terminal shell:** mineral canvas, monospace log lines, cobalt brand label.
- **Command band:** URL field and one cobalt submit action.
- **Results table:** fixed probe-region order, color-coded latency, failed rows visually distinct.
- **Row inspector:** latency, status, region, colo, placement, tested-at for the selected row.
- **Utilities:** quiet share-link copy action and monospace metadata.

## Interaction Rules

The test action is the only dominant action. Preserve a submitted URL through validation and probe failures. Make loading and errors inline and accessible. Link table row selection to the inspector. Use the same focus ring, action color, rule weight, and button geometry on home, results, and share routes.

## Anti-goals

- No marketing hero, dashboard metric tiles, fake coverage, heatmap, or feature grid.
- No orange legacy action palette, gradients, glass, soft shadows, pills, or ornamental chrome.
- No accounts, monitoring, alerts, billing, custom headers, or arbitrary methods.
- No 3D globe in the current MVP (deferred).
