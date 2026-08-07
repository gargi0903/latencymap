---
name: Latencymap
description: A terminal console for credible, one-time regional endpoint tests.
colors:
  terminal-ink: "#000000"
  terminal-text: "#e8eef2"
  terminal-muted: "#8a8a8a"
  brand-orange: "#f6821f"
  brand-orange-dark: "#d96a12"
  brand-orange-light: "#e8a06a"
  good: "#16833a"
  warn: "#b26a00"
  slow: "#c3362b"
  failed: "#737b8c"
typography:
  ui: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace"
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

**Terminal console.** Latencymap should feel like a precise instrument prepared for one task: send a bounded request and inspect credible regional evidence. It is a full-screen black terminal with orange command accents — never a marketing page or a metric-tile SaaS dashboard.

## Surface and Color

The shipped UI is a black terminal shell (`app/styles.css` `.terminal`). Orange (`#f6821f`) owns the brand “map” label, prompt caret, focus ring, and primary command accents. Soft orange tints support muted utility text. Latency colors are semantic and fixed in `lib/latency-display.ts`:

- Green: `<150 ms`
- Amber: `150–300 ms`
- Red: `>300 ms`
- Gray: failed probe

Every semantic color must be reinforced by text, a numeric value, status code, or icon.

Legacy mineral/cobalt tokens remain in `:root` for Tailwind/shadcn scaffolding; the live product surface is the terminal shell, not those light-theme tokens.

## Typography and Data

Use **IBM Plex Mono** (loaded in `app/layout.tsx`) for the whole app: boot lines, URL input, table values, status codes, timestamps, colo codes, and labels. Titles stay sentence case and compact; no display hero typography, persistent uppercase treatment, or ornamental lettering.

## Layout and Sequence

The first viewport is the usable test tool:

1. A terminal boot sequence introduces the product and probe regions.
2. A URL prompt and input field accept a public HTTP/S URL.
3. An orange-accented Run action submits the test.
4. A quiet safety note follows directly beneath the command.

After a result, the same system shows the regional results table, selected-row inspector, margin-of-error note, and share link. Mobile stacks controls while preserving the command-first order and the authoritative table view.

## Components

- **Terminal shell:** full-screen black canvas, monospace log lines, orange brand accents.
- **Command band:** URL field and one submit action.
- **Results table:** fixed probe-region order, color-coded latency, failed rows visually distinct.
- **Row inspector:** latency, status, region, colo, placement, tested-at for the selected row.
- **Utilities:** quiet share-link copy action and monospace metadata.

## Interaction Rules

The test action is the only dominant action. Preserve a submitted URL through validation and probe failures. Make loading and errors inline and accessible. Link table row selection to the inspector. Use the same focus ring, action color, rule weight, and button geometry on home, results, and share routes.

## Anti-goals

- No marketing hero, dashboard metric tiles, fake coverage, heatmap, or feature grid.
- No gradients, glass, soft shadows, pills, or ornamental chrome.
- No accounts, monitoring, alerts, billing, custom headers, or arbitrary methods.
- No 3D globe in the current MVP (deferred).
