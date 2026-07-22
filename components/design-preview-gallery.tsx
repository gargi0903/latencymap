"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ProbeConstellation, PROBE_REGIONS } from "@/components/landing-stage";
import { cn } from "@/lib/utils";

type Direction = "current" | "scan-first" | "dark-distilled" | "field-sheet";
type Palette = "orange" | "hybrid" | "cobalt";

type Variant = {
  id: string;
  direction: Direction;
  palette: Palette;
  title: string;
  note: string;
  recommended?: boolean;
};

const VARIANTS: Variant[] = [
  {
    id: "current",
    direction: "current",
    palette: "orange",
    title: "Current (live)",
    note: "Full slop stack — noise, grid, sparkles, constellation, hero copy, glow CTA.",
  },
  {
    id: "a-orange",
    direction: "scan-first",
    palette: "orange",
    title: "A · Scan-first · Orange",
    note: "Minimal idle. Wow = scan → globe. Orange throughout.",
    recommended: true,
  },
  {
    id: "a-hybrid",
    direction: "scan-first",
    palette: "hybrid",
    title: "A · Scan-first · Hybrid",
    note: "Minimal idle. Orange wordmark, cobalt action button.",
    recommended: true,
  },
  {
    id: "a-cobalt",
    direction: "scan-first",
    palette: "cobalt",
    title: "A · Scan-first · Cobalt",
    note: "Minimal idle. DESIGN.md field-sheet colors on a dark shell.",
  },
  {
    id: "b-orange",
    direction: "dark-distilled",
    palette: "orange",
    title: "B · Dark distilled · Orange",
    note: "Dark hero, constellation only — no noise, grid, or sparkles.",
  },
  {
    id: "b-hybrid",
    direction: "dark-distilled",
    palette: "hybrid",
    title: "B · Dark distilled · Hybrid",
    note: "Constellation ornament + orange wordmark + cobalt CTA.",
  },
  {
    id: "b-cobalt",
    direction: "dark-distilled",
    palette: "cobalt",
    title: "B · Dark distilled · Cobalt",
    note: "Dark hero with cobalt accents instead of orange glow.",
  },
  {
    id: "c-orange",
    direction: "field-sheet",
    palette: "orange",
    title: "C · Field sheet · Orange",
    note: "Light mineral canvas, white command band, orange actions.",
  },
  {
    id: "c-hybrid",
    direction: "field-sheet",
    palette: "hybrid",
    title: "C · Field sheet · Hybrid",
    note: "DESIGN.md layout with orange wordmark + cobalt submit.",
    recommended: true,
  },
  {
    id: "c-cobalt",
    direction: "field-sheet",
    palette: "cobalt",
    title: "C · Field sheet · Cobalt",
    note: "Canonical DESIGN.md — daylight instrument, cobalt primary.",
  },
];

const PALETTE_VARS: Record<Palette, { accent: string; action: string; actionText: string; map: string }> = {
  orange: { accent: "#f6821f", action: "#f6821f", actionText: "#ffffff", map: "#f6821f" },
  hybrid: { accent: "#f6821f", action: "#2457f5", actionText: "#ffffff", map: "#f6821f" },
  cobalt: { accent: "#2457f5", action: "#2457f5", actionText: "#ffffff", map: "#2457f5" },
};

export function DesignPreviewGallery() {
  return (
    <div className="preview-gallery">
      <header className="preview-gallery__header">
        <div>
          <p className="preview-gallery__eyebrow">Design comparison</p>
          <h1 className="preview-gallery__title">Pick a direction before locking in</h1>
          <p className="preview-gallery__lede">
            3 layout directions × 3 color treatments (+ current live version). Scroll to compare idle landing states.
            The scan transition preview is at the bottom.
          </p>
        </div>
        <Link href="/" className="preview-gallery__back">
          ← Back to live app
        </Link>
      </header>

      <nav className="preview-gallery__nav" aria-label="Jump to variant">
        {VARIANTS.map((variant) => (
          <a key={variant.id} href={`#${variant.id}`} className="preview-gallery__nav-link">
            {variant.title}
          </a>
        ))}
        <a href="#scan-moment" className="preview-gallery__nav-link">
          Scan moment
        </a>
      </nav>

      <div className="preview-gallery__grid">
        {VARIANTS.map((variant) => (
          <section key={variant.id} id={variant.id} className="preview-card">
            <div className="preview-card__meta">
              <div>
                <h2 className="preview-card__title">{variant.title}</h2>
                <p className="preview-card__note">{variant.note}</p>
              </div>
              {variant.recommended ? (
                <span className="preview-card__badge">Critique pick</span>
              ) : null}
            </div>
            <LandingMock variant={variant} />
          </section>
        ))}

        <section id="scan-moment" className="preview-card preview-card--wide">
          <div className="preview-card__meta">
            <div>
              <h2 className="preview-card__title">Scan moment (shared wow)</h2>
              <p className="preview-card__note">
                Direction A keeps idle minimal so this transition owns the impression. No artificial delay — regions light up as probes return.
              </p>
            </div>
          </div>
          <ScanMomentMock />
        </section>
      </div>
    </div>
  );
}

