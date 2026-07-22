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
  globe: "#0a1821"
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

1. A slim product bar gives the name and one-time-test context.
2. A concise operational heading establishes the task.
3. A white horizontal command band contains the public URL field and the one cobalt action.
4. A quiet safety note follows directly beneath the command.
5. A field-sheet conditions rail documents the actual request boundary: GET, 5 seconds, and 3 redirects.

After a result, the same system carries the URL context, summary rail, globe/table switcher, exact table, share utility, and history. Mobile stacks controls while preserving the command-first order and the authoritative table view.

## Components

- **Headers:** mineral canvas, one hairline rule, no dark app shell.
- **Command band:** white surface, 2px corners, clear baseline, one cobalt submit action.
- **Panels and tables:** white surfaces with rules for structure, not shadows or nested cards.
- **View switcher:** thin outlined control; selected state uses cobalt-tinted surface and text.
- **Globe:** the single dark measurement viewport; cobalt atmosphere, honest colored probe markers, and direct inspection data.
- **Utilities:** quiet outlined actions, monospace metadata, and no decorative icon tiles.

## Interaction Rules

The test action is the only dominant action. Preserve a submitted URL through validation and probe failures. Make loading and errors inline and accessible. Link globe markers and table rows by selection. Use the same focus ring, action color, rule weight, and button geometry on home, results, and share routes.

## Anti-goals

- No marketing hero, dashboard metric tiles, fake coverage, heatmap, or feature grid.
- No orange legacy action palette, gradients, glass, soft shadows, pills, or ornamental chrome.
- No accounts, monitoring, alerts, billing, custom headers, or arbitrary methods.
