"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Concept = {
  id: string;
  name: string;
  thesis: string;
  speed: string;
  tradeoff: string;
};

const CONCEPTS: Concept[] = [
  {
    id: "omnibar",
    name: "Omni bar",
    thesis: "One search-sized URL field owns the screen. After run, it pins to a slim top bar and results take the rest — Google-speed mental model.",
    speed: "Zero navigation. Eyes never hunt for the input. Submit → results in one vertical motion.",
    tradeoff: "Less room for brand on idle; wordmark stays small.",
  },
  {
    id: "split",
    name: "Split instrument",
    thesis: "Fixed command rail left, results canvas right. Idle right shows an empty globe scaffold; probes populate in place — no route change, no full-screen takeover.",
    speed: "Command and evidence always visible. Feels like a bench instrument, not a wizard.",
    tradeoff: "Tighter on mobile; may stack vertically.",
  },
  {
    id: "globe-canvas",
    name: "Globe canvas",
    thesis: "The globe is the page from second one (dim, no markers). URL floats over it. Run lights markers on the same canvas — no environment switch.",
    speed: "Removes the landing→results handoff entirely. The payoff is the state change on one surface.",
    tradeoff: "Globe weight on first paint; input competes with the visual.",
  },
  {
    id: "cli",
    name: "CLI strip",
    thesis: "A single command line: probe URL → run. Output streams as monospace rows; globe sits beneath the log. Built for developers who think in terminals.",
    speed: "Familiar dev muscle memory. No marketing chrome — type, enter, read.",
    tradeoff: "Less approachable for non-dev visitors; very opinionated.",
  },
  {
    id: "receipt",
    name: "Receipt unfold",
    thesis: "Narrow centered slot (like a ticket machine). Submit prints a compact result strip, then unfolds to full globe + table. Progress is literal vertical motion.",
    speed: "Clear cause → effect. The UI physically responds to the action.",
    tradeoff: "Two-step vertical expansion; must stay snappy to avoid feeling slow.",
  },
];

const MOCK_PROBES = [
  { id: "iad", ms: "142 ms", tone: "good" as const },
  { id: "lhr", ms: "89 ms", tone: "good" as const },
  { id: "sin", ms: "201 ms", tone: "warn" as const },
  { id: "syd", ms: "178 ms", tone: "warn" as const },
  { id: "gru", ms: "312 ms", tone: "slow" as const },
];

