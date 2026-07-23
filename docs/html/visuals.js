(function () {
  const CONCEPTS = window.LATENCYMAP_CONCEPTS || [];
  const LAYER_LABELS = window.LATENCYMAP_LAYER_LABELS || {};
  const LAYER_COLORS = window.LATENCYMAP_LAYER_COLORS || {};

  const conceptById = new Map(CONCEPTS.map((c) => [c.id, c]));

  function conceptTitle(id) {
    return conceptById.get(id)?.title || id;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function layerBadge(layer) {
    const color = LAYER_COLORS[layer] || "#52636d";
    const label = LAYER_LABELS[layer] || layer;
    return `<span class="layer-badge" style="--badge-color:${color}">${escapeHtml(label)}</span>`;
  }

  function layerIcon(layer) {
    const icons = {
      product: "◆",
      ui: "◻",
      server: "⬡",
      probe: "◎",
      data: "🔗",
      dev: "▷",
      glossary: "?",
    };
    return icons[layer] || "•";
  }

  /** @param {{ id?: string, title?: string, nodes: { id: string, label: string, sub?: string, layer?: string }[], edges: { from: string, to: string, label?: string }[] }} spec */
  function renderFlowSvg(spec) {
    const nodeW = 148;
    const nodeH = 52;
    const gapX = 36;
    const gapY = 28;
    const cols = 3;
    const positions = new Map();

    spec.nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      positions.set(node.id, { x: 24 + col * (nodeW + gapX), y: 24 + row * (nodeH + gapY) });
    });

    const maxRow = Math.ceil(spec.nodes.length / cols);
    const width = 24 * 2 + cols * nodeW + (cols - 1) * gapX;
    const height = 24 * 2 + maxRow * nodeH + Math.max(0, maxRow - 1) * gapY;

    const edges = spec.edges
      .map((edge) => {
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        if (!from || !to) return "";
        const x1 = from.x + nodeW / 2;
        const y1 = from.y + nodeH;
        const x2 = to.x + nodeW / 2;
        const y2 = to.y;
        const midY = (y1 + y2) / 2;
        return `<path class="flow-edge" d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" marker-end="url(#arrow)" />`;
      })
      .join("");

    const nodes = spec.nodes
      .map((node) => {
        const pos = positions.get(node.id);
        const color = node.layer ? LAYER_COLORS[node.layer] || "#2457f5" : "#2457f5";
        return `<g class="flow-node" transform="translate(${pos.x}, ${pos.y})">
          <rect width="${nodeW}" height="${nodeH}" rx="4" style="stroke:${color}" />
          <text x="${nodeW / 2}" y="20" class="flow-node-label">${escapeHtml(node.label)}</text>
          ${node.sub ? `<text x="${nodeW / 2}" y="38" class="flow-node-sub">${escapeHtml(node.sub)}</text>` : ""}
        </g>`;
      })
      .join("");

    return `<figure class="viz-flow" ${spec.id ? `id="${spec.id}"` : ""}>
      ${spec.title ? `<figcaption>${escapeHtml(spec.title)}</figcaption>` : ""}
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(spec.title || "Flow diagram")}">
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" class="flow-arrow-head" />
          </marker>
        </defs>
        ${edges}
        ${nodes}
      </svg>
    </figure>`;
  }

  /** @param {{ steps: { title: string, detail: string, layer?: string }[] }} spec */
  function renderPipeline(spec) {
    return `<ol class="viz-pipeline">
      ${spec.steps
        .map(
          (step, i) => `<li class="viz-pipeline-step" style="--step-color:${LAYER_COLORS[step.layer] || "#2457f5"}">
            <span class="viz-pipeline-num">${i + 1}</span>
            <div class="viz-pipeline-body">
              <strong>${escapeHtml(step.title)}</strong>
              <span>${escapeHtml(step.detail)}</span>
            </div>
          </li>`,
        )
        .join("")}
    </ol>`;
  }

  /** @param {typeof CONCEPTS[0]} concept */
  function renderConceptCard(concept) {
    const related = (concept.connects || [])
      .map((id) => `<span class="link-chip">${escapeHtml(conceptTitle(id))}</span>`)
      .join("");

    return `<article class="file-card concept-card" data-layer="${concept.layer}" id="concept-${escapeHtml(concept.id)}" style="--badge-color:${LAYER_COLORS[concept.layer] || "#2457f5"}">
      <header class="file-card-head">
        <span class="file-icon" style="color:${LAYER_COLORS[concept.layer]}">${layerIcon(concept.layer)}</span>
        <div>
          ${layerBadge(concept.layer)}
          <h3 class="file-path">${escapeHtml(concept.title)}</h3>
        </div>
      </header>
      <p class="file-role"><strong>${escapeHtml(concept.summary)}</strong></p>
      <p class="concept-detail">${escapeHtml(concept.detail)}</p>
      ${related ? `<div class="file-links"><span class="file-links-label">Related ideas</span>${related}</div>` : ""}
    </article>`;
  }

  function renderConceptGrid(filter = "all") {
    const items = filter === "all" ? CONCEPTS : CONCEPTS.filter((c) => c.layer === filter);
    return `<div class="file-grid" data-filter="${filter}">
      ${items.map(renderConceptCard).join("")}
    </div>`;
  }

  function renderConceptFilters() {
    const layers = ["all", ...new Set(CONCEPTS.map((c) => c.layer))];
    return `<div class="layer-filters" role="tablist">
      ${layers
        .map((layer) => {
          const label = layer === "all" ? "Everything" : LAYER_LABELS[layer] || layer;
          const count = layer === "all" ? CONCEPTS.length : CONCEPTS.filter((c) => c.layer === layer).length;
          return `<button type="button" class="layer-filter${layer === "all" ? " active" : ""}" data-layer="${layer}" role="tab">${escapeHtml(label)} <em>${count}</em></button>`;
        })
        .join("")}
    </div>`;
  }

  function initConceptFilters() {
    const container = document.querySelector("[data-concept-grid-host]");
    const filters = document.querySelector(".layer-filters");
    if (!container || !filters) return;

    filters.addEventListener("click", (event) => {
      const btn = event.target.closest(".layer-filter");
      if (!btn) return;
      const layer = btn.getAttribute("data-layer") || "all";
      filters.querySelectorAll(".layer-filter").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      container.innerHTML = renderConceptGrid(layer);
    });
  }

  function renderSwimlane(spec) {
    return `<div class="viz-swimlane">
      ${spec.lanes
        .map(
          (lane) => `<div class="swimlane" style="--lane-color:${LAYER_COLORS[lane.layer] || "#2457f5"}">
            <div class="swimlane-label">${escapeHtml(lane.label)}</div>
            <div class="swimlane-items">
              ${lane.items.map((item) => `<div class="swimlane-item"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></div>`).join("")}
            </div>
          </div>`,
        )
        .join("")}
    </div>`;
  }

  function renderCommandChips(commands) {
    return `<div class="command-chips">
      ${commands
        .map(
          (cmd) => `<div class="command-chip">
            <code>${escapeHtml(cmd.name)}</code>
            <span>${escapeHtml(cmd.desc)}</span>
          </div>`,
        )
        .join("")}
    </div>`;
  }

  function renderLatencyScale() {
    return `<div class="latency-scale">
      <div class="latency-bar-item"><span class="latency good"></span><strong>&lt;150 ms</strong><span>Fast</span></div>
      <div class="latency-bar-item"><span class="latency warn"></span><strong>150–300 ms</strong><span>Moderate</span></div>
      <div class="latency-bar-item"><span class="latency slow"></span><strong>&gt;300 ms</strong><span>Slow</span></div>
      <div class="latency-bar-item"><span class="latency failed"></span><strong>Failed</strong><span>Error / timeout</span></div>
    </div>`;
  }

  function renderEnvCards(envs) {
    return `<div class="env-cards">
      ${envs
        .map(
          (env) => `<div class="env-card">
            <code>${escapeHtml(env.name)}</code>
            <div class="env-badges">
              <span class="env-badge ${env.local ? "yes" : "no"}">Local: ${env.local ? "yes" : "no"}</span>
              <span class="env-badge ${env.prod ? "yes" : "no"}">Prod: ${env.prod ? "yes" : "no"}</span>
            </div>
            <p>${escapeHtml(env.desc)}</p>
          </div>`,
        )
        .join("")}
    </div>`;
  }

  function renderDevLocalDiagram() {
    return `<div class="dev-split-diagram">
      <div class="dev-process app">
        <span class="dev-process-icon">◻</span>
        <strong>Website</strong>
        <code>port 3000</code>
        <span>What you open in the browser</span>
      </div>
      <div class="dev-connector"><span>shared password</span></div>
      <div class="dev-process probe">
        <span class="dev-process-icon">◎</span>
        <strong>Practice probe</strong>
        <code>port 8787</code>
        <span>One fake test location on your machine</span>
      </div>
      <div class="dev-launcher">One command starts both together</div>
    </div>`;
  }

  function mount(targetId, html) {
    const el = document.getElementById(targetId);
    if (el) el.innerHTML = html;
  }

  window.LatencymapVisuals = {
    renderFlowSvg,
    renderPipeline,
    renderConceptCard,
    renderConceptGrid,
    renderConceptFilters,
    renderSwimlane,
    renderCommandChips,
    renderLatencyScale,
    renderEnvCards,
    renderDevLocalDiagram,
    initConceptFilters,
    mount,
    CONCEPTS,
    conceptTitle,
    LAYER_COLORS,
    LAYER_LABELS,
  };

  document.addEventListener("DOMContentLoaded", () => {
    initConceptFilters();
  });
})();
