# ADR 0001: Home Dashboard Layout

## Status

Accepted (updated 2026-07-22)

## Context

Latencymap is a developer-tool dashboard for one-time public URL latency tests. The first screen must be useful, not a marketing page. The user chose one clear dashboard instead of multiple visual variants.

During design grilling, these decisions were made:

- The UI itself should make the first impression.
- The URL input and Run button must remain prominent.
- The dashboard should feel like a clean technical workspace with a strong map area.
- The globe and exact results table should both present the same honest probe evidence after a test.
- Before the first test, the page should stay focused on the URL task with minimal supporting context.

## Decision

Use one production home dashboard layout.

Before a test runs, show the designed dashboard header, URL form, concise safety copy, and a compact conditions rail (method, timeout, redirects). Do not show an empty globe, fake table, dashboard preview, onboarding panel, or marketing content.

After a test runs, reveal the results surface with summary metrics, a Globe/Table view switcher, share link, and same-URL history. The selected view shows either the 3D globe with inspector details or the exact probe table. Both views use the same underlying probe data.

## Consequences

- Remove the five-variant comparison shell from the primary home surface.
- Keep visual polish in the shell, spacing, typography, and evidence hierarchy rather than adding extra pre-run content.
- Preserve the MVP rule that exact probe numbers remain available in the table view and compact inspector details on the globe view.
- Future first-run changes should be judged against the "URL task first" decision.