export function DesignConceptsGallery() {
  return (
    <div className="concepts">
      <header className="concepts__header">
        <div>
          <p className="concepts__eyebrow">UX concepts · not skins</p>
          <h1 className="concepts__title">Five interaction models</h1>
          <p className="concepts__lede">
            Same brief: showcase shell → user pastes URL → speed is the memory → globe + table are the star.
            Each concept differs in <strong>layout and flow</strong>, not color. Compare idle (left) vs after run (right).
          </p>
        </div>
        <Link href="/" className="concepts__back">
          Live app →
        </Link>
      </header>

      <div className="concepts__list">
        {CONCEPTS.map((concept, index) => (
          <article key={concept.id} id={concept.id} className="concept-card">
            <header className="concept-card__header">
              <span className="concept-card__index">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2 className="concept-card__name">{concept.name}</h2>
                <p className="concept-card__thesis">{concept.thesis}</p>
              </div>
            </header>

            <div className="concept-card__frames">
              <div className="concept-frame">
                <span className="concept-frame__label">Idle</span>
                <ConceptIdle id={concept.id} />
              </div>
              <div className="concept-frame">
                <span className="concept-frame__label">After run</span>
                <ConceptResult id={concept.id} />
              </div>
            </div>

            <dl className="concept-card__meta">
              <div>
                <dt>Why it feels fast</dt>
                <dd>{concept.speed}</dd>
              </div>
              <div>
                <dt>Tradeoff</dt>
                <dd>{concept.tradeoff}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <footer className="concepts__footer">
        <p>Pick a concept number (1–5) or mix elements. I&apos;ll implement the real flow — not another mockup matrix.</p>
      </footer>
    </div>
  );
}

function ConceptIdle({ id }: { id: string }) {
  switch (id) {
    case "omnibar":
      return (
        <div className="mock mock--omnibar mock--idle">
          <Wordmark small />
          <p className="mock__hint">Measure public endpoint latency from five regions.</p>
          <div className="mock-omnibar">
            <span className="mock-omnibar__icon">⌕</span>
            <span className="mock-omnibar__placeholder">Paste URL and press Enter</span>
            <span className="mock-omnibar__action">Run</span>
          </div>
        </div>
      );
    case "split":
      return (
        <div className="mock mock--split mock--idle">
          <aside className="mock-split__rail">
            <Wordmark />
            <p className="mock__hint">Endpoint test</p>
            <div className="mock-input mock-input--compact">https://</div>
            <button type="button" className="mock-btn">Run test</button>
          </aside>
          <div className="mock-split__canvas">
            <MockGlobe empty />
            <p className="mock-split__await">Awaiting URL</p>
          </div>
        </div>
      );
    case "globe-canvas":
      return (
        <div className="mock mock--globe-canvas mock--idle">
          <MockGlobe empty full />
          <div className="mock-float-bar">
            <Wordmark small inverted />
            <div className="mock-float-bar__row">
              <div className="mock-input mock-input--pill">https://api.github.com</div>
              <button type="button" className="mock-btn mock-btn--icon" aria-label="Run">
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      );
    case "cli":
      return (
        <div className="mock mock--cli mock--idle">
          <Wordmark small />
          <div className="mock-cli">
            <p className="mock-cli__line">
              <span className="mock-cli__prompt">probe</span>
              <span className="mock-cli__cursor">█</span>
            </p>
            <p className="mock-cli__help">type a public https URL and press enter</p>
          </div>
        </div>
      );
    case "receipt":
      return (
        <div className="mock mock--receipt mock--idle">
          <Wordmark />
          <div className="mock-receipt-slot">
            <p className="mock-receipt-slot__label">Public URL</p>
            <div className="mock-input">https://</div>
            <button type="button" className="mock-btn mock-btn--block">Measure</button>
          </div>
        </div>
      );
    default:
      return null;
  }
}

function ConceptResult({ id }: { id: string }) {
  switch (id) {
    case "omnibar":
      return (
        <div className="mock mock--omnibar mock--result">
          <div className="mock-omnibar mock-omnibar--pinned">
            <Wordmark small />
            <div className="mock-omnibar__pinned-input">api.github.com</div>
            <span className="mock-omnibar__badge">Healthy · 142–312 ms</span>
          </div>
          <div className="mock-result-body">
            <MockGlobe active />
            <MockProbeList />
          </div>
        </div>
      );
    case "split":
      return (
        <div className="mock mock--split mock--result">
          <aside className="mock-split__rail">
            <Wordmark />
            <div className="mock-input mock-input--compact mock-input--filled">api.github.com</div>
            <button type="button" className="mock-btn mock-btn--ghost">Run again</button>
            <MockProbeList compact />
          </aside>
          <div className="mock-split__canvas">
            <MockGlobe active />
          </div>
        </div>
      );
    case "globe-canvas":
      return (
        <div className="mock mock--globe-canvas mock--result">
          <MockGlobe active full />
          <div className="mock-float-bar mock-float-bar--mini">
            <span className="mock-float-bar__url">api.github.com</span>
            <span className="mock-float-bar__stat">5/5 probes</span>
          </div>
          <div className="mock-globe-dock">
            <MockProbeList horizontal />
          </div>
        </div>
      );
    case "cli":
      return (
        <div className="mock mock--cli mock--result">
          <div className="mock-cli mock-cli--log">
            <p>
              <span className="mock-cli__prompt">probe</span> https://api.github.com
            </p>
            <p className="mock-cli__ok">→ 5 regions · 1.8s · 200 OK</p>
            {MOCK_PROBES.map((probe) => (
              <p key={probe.id} className="mock-cli__row">
                <span>{probe.id}</span>
                <span className={cn("mock-probe-ms", `mock-probe-ms--${probe.tone}`)}>{probe.ms}</span>
                <span>SIN</span>
              </p>
            ))}
          </div>
          <MockGlobe active short />
        </div>
      );
    case "receipt":
      return (
        <div className="mock mock--receipt mock--result">
          <div className="mock-receipt-strip">
            <p className="mock-receipt-strip__url">api.github.com</p>
            <p className="mock-receipt-strip__summary">Fastest 89 ms · Slowest 312 ms</p>
          </div>
          <div className="mock-receipt-expand">
            <MockGlobe active short />
            <MockProbeList />
          </div>
        </div>
      );
    default:
      return null;
  }
}

function Wordmark({ small, inverted }: { small?: boolean; inverted?: boolean }) {
  return (
    <span className={cn("mock-wordmark", small && "mock-wordmark--small", inverted && "mock-wordmark--inverted")}>
      <span>latency</span>
      <span>map</span>
    </span>
  );
}

function MockGlobe({ empty, active, full, short }: { empty?: boolean; active?: boolean; full?: boolean; short?: boolean }) {
  return (
    <div
      className={cn(
        "mock-globe",
        empty && "mock-globe--empty",
        active && "mock-globe--active",
        full && "mock-globe--full",
        short && "mock-globe--short",
      )}
      aria-hidden="true"
    >
      <div className="mock-globe__sphere" />
      {active
        ? MOCK_PROBES.map((probe, i) => (
            <span
              key={probe.id}
              className={cn("mock-globe__dot", `mock-globe__dot--${i}`, `mock-globe__dot--${probe.tone}`)}
            />
          ))
        : null}
    </div>
  );
}

function MockProbeList({ compact, horizontal }: { compact?: boolean; horizontal?: boolean }) {
  return (
    <ul className={cn("mock-probes", compact && "mock-probes--compact", horizontal && "mock-probes--horizontal")}>
      {MOCK_PROBES.map((probe) => (
        <li key={probe.id}>
          <span>{probe.id}</span>
          <span className={cn("mock-probe-ms", `mock-probe-ms--${probe.tone}`)}>{probe.ms}</span>
        </li>
      ))}
    </ul>
  );
}