function LandingMock({ variant }: { variant: Variant }) {
  const colors = PALETTE_VARS[variant.palette];
  const isLight = variant.direction === "field-sheet";
  const isCurrent = variant.direction === "current";

  return (
    <div
      className={cn(
        "preview-mock",
        isLight && "preview-mock--light",
        isCurrent && "preview-mock--current",
        variant.direction === "dark-distilled" && "preview-mock--distilled",
        variant.direction === "scan-first" && "preview-mock--scan-first",
      )}
      style={
        {
          "--mock-accent": colors.accent,
          "--mock-action": colors.action,
          "--mock-action-text": colors.actionText,
          "--mock-map": colors.map,
        } as React.CSSProperties
      }
    >
      {isCurrent ? (
        <>
          <div className="preview-mock__noise" aria-hidden="true" />
          <div className="preview-mock__grid" aria-hidden="true" />
        </>
      ) : null}

      {variant.direction === "dark-distilled" || isCurrent ? (
        <ProbeConstellation
          idPrefix={`mock-${variant.id}`}
          className="preview-mock__constellation"
          accentColor={colors.accent}
        />
      ) : null}

      <div className={cn("preview-mock__inner", isLight && "preview-mock__inner--sheet")}>
        {isLight ? (
          <>
            <div className="preview-mock__copy">
              <PreviewWordmark inverted={false} mapColor={colors.map} textColor="#10212d" />
              <h3 className="preview-mock__headline">{variant.direction === "field-sheet" ? "Test an endpoint from the edge." : "Paste a URL. See latency on a globe."}</h3>
              <p className="preview-mock__subline">One bounded GET from five regional probes.</p>
            </div>
            <CommandBlock isLight variant={variant} />
          </>
        ) : (
          <>
            <PreviewWordmark inverted mapColor={colors.map} textColor="#f4f7f8" />
            <div className="preview-mock__body">
              {isCurrent ? (
                <p className="preview-mock__sparkles">
                  <Sparkles className="size-3" aria-hidden="true" />
                  Worldwide latency, one URL away
                </p>
              ) : null}

              <h3 className="preview-mock__headline">Paste a URL. See latency on a globe.</h3>

              {variant.direction !== "scan-first" && !isCurrent ? (
                <p className="preview-mock__subline">Five regions light up when you measure.</p>
              ) : null}

              <CommandBlock isLight={false} variant={variant} />

              {isCurrent ? (
                <div className="preview-mock__examples">
                  <span>Try an example</span>
                  <div className="preview-mock__chips">
                    <span>GitHub API</span>
                    <span>Cloudflare</span>
                    <span>httpbin</span>
                  </div>
                </div>
              ) : variant.direction === "scan-first" ? (
                <div className="preview-mock__examples preview-mock__examples--quiet">
                  <button type="button" className="preview-mock__chip">
                    Try GitHub API
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ScanMomentMock() {
  const active = PROBE_REGIONS.map((region) => region.id);

  return (
    <div className="preview-mock preview-mock--scan-moment">
      <ProbeConstellation
        idPrefix="mock-scan"
        className="preview-mock__constellation preview-mock__constellation--scan"
        activeRegions={active}
      />
      <div className="preview-mock__scan-copy">
        <p className="preview-mock__scan-eyebrow">Measuring</p>
        <p className="preview-mock__scan-url">https://api.github.com</p>
        <div className="preview-mock__scan-pills">
          {PROBE_REGIONS.map((region) => (
            <span key={region.id} className="preview-mock__scan-pill preview-mock__scan-pill--active">
              {region.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CommandBlock({ isLight, variant }: { isLight: boolean; variant: Variant }) {
  return (
    <div className={cn("preview-mock__command", isLight && "preview-mock__command--sheet")}>
      <div className="preview-mock__input-row">
        <div className="preview-mock__input">https://api.github.com</div>
        <button type="button" className="preview-mock__button">
          <span>{variant.direction === "field-sheet" ? "Test endpoint" : "Measure"}</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <div className="preview-mock__rail">
        <span>GET</span>
        <span>5 s timeout</span>
        <span>3 redirects</span>
      </div>
    </div>
  );
}

function PreviewWordmark({
  inverted,
  mapColor,
  textColor,
}: {
  inverted: boolean;
  mapColor: string;
  textColor: string;
}) {
  return (
    <span className="preview-mock__wordmark" aria-label="Latency Map">
      <span style={{ color: inverted ? "#f4f7f8" : textColor }}>latency</span>
      <span style={{ color: mapColor }}>map</span>
    </span>
  );
}
