---
name: Latencymap
description: Developer-tool dashboard for testing public endpoint latency from real probe regions.
colors:
  bg: "#081016"
  panel: "#101923"
  panel-strong: "#14212d"
  line: "#24313e"
  text: "#edf5f7"
  muted: "#93a5b2"
  accent: "#4dd0c8"
  accent-strong: "#8ee8d8"
  action-bg: "#14333b"
  danger: "#ff5d5d"
  danger-soft-text: "#ffd2d2"
  warn: "#f3c742"
  good: "#37d67a"
  failed: "#8a93a3"
  input-bg: "#09131b"
  globe-bg: "#070d12"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(28px, 4vw, 48px)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
  support:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
rounded:
  md: "8px"
spacing:
  xs: "8px"
  sm: "10px"
  md: "16px"
  lg: "18px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.action-bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "48px"
  input:
    backgroundColor: "{colors.input-bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "48px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: Latencymap

## Overview

**Creative North Star: "Network Operations Console"**

Latencymap should read as a focused developer tool: dark, compact, precise, and measurement-first. The interface uses technical density, exact numbers, and a restrained cyan accent to support scanning rather than persuasion.

The globe is an operational data surface, not decoration. It must show honest probe markers and remain paired with exact tabular values so users can verify the visualization against concrete measurements.

**Key Characteristics:**
- Dense dashboard layout with the usable URL test form in the first viewport.
- Dark slate surfaces, crisp dividers, and restrained cyan interaction accents.
- Latency status colors reserved for measurement semantics.
- Tables, timestamps, status codes, region labels, and Cloudflare colo values are first-class UI content.

## Colors

The palette is a dark technical slate system with cyan as the primary action accent and semantic latency colors for probe status.

### Primary
- **Probe Cyan** (`#4dd0c8`): focus rings, action borders, selected table rows, and active technical accents.
- **Strong Probe Cyan** (`#8ee8d8`): eyebrow labels, emphasized metadata, and high-contrast accent text.
- **Action Teal Slate** (`#14333b`): primary button fills and compact action surfaces.

### Neutral
- **Console Background** (`#081016`): page background.
- **Panel Slate** (`#101923`): primary dashboard panels.
- **Raised Panel Slate** (`#14212d`): stronger buttons and elevated surfaces.
- **Divider Slate** (`#24313e`): panel borders, table dividers, and field strokes.
- **Primary Text** (`#edf5f7`): headings, table values, and key numbers.
- **Muted Text** (`#93a5b2`): labels, helper text, legends, and secondary metadata.

### Semantic
- **Fast Green** (`#37d67a`): latency below 150 ms.
- **Moderate Yellow** (`#f3c742`): latency from 150-300 ms.
- **Slow Red** (`#ff5d5d`): latency above 300 ms and destructive/error emphasis when appropriate.
- **Soft Error Text** (`#ffd2d2`): readable error copy on translucent red banners.
- **Failed Gray** (`#8a93a3`): failed probes only.

### Named Rules
**The Measurement Color Rule.** Green, yellow, red, and gray are reserved for latency and failure semantics. Do not reuse them as decorative accents.

## Typography

**Display Font:** Inter with system sans fallbacks.
**Body Font:** Inter with system sans fallbacks.

**Character:** Functional and compact. Type should serve measurement, labels, and scanability rather than editorial expression.

### Hierarchy
- **Display** (`700`, `clamp(28px, 4vw, 48px)`, `1`): page-level dashboard title only.
- **Title** (`700`, `18px`, `1.2`): panel headings and compact section titles.
- **Body** (`400`, `14px`, `1.5`): table cells, helper text, and standard UI copy.
- **Label** (`700`, `12-13px`, `0` letter spacing): form labels, table headers, legends, and metric captions.
- **Support** (`400-700`, `13px`, `1.45`): compact helper copy, muted notes, and form labels that need slightly more presence than table headers.

### Named Rules
**The Dashboard Type Rule.** Keep headings proportionate to their panels. Avoid hero-scale type inside compact cards, tables, and tool controls.

## Layout

The app shell is constrained to `min(1440px, 100%)` with `28px` desktop padding and `14px` mobile padding. The first viewport stacks a top bar, tool panel, summary metrics, and the globe/table result surface.

The primary result layout uses a two-column grid: globe on the left and exact results table on the right. At narrower widths, summary metrics, globe/table, and lower history/share panels collapse to one column.

Spacing is tight and regular: `8-10px` for local gaps, `16-18px` for panels and grid gaps, and `28px` for shell padding. Fixed-format elements such as metric cards, buttons, table rows, and globe frames should keep stable dimensions to avoid layout shift during loading and result updates.

## Elevation & Depth

Depth is conveyed with bordered translucent panels and one strong ambient shadow token (`0 24px 80px rgba(0, 0, 0, 0.35)`). The system should stay mostly flat at rest; use elevation to group major dashboard surfaces, not to create nested decorative cards.

## Shapes

Use an `8px` radius for panels, buttons, inputs, table wrappers, banners, and globe frames. Circular dots are reserved for legends and probe/status markers. Avoid pill-heavy styling unless the UI element is genuinely a status chip or small marker.

## Components

### Buttons
- **Shape:** 8px radius with a 1px cyan-tinted border.
- **Primary:** raised slate background, primary text, icon plus concise command label.
- **Hover / Focus:** preserve contrast and use cyan focus treatment consistent with inputs.

### Inputs / Fields
- **Style:** dark inset background, divider slate border, 8px radius, 48px height.
- **Focus:** cyan border with a subtle cyan focus ring.
- **Content:** long URLs must not overflow their container.

### Panels / Containers
- **Corner Style:** 8px radius.
- **Background:** translucent panel slate with divider slate border.
- **Shadow Strategy:** ambient shadow only on major dashboard panels.
- **Internal Padding:** 16-18px.

### Tables
- **Style:** exact values are the authority; keep all probe measurements readable.
- **Rows:** 52px height with divider lines.
- **Headers:** uppercase muted labels at 12px.
- **Selected State:** subtle cyan row background without obscuring status colors.

### Globe
- **Style:** dark framed operational viewport with real probe markers.
- **Behavior:** rotate and zoom where supported; marker hover/click should reinforce the table row.
- **Honesty:** no fake heatmaps or fabricated regional values.

## Do's and Don'ts

### Do:
- **Do** keep the URL input and run action visible before explanatory content.
- **Do** show exact region labels, timestamps, status codes, Cloudflare colo values, latency units, and failure text.
- **Do** pair semantic colors with text or table data so color is not the only signal.
- **Do** reuse shadcn/ui primitives for common controls when adding new UI.

### Don't:
- **Don't** turn the first screen into a marketing hero or generic product landing page.
- **Don't** nest cards inside cards or use card grids as decoration.
- **Don't** create fake regional data, fake heatmaps, synthetic testimonials, customer logos, monitoring claims, or SLA claims.
- **Don't** add accounts, billing, scheduled monitoring, alerts, badges, arbitrary HTTP methods, or custom request headers unless explicitly requested.
