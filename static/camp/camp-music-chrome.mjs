/**
 * Telephantix music chrome for Luna Camp 2D / 3D — same spirit as Relics hub player.
 * Big Play music chip · panel with prev/next/stop · scrollable track list · no autoplay.
 *
 * Usage:
 *   import { mountCampMusicChrome } from "/static/camp/camp-music-chrome.mjs?v=1";
 *   const ui = mountCampMusicChrome({
 *     scene: "luna-2d",
 *     getTracks: () => tracks,           // [{ id, title, src }]
 *     isPlaying: () => bool,
 *     getIndex: () => number,
 *     playAt: (i) => {},                 // start track i (user gesture)
 *     stop: () => {},                    // hard stop / off
 *     pause: () => {},                   // optional soft pause
 *     next: () => {},
 *     prev: () => {},
 *   });
 *   ui.refresh(); // after catalog hydrate / play state change
 */

const STYLE_ID = "camp-music-chrome-css";

function injectStyles() {
  let s = document.getElementById(STYLE_ID);
  if (!s) {
    s = document.createElement("style");
    s.id = STYLE_ID;
    document.head.appendChild(s);
  }
  s.textContent = `
  .cmc-root { position: fixed; inset: 0; pointer-events: none; z-index: 48; }
  .cmc-fab {
    pointer-events: auto;
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(88px + env(safe-area-inset-bottom, 0px));
    z-index: 49;
    min-width: 9.5rem;
    min-height: 46px;
    padding: 0.7rem 1.25rem;
    border-radius: 999px;
    border: 2px solid rgba(167, 139, 250, 0.85);
    font: 800 0.86rem/1.1 system-ui, -apple-system, "Segoe UI", sans-serif;
    letter-spacing: 0.02em;
    color: #f5f3ff;
    background: linear-gradient(135deg, #5b21b6 0%, #0e7490 55%, #0284c7 100%);
    box-shadow: 0 0 0 0 rgba(167, 139, 250, 0.55), 0 10px 28px rgba(0,0,0,0.55);
    cursor: pointer;
    animation: cmc-pulse 2.4s ease-in-out infinite;
  }
  .cmc-fab:hover { filter: brightness(1.08); }
  .cmc-fab:active { transform: translateX(-50%) scale(0.97); }
  .cmc-fab.on {
    animation: none;
    border-color: #fde68a;
    box-shadow: 0 0 22px rgba(251, 191, 36, 0.45), 0 10px 28px rgba(0,0,0,0.5);
    background: linear-gradient(135deg, #a16207, #0e7490 50%, #7c3aed);
  }
  .cmc-fab.playing {
    animation: none;
    border-color: #86efac;
    box-shadow: 0 0 20px rgba(52, 211, 153, 0.45);
  }
  @keyframes cmc-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(167,139,250,0.55), 0 10px 28px rgba(0,0,0,0.55); }
    50% { box-shadow: 0 0 0 10px rgba(167,139,250,0), 0 10px 28px rgba(0,0,0,0.55); }
  }
  body.cmc-panel-open .cmc-fab {
    left: 0.65rem;
    transform: none;
    animation: none;
    min-width: auto;
    padding: 0.55rem 0.9rem;
    font-size: 0.78rem;
  }
  .cmc-panel {
    pointer-events: none;
    position: fixed;
    left: 50%;
    bottom: calc(148px + env(safe-area-inset-bottom, 0px));
    transform: translateX(-50%) translateY(12px);
    width: min(420px, calc(100vw - 1rem));
    z-index: 48;
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .cmc-panel.open {
    pointer-events: auto;
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  .cmc-panel:not(.open) { display: none !important; }
  .cmc-panel.open { display: block !important; }
  .cmc-panel.is-min { width: min(280px, calc(100vw - 1rem)); }
  .cmc-panel.is-min .cmc-body { display: none; }
  .cmc-inner {
    border-radius: 16px;
    border: 1px solid rgba(167, 139, 250, 0.5);
    background: rgba(8, 12, 28, 0.96);
    box-shadow: 0 14px 40px rgba(0,0,0,0.55);
    padding: 0.75rem 0.8rem 0.7rem;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: #e2e8f0;
  }
  .cmc-head {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
    margin-bottom: 0.55rem;
  }
  .cmc-brand { display: block; font-size: 0.72rem; font-weight: 800; color: #c4b5fd; letter-spacing: 0.04em; text-transform: uppercase; }
  .cmc-now { margin: 0.2rem 0 0; font-size: 0.88rem; font-weight: 700; color: #f8fafc; line-height: 1.25; }
  .cmc-sub { font-size: 0.72rem; font-weight: 500; color: #94a3b8; }
  .cmc-head-actions { display: flex; gap: 4px; flex-shrink: 0; }
  .cmc-icon {
    width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(148,163,184,0.35);
    background: rgba(15,23,42,0.9); color: #e2e8f0; font-size: 1rem; font-weight: 700;
    cursor: pointer; line-height: 1;
  }
  .cmc-icon:active { transform: scale(0.95); }
  .cmc-controls { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 0.55rem; }
  .cmc-chip {
    border-radius: 999px; border: 1px solid rgba(125,211,252,0.4);
    background: rgba(12,74,110,0.45); color: #e0f2fe;
    font: 700 0.72rem/1 system-ui,sans-serif; padding: 0.45rem 0.75rem;
    cursor: pointer;
  }
  .cmc-chip.stop { border-color: rgba(248,113,113,0.5); background: rgba(127,29,29,0.4); color: #fecaca; }
  .cmc-chip:active { transform: scale(0.96); }
  .cmc-list {
    max-height: min(38vh, 260px); overflow-y: auto; -webkit-overflow-scrolling: touch;
    display: flex; flex-direction: column; gap: 4px;
    padding-right: 2px;
  }
  .cmc-list-head {
    font-size: 0.68rem; font-weight: 800; color: #a78bfa; letter-spacing: 0.03em;
    padding: 4px 6px 2px; text-transform: uppercase;
  }
  .cmc-track {
    text-align: left; border: 1px solid rgba(51,65,85,0.8); border-radius: 10px;
    background: rgba(15,23,42,0.85); color: #e2e8f0; padding: 0.5rem 0.65rem;
    cursor: pointer; font: inherit;
  }
  .cmc-track strong { display: block; font-size: 0.8rem; font-weight: 700; }
  .cmc-track span { display: block; font-size: 0.68rem; color: #94a3b8; margin-top: 2px; }
  .cmc-track.active {
    border-color: rgba(167,139,250,0.75);
    background: linear-gradient(135deg, rgba(76,29,149,0.45), rgba(14,116,144,0.35));
  }
  .cmc-hint {
    margin: 0.5rem 0 0; font-size: 0.65rem; color: #64748b; line-height: 1.3;
  }
  @media (max-width: 640px) {
    .cmc-fab { bottom: calc(96px + env(safe-area-inset-bottom, 0px)); font-size: 0.82rem; }
    .cmc-panel { bottom: calc(156px + env(safe-area-inset-bottom, 0px)); }
  }
  /* 3D: sit higher so it clears the bottom dock / Talk / quick-bar */
  .cmc-root[data-scene="luna-3d"] .cmc-fab {
    bottom: calc(188px + env(safe-area-inset-bottom, 0px));
  }
  .cmc-root[data-scene="luna-3d"] .cmc-panel {
    bottom: calc(248px + env(safe-area-inset-bottom, 0px));
  }
  @media (max-width: 640px) {
    .cmc-root[data-scene="luna-3d"] .cmc-fab {
      bottom: calc(200px + env(safe-area-inset-bottom, 0px));
    }
    .cmc-root[data-scene="luna-3d"] .cmc-panel {
      bottom: calc(258px + env(safe-area-inset-bottom, 0px));
    }
  }
  `;
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {object} api
 * @returns {{ refresh: Function, openPanel: Function, closePanel: Function, setPlaying: Function }}
 */
export function mountCampMusicChrome(api = {}) {
  injectStyles();
  const scene = api.scene || "camp";

  // Remove prior instance if hot-reloaded
  document.getElementById("camp-music-chrome")?.remove();

  const root = document.createElement("div");
  root.id = "camp-music-chrome";
  root.className = "cmc-root";
  root.dataset.scene = scene;
  root.innerHTML = `
    <button type="button" class="cmc-fab" id="cmc-fab" aria-expanded="false" title="Play Telephantix music">
      <span id="cmc-fab-label">♪ Play music</span>
    </button>
    <div class="cmc-panel" id="cmc-panel" aria-label="Telephantix music player" hidden>
      <div class="cmc-inner">
        <div class="cmc-head">
          <div>
            <span class="cmc-brand">Telephantix Radio</span>
            <p class="cmc-now"><span id="cmc-title">Ready</span><br /><span class="cmc-sub" id="cmc-sub">Tap Play music</span></p>
          </div>
          <div class="cmc-head-actions">
            <button type="button" class="cmc-icon" id="cmc-min" title="Minimize (keep playing)">−</button>
            <button type="button" class="cmc-icon" id="cmc-max" title="Expand" hidden>+</button>
            <button type="button" class="cmc-icon" id="cmc-close" title="Close panel (keep playing)">×</button>
          </div>
        </div>
        <div class="cmc-body" id="cmc-body">
          <div class="cmc-controls">
            <button type="button" class="cmc-chip" id="cmc-prev">Prev</button>
            <button type="button" class="cmc-chip" id="cmc-next">Next</button>
            <button type="button" class="cmc-chip stop" id="cmc-stop">Stop</button>
          </div>
          <div class="cmc-list" id="cmc-list"></div>
          <p class="cmc-hint" id="cmc-hint">Full Telephantix queue · same player on Relics · 2D · 3D · never auto-starts</p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  let panelOpen = false;
  let minimized = false;

  const fab = root.querySelector("#cmc-fab");
  const fabLabel = root.querySelector("#cmc-fab-label");
  const panel = root.querySelector("#cmc-panel");
  const body = root.querySelector("#cmc-body");
  const titleEl = root.querySelector("#cmc-title");
  const subEl = root.querySelector("#cmc-sub");
  const listEl = root.querySelector("#cmc-list");
  const minBtn = root.querySelector("#cmc-min");
  const maxBtn = root.querySelector("#cmc-max");
  const hintEl = root.querySelector("#cmc-hint");

  function tracks() {
    try {
      const t = api.getTracks?.() || [];
      return Array.isArray(t) ? t : [];
    } catch {
      return [];
    }
  }

  function playing() {
    try {
      return !!api.isPlaying?.();
    } catch {
      return false;
    }
  }

  function index() {
    try {
      return Math.max(0, Number(api.getIndex?.()) || 0);
    } catch {
      return 0;
    }
  }

  function renderList() {
    const ts = tracks();
    const idx = index();
    if (!listEl) return;
    listEl.innerHTML = "";
    const head = document.createElement("div");
    head.className = "cmc-list-head";
    head.textContent = ts.length ? `${ts.length} tracks · Telephantix` : "Loading catalog…";
    listEl.appendChild(head);
    ts.forEach((t, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cmc-track" + (i === idx ? " active" : "");
      btn.innerHTML = `<strong>${esc(t.title || t.id || `Track ${i + 1}`)}</strong><span>${esc(
        t.artist || "Telephantix",
      )}</span>`;
      btn.addEventListener("click", () => {
        api.playAt?.(i);
        refresh();
      });
      listEl.appendChild(btn);
    });
    if (hintEl) {
      hintEl.textContent = ts.length
        ? `${ts.length} songs · Play / Stop · minimize keeps sound · ${scene}`
        : "Catalog loading…";
    }
  }

  function refresh() {
    const ts = tracks();
    const idx = index();
    const t = ts[idx] || null;
    const on = playing();

    if (titleEl) titleEl.textContent = t?.title || (ts.length ? "Ready" : "No tracks");
    if (subEl) {
      subEl.textContent = on
        ? `${idx + 1} / ${ts.length || "?"} · playing`
        : ts.length
          ? `${ts.length} songs ready · tap Play music`
          : "Tap Play music when ready";
    }

    if (fabLabel) {
      if (panelOpen && !minimized) fabLabel.textContent = "Hide music";
      else if (panelOpen && minimized) fabLabel.textContent = "Expand music";
      else if (on) fabLabel.textContent = "Show music";
      else fabLabel.textContent = "♪ Play music";
    }
    if (fab) {
      fab.classList.toggle("on", panelOpen && !minimized);
      fab.classList.toggle("playing", on);
      fab.setAttribute("aria-expanded", panelOpen && !minimized ? "true" : "false");
      fab.title = on
        ? panelOpen && !minimized
          ? "Hide player (music keeps playing)"
          : "Show music player · tap Stop inside to end"
        : "Play Telephantix music — opens player";
    }
    if (panel) {
      panel.hidden = !panelOpen;
      panel.classList.toggle("open", panelOpen);
      panel.classList.toggle("is-min", panelOpen && minimized);
    }
    if (body) body.hidden = !!(panelOpen && minimized);
    if (minBtn) minBtn.hidden = !!(panelOpen && minimized);
    if (maxBtn) maxBtn.hidden = !(panelOpen && minimized);
    document.body.classList.toggle("cmc-panel-open", panelOpen);
    document.body.classList.toggle("cmc-playing", on);
    renderList();
  }

  function openPanel(opts = {}) {
    panelOpen = true;
    minimized = false;
    if (opts.play !== false && !playing()) {
      api.playAt?.(index());
    }
    refresh();
  }

  function closePanelKeepPlaying() {
    panelOpen = false;
    minimized = false;
    refresh();
  }

  fab?.addEventListener("click", () => {
    // Relics-style: first tap opens + plays; if open → hide panel (keep playing);
    // if playing & closed → show panel; long path uses Stop inside to kill sound.
    if (!panelOpen) {
      openPanel({ play: true });
      return;
    }
    if (minimized) {
      minimized = false;
      refresh();
      return;
    }
    // Hide panel; keep audio. Second intent to stop = Stop chip.
    panelOpen = false;
    refresh();
  });

  // Double-click / long-press alternative: stop entirely when holding fab while playing
  let holdT = null;
  fab?.addEventListener("pointerdown", () => {
    if (!playing()) return;
    holdT = setTimeout(() => {
      api.stop?.();
      panelOpen = false;
      minimized = false;
      refresh();
    }, 650);
  });
  fab?.addEventListener("pointerup", () => {
    if (holdT) clearTimeout(holdT);
    holdT = null;
  });
  fab?.addEventListener("pointerleave", () => {
    if (holdT) clearTimeout(holdT);
    holdT = null;
  });

  minBtn?.addEventListener("click", () => {
    if (!panelOpen) openPanel({ play: false });
    minimized = true;
    refresh();
  });
  maxBtn?.addEventListener("click", () => {
    minimized = false;
    panelOpen = true;
    refresh();
  });
  root.querySelector("#cmc-close")?.addEventListener("click", () => closePanelKeepPlaying());
  root.querySelector("#cmc-prev")?.addEventListener("click", () => {
    api.prev?.();
    refresh();
  });
  root.querySelector("#cmc-next")?.addEventListener("click", () => {
    api.next?.();
    refresh();
  });
  root.querySelector("#cmc-stop")?.addEventListener("click", () => {
    api.stop?.();
    refresh();
  });

  refresh();

  return {
    refresh,
    openPanel,
    closePanel: closePanelKeepPlaying,
    setPlaying: () => refresh(),
  };
}
