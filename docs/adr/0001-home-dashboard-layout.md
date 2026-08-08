# ADR 0001: Home Dashboard Layout

## Status

Accepted (updated 2026-08-07)

## Context

Latencymap is a developer-tool dashboard for one-time public URL latency tests. The first screen must be useful, not a marketing page. The user chose one clear dashboard instead of multiple visual variants.

During design grilling, these decisions were made:

- The UI itself should make the first impression.
- The URL input and Run button must remain prominent.
- The dashboard should feel like a clean technical workspace (shipped as a full-screen terminal shell).
- After a test, exact regional results must be shown in a terminal-style table with a selected-row inspector.
- Before the first test, the page should stay focused on the URL task with minimal supporting context.

## Decision

Use one production home dashboard layout.

Before a test runs, show the terminal boot sequence, URL form, and concise safety copy. Do not show an empty results table, fake data, onboarding panel, or marketing content.

After a test runs, reveal the regional results table, selected-row inspector, margin-of-error note, and share link action. A 3D globe view is deferred; the table and inspector are the authoritative evidence surface.

## Consequences

- Remove the five-variant comparison shell from the primary home surface.
- Keep visual polish in the shell, spacing, typography, and evidence hierarchy rather than adding extra pre-run content.
- Preserve the MVP rule that exact probe numbers remain available in the table and selected-row inspector.
- Future first-run changes should be judged against the "URL task first" decision.
- Visual tokens for the live surface are documented in `DESIGN.md` (black terminal + orange accents).
