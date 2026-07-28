/**
 * Telephantix music chrome — car-radio / phone now-playing face for Luna Camp.
 * Title + artist on an LCD strip, seek bar, prev/next/±10s, stop.
 * Background: minimize / close keeps audio; no re-roll on unlock (soft resume via host).
 *
 *   mountCampMusicChrome({
 *     scene, getTracks, isPlaying, getIndex, playAt, stop, next, prev,
 *     hideFab?: true  — no floating “Play music” (use topbar / external trigger only)
 *     hideStrip?: true — no second mini radio strip (panel only)
 *     pause?, getAudio?, seekTo?, seekBy?, getPosition?, getDuration?
 *   })
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
  /* Sit above camp HUD / chat / docks so radio is always clickable */
  .cmc-root { position: fixed; inset: 0; pointer-events: none; z-index: 2900; isolation: isolate; }
  .cmc-fab {
    pointer-events: auto;
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(88px + env(safe-area-inset-bottom, 0px));
    z-index: 2910;
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
  .cmc-root.hide-fab .cmc-fab { display: none !important; }
  .cmc-root.hide-strip .cmc-radio-strip { display: none !important; }
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

  /* Slim car-radio strip — always on while music is wanted (even panel closed) */
  .cmc-radio-strip {
    pointer-events: auto;
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(142px + env(safe-area-inset-bottom, 0px));
    z-index: 2905;
    width: min(420px, calc(100vw - 1rem));
    display: none;
    border-radius: 12px;
    border: 1px solid rgba(52, 211, 153, 0.45);
    background: linear-gradient(180deg, #0c1220 0%, #060a12 100%);
    box-shadow: 0 8px 28px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.04);
    padding: 0.45rem 0.65rem 0.5rem;
    color: #e2e8f0;
    cursor: pointer;
  }
  .cmc-radio-strip.show { display: block; }
  /* Keep strip while panel is minimized; hide only when full panel open */
  body.cmc-panel-open:not(.cmc-panel-min) .cmc-radio-strip { display: none !important; }
  .cmc-radio-strip .rs-actions {
    display: flex; gap: 6px; margin-top: 6px; align-items: center;
  }
  .cmc-radio-strip .rs-btn {
    pointer-events: auto;
    border-radius: 999px; border: 1px solid rgba(125,211,252,0.4);
    background: rgba(12,74,110,0.55); color: #e0f2fe;
    font: 700 0.68rem/1 system-ui,sans-serif; padding: 0.35rem 0.65rem;
    cursor: pointer;
  }
  .cmc-radio-strip .rs-btn.muted {
    border-color: rgba(248,113,113,0.55); background: rgba(127,29,29,0.45); color: #fecaca;
  }
  .cmc-radio-strip .rs-brand {
    font-size: 0.58rem; font-weight: 800; letter-spacing: 0.14em;
    color: #6ee7b7; text-transform: uppercase;
  }
  .cmc-radio-strip .rs-title {
    margin: 2px 0 0; font-size: 0.82rem; font-weight: 800; color: #f0fdf4;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    font-family: ui-monospace, "Cascadia Mono", "SF Mono", Menlo, monospace;
  }
  .cmc-radio-strip .rs-meta {
    font-size: 0.65rem; color: #94a3b8; margin-top: 1px;
    display: flex; justify-content: space-between; gap: 8px;
  }
  .cmc-radio-strip .rs-bar {
    margin-top: 6px; height: 4px; border-radius: 99px;
    background: rgba(30,41,59,0.95); overflow: hidden;
  }
  .cmc-radio-strip .rs-bar > i {
    display: block; height: 100%; width: 0%;
    background: linear-gradient(90deg, #34d399, #38bdf8);
    border-radius: 99px;
  }

  .cmc-panel {
    pointer-events: none;
    position: fixed;
    left: 50%;
    bottom: calc(148px + env(safe-area-inset-bottom, 0px));
    transform: translateX(-50%) translateY(12px);
    width: min(420px, calc(100vw - 1rem));
    z-index: 2908;
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
  .cmc-panel.is-min { width: min(320px, calc(100vw - 1rem)); }
  .cmc-panel.is-min .cmc-body { display: none; }
  .cmc-panel.is-min .cmc-minibar { display: flex !important; }
  .cmc-minibar {
    display: none;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-top: 0.35rem;
  }
  .cmc-inner {
    border-radius: 16px;
    border: 1px solid rgba(167, 139, 250, 0.5);
    background: rgba(8, 12, 28, 0.98);
    box-shadow: 0 18px 50px rgba(0,0,0,0.65), 0 0 0 1px rgba(167,139,250,0.15);
    padding: 0.75rem 0.8rem 0.7rem;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    color: #e2e8f0;
  }
  .cmc-head {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
    margin-bottom: 0.45rem;
  }
  .cmc-brand { display: block; font-size: 0.68rem; font-weight: 800; color: #6ee7b7; letter-spacing: 0.12em; text-transform: uppercase; }
  .cmc-now { margin: 0.15rem 0 0; font-size: 0.95rem; font-weight: 800; color: #f8fafc; line-height: 1.25; }
  .cmc-sub { font-size: 0.72rem; font-weight: 500; color: #94a3b8; }
  .cmc-head-actions { display: flex; gap: 4px; flex-shrink: 0; }
  .cmc-icon {
    width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(148,163,184,0.35);
    background: rgba(15,23,42,0.9); color: #e2e8f0; font-size: 1rem; font-weight: 700;
    cursor: pointer; line-height: 1;
  }
  .cmc-icon:active { transform: scale(0.95); }

  /* Phone / car radio LCD */
  .cmc-lcd {
    border-radius: 12px;
    border: 1px solid rgba(52, 211, 153, 0.35);
    background: linear-gradient(180deg, #04140f 0%, #02080a 100%);
    box-shadow: inset 0 0 24px rgba(16, 185, 129, 0.12);
    padding: 0.65rem 0.75rem 0.55rem;
    margin-bottom: 0.55rem;
  }
  .cmc-lcd-row {
    display: flex; justify-content: space-between; align-items: baseline; gap: 8px;
    font-size: 0.62rem; font-weight: 700; color: #34d399; letter-spacing: 0.08em;
    text-transform: uppercase; margin-bottom: 4px;
  }
  .cmc-lcd-title {
    font-family: ui-monospace, "Cascadia Mono", "SF Mono", Menlo, monospace;
    font-size: 1.02rem; font-weight: 800; color: #ecfdf5;
    line-height: 1.25; word-break: break-word;
  }
  .cmc-lcd-artist {
    margin-top: 2px; font-size: 0.75rem; color: #6ee7b7; opacity: 0.9;
  }
  .cmc-lcd-times {
    display: flex; justify-content: space-between;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 0.68rem; color: #86efac; margin-top: 8px;
  }
  .cmc-seek {
    width: 100%; margin: 6px 0 0; accent-color: #34d399; height: 1.35rem;
    cursor: pointer;
  }

  .cmc-controls { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 0.55rem; }
  .cmc-chip {
    border-radius: 999px; border: 1px solid rgba(125,211,252,0.4);
    background: rgba(12,74,110,0.45); color: #e0f2fe;
    font: 700 0.72rem/1 system-ui,sans-serif; padding: 0.45rem 0.75rem;
    cursor: pointer;
  }
  .cmc-chip.stop { border-color: rgba(248,113,113,0.5); background: rgba(127,29,29,0.4); color: #fecaca; }
  .cmc-chip.muted {
    border-color: rgba(248,113,113,0.55);
    background: rgba(127,29,29,0.45);
    color: #fecaca;
  }
  .cmc-chip.dj-on {
    border-color: rgba(251, 191, 36, 0.75);
    background: linear-gradient(135deg, rgba(120,53,15,0.75), rgba(76,29,149,0.55));
    color: #fef3c7;
    box-shadow: 0 0 14px rgba(251, 191, 36, 0.35);
  }
  .cmc-chip:active { transform: scale(0.96); }
  .cmc-dj-line {
    margin: 0 0 0.5rem;
    padding: 0.45rem 0.55rem;
    border-radius: 10px;
    border: 1px solid rgba(52, 211, 153, 0.35);
    background: rgba(6, 24, 18, 0.85);
    color: #bbf7d0;
    font-size: 0.75rem;
    line-height: 1.35;
    font-style: italic;
  }
  .cmc-list {
    max-height: min(32vh, 220px); overflow-y: auto; -webkit-overflow-scrolling: touch;
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
    .cmc-radio-strip { bottom: calc(150px + env(safe-area-inset-bottom, 0px)); }
  }
  .cmc-root[data-scene="luna-3d"] .cmc-fab {
    bottom: calc(188px + env(safe-area-inset-bottom, 0px));
  }
  .cmc-root[data-scene="luna-3d"] .cmc-panel {
    bottom: calc(248px + env(safe-area-inset-bottom, 0px));
  }
  .cmc-root[data-scene="luna-3d"] .cmc-radio-strip {
    bottom: calc(242px + env(safe-area-inset-bottom, 0px));
  }
  @media (max-width: 640px) {
    .cmc-root[data-scene="luna-3d"] .cmc-fab {
      bottom: calc(200px + env(safe-area-inset-bottom, 0px));
    }
    .cmc-root[data-scene="luna-3d"] .cmc-panel {
      bottom: calc(258px + env(safe-area-inset-bottom, 0px));
    }
    .cmc-root[data-scene="luna-3d"] .cmc-radio-strip {
      bottom: calc(252px + env(safe-area-inset-bottom, 0px));
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

function fmtTime(sec) {
  const n = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * @param {object} api
 */
export function mountCampMusicChrome(api = {}) {
  injectStyles();
  const scene = api.scene || "camp";
  // Only one player chrome in the page
  document.getElementById("camp-music-chrome")?.remove();
  document.querySelectorAll(".cmc-root").forEach((el) => el.remove());

  const root = document.createElement("div");
  root.id = "camp-music-chrome";
  root.className = "cmc-root";
  root.dataset.scene = scene;
  if (api.hideFab) root.classList.add("hide-fab");
  if (api.hideStrip !== false) root.classList.add("hide-strip"); // default: one panel only
  root.innerHTML = `
    <button type="button" class="cmc-fab" id="cmc-fab" aria-expanded="false" title="Play Telephantix music">
      <span id="cmc-fab-label">♪ Play music</span>
    </button>
    <div class="cmc-radio-strip" id="cmc-radio-strip" title="Open player" hidden>
      <div class="rs-brand">Telephantix · DJ Vox</div>
      <div class="rs-title" id="cmc-strip-title">—</div>
      <div class="rs-meta">
        <span id="cmc-strip-artist">Telephantix</span>
        <span id="cmc-strip-time">0:00</span>
      </div>
      <div class="rs-bar" aria-hidden="true"><i id="cmc-strip-fill"></i></div>
      <div class="rs-actions">
        <button type="button" class="rs-btn" id="cmc-strip-mute" title="Mute / unmute">Mute</button>
        <button type="button" class="rs-btn" id="cmc-strip-expand" title="Expand player">Expand</button>
      </div>
    </div>
    <div class="cmc-panel" id="cmc-panel" aria-label="Telephantix radio" hidden>
      <div class="cmc-inner">
        <div class="cmc-head">
          <div>
            <span class="cmc-brand">Telephantix Radio</span>
            <p class="cmc-now"><span id="cmc-title">Ready</span><br /><span class="cmc-sub" id="cmc-sub">Tap Play music</span></p>
          </div>
          <div class="cmc-head-actions">
            <button type="button" class="cmc-icon" id="cmc-mute-icon" title="Mute">🔇</button>
            <button type="button" class="cmc-icon" id="cmc-min" title="Minimize (keep playing)">−</button>
            <button type="button" class="cmc-icon" id="cmc-max" title="Expand" hidden>+</button>
            <button type="button" class="cmc-icon" id="cmc-close" title="Close panel (keep playing)">×</button>
          </div>
        </div>
        <div class="cmc-minibar" id="cmc-minibar" aria-label="Minimized controls">
          <button type="button" class="cmc-chip" id="cmc-min-prev">Prev</button>
          <button type="button" class="cmc-chip" id="cmc-min-play">Play</button>
          <button type="button" class="cmc-chip" id="cmc-min-next">Next</button>
          <button type="button" class="cmc-chip" id="cmc-min-mute">Mute</button>
          <button type="button" class="cmc-chip" id="cmc-min-expand">Expand</button>
        </div>
        <div class="cmc-body" id="cmc-body">
          <div class="cmc-lcd" id="cmc-lcd" aria-live="polite">
            <div class="cmc-lcd-row">
              <span id="cmc-lcd-station">FM · Luna Camp</span>
              <span id="cmc-lcd-state">STANDBY</span>
            </div>
            <div class="cmc-lcd-title" id="cmc-lcd-title">No track</div>
            <div class="cmc-lcd-artist" id="cmc-lcd-artist">Telephantix</div>
            <div class="cmc-lcd-times">
              <span id="cmc-t-cur">0:00</span>
              <span id="cmc-t-dur">0:00</span>
            </div>
            <input type="range" class="cmc-seek" id="cmc-seek" min="0" max="1000" value="0" step="1" aria-label="Seek" />
          </div>
          <div class="cmc-controls">
            <button type="button" class="cmc-chip" id="cmc-back" title="Back 10s">−10s</button>
            <button type="button" class="cmc-chip" id="cmc-prev">Prev</button>
            <button type="button" class="cmc-chip" id="cmc-playpause">Play</button>
            <button type="button" class="cmc-chip" id="cmc-next">Next</button>
            <button type="button" class="cmc-chip" id="cmc-fwd" title="Forward 10s">+10s</button>
            <button type="button" class="cmc-chip" id="cmc-mute" title="Mute music (keeps playing silently)">Mute</button>
            <button type="button" class="cmc-chip" id="cmc-shuffle" title="Shuffle playlist (new random order)">Shuffle</button>
            <button type="button" class="cmc-chip" id="cmc-dj" title="DJ Vox — free overnight host between tracks">DJ Vox</button>
            <button type="button" class="cmc-chip stop" id="cmc-stop">Stop</button>
          </div>
          <p class="cmc-dj-line" id="cmc-dj-line" hidden></p>
          <div class="cmc-list" id="cmc-list"></div>
          <p class="cmc-hint" id="cmc-hint">Front player · minimize keeps sound · mute keeps place · DJ optional</p>
        </div>
      </div>
    </div>
  `;
  // Always last in DOM so stacking wins even without huge z-index wars
  document.body.appendChild(root);

  let panelOpen = false;
  let minimized = false;
  let seekDragging = false;
  let tickTimer = null;

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
  const strip = root.querySelector("#cmc-radio-strip");
  const stripTitle = root.querySelector("#cmc-strip-title");
  const stripArtist = root.querySelector("#cmc-strip-artist");
  const stripTime = root.querySelector("#cmc-strip-time");
  const stripFill = root.querySelector("#cmc-strip-fill");
  const lcdTitle = root.querySelector("#cmc-lcd-title");
  const lcdArtist = root.querySelector("#cmc-lcd-artist");
  const lcdState = root.querySelector("#cmc-lcd-state");
  const tCur = root.querySelector("#cmc-t-cur");
  const tDur = root.querySelector("#cmc-t-dur");
  const seekEl = root.querySelector("#cmc-seek");
  const playPauseBtn = root.querySelector("#cmc-playpause");
  const djBtn = root.querySelector("#cmc-dj");
  const djLineEl = root.querySelector("#cmc-dj-line");
  const muteBtn = root.querySelector("#cmc-mute");
  const muteIcon = root.querySelector("#cmc-mute-icon");
  const minPlay = root.querySelector("#cmc-min-play");
  const minMute = root.querySelector("#cmc-min-mute");
  const minPrev = root.querySelector("#cmc-min-prev");
  const minNext = root.querySelector("#cmc-min-next");
  const minExpand = root.querySelector("#cmc-min-expand");
  const stripMute = root.querySelector("#cmc-strip-mute");
  const stripExpand = root.querySelector("#cmc-strip-expand");
  const shuffleBtn = root.querySelector("#cmc-shuffle");
  let djOn = false;

  function tracks() {
    try {
      const t = api.getTracks?.() || [];
      return Array.isArray(t) ? t : [];
    } catch {
      return [];
    }
  }

  /** User wants music on (may be paused by OS) */
  function wantedOn() {
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

  function pos() {
    try {
      if (typeof api.getPosition === "function") return Number(api.getPosition()) || 0;
      const a = api.getAudio?.();
      return Number(a?.currentTime) || 0;
    } catch {
      return 0;
    }
  }

  function dur() {
    try {
      if (typeof api.getDuration === "function") {
        const d = Number(api.getDuration()) || 0;
        if (d > 0) return d;
      }
      const a = api.getAudio?.();
      const d = Number(a?.duration) || 0;
      return Number.isFinite(d) ? d : 0;
    } catch {
      return 0;
    }
  }

  function audioPaused() {
    try {
      const a = api.getAudio?.();
      if (a) return !!a.paused;
    } catch (_) {}
    return !wantedOn();
  }

  function isMuted() {
    try {
      if (typeof api.isMuted === "function") return !!api.isMuted();
      const a = api.getAudio?.();
      if (a) return !!a.muted;
    } catch (_) {}
    return false;
  }

  function setMuted(on) {
    const m = !!on;
    try {
      if (typeof api.setMuted === "function") {
        api.setMuted(m);
      } else {
        const a = api.getAudio?.();
        if (a) a.muted = m;
      }
    } catch (_) {}
    refresh();
  }

  function toggleMute() {
    setMuted(!isMuted());
  }

  /** Re-assert front stack when opening (beats late-mounted HUD) */
  function bringToFront() {
    try {
      if (root.parentElement === document.body) {
        document.body.appendChild(root);
      }
      root.style.zIndex = "2900";
    } catch (_) {}
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
        ? `${ts.length} songs · car/phone lock shows title · unlock keeps place · ${scene}`
        : "Catalog loading…";
    }
  }

  function updateProgressUi() {
    const ts = tracks();
    const idx = index();
    const t = ts[idx] || null;
    const on = wantedOn();
    const p = pos();
    const d = dur();
    const paused = audioPaused();

    const title = t?.title || (ts.length ? "Ready" : "No tracks");
    const artist = t?.artist || "Telephantix";

    if (titleEl) titleEl.textContent = title;
    if (lcdTitle) lcdTitle.textContent = title;
    if (lcdArtist) lcdArtist.textContent = artist;
    const muted = isMuted();
    if (lcdState) {
      lcdState.textContent = !on
        ? "STANDBY"
        : muted
          ? "MUTED"
          : paused
            ? "PAUSED"
            : "ON AIR";
    }
    if (subEl) {
      subEl.textContent = on
        ? `${idx + 1} / ${ts.length || "?"} · ${muted ? "muted" : paused ? "paused" : "playing"} · ${fmtTime(p)}`
        : ts.length
          ? `${ts.length} songs ready · tap Play music`
          : "Tap Play music when ready";
    }
    if (tCur) tCur.textContent = fmtTime(p);
    if (tDur) tDur.textContent = d > 0 ? fmtTime(d) : "—:——";
    if (seekEl && !seekDragging) {
      const max = 1000;
      seekEl.max = String(max);
      const pct = d > 0 ? Math.min(1, p / d) : 0;
      seekEl.value = String(Math.round(pct * max));
    }
    if (playPauseBtn) {
      playPauseBtn.textContent = !on || paused ? "Play" : "Pause";
    }
    if (minPlay) minPlay.textContent = !on || paused ? "Play" : "Pause";
    const muteLabel = muted ? "Unmute" : "Mute";
    if (muteBtn) {
      muteBtn.textContent = muteLabel;
      muteBtn.classList.toggle("muted", muted);
      muteBtn.title = muted ? "Unmute music" : "Mute music (keeps playing)";
    }
    if (minMute) {
      minMute.textContent = muteLabel;
      minMute.classList.toggle("muted", muted);
    }
    if (muteIcon) {
      muteIcon.textContent = muted ? "🔈" : "🔇";
      muteIcon.title = muteLabel;
      muteIcon.classList.toggle("muted", muted);
    }
    if (stripMute) {
      stripMute.textContent = muteLabel;
      stripMute.classList.toggle("muted", muted);
    }
    if (djBtn) {
      djBtn.classList.toggle("dj-on", djOn);
      djBtn.textContent = djOn ? "Vox · ON" : "DJ Vox";
      djBtn.title = djOn
        ? "DJ Vox on — free overnight host (tap to mute the mic / turn off)"
        : "DJ Vox — free character voice between your tracks";
    }

    // Strip only if allowed — never alongside an open panel (avoids two windows)
    if (strip) {
      const allowStrip = !root.classList.contains("hide-strip");
      const showStrip = allowStrip && on && !panelOpen;
      strip.hidden = !showStrip;
      strip.classList.toggle("show", showStrip);
      if (stripTitle) stripTitle.textContent = muted ? `🔇 ${title}` : title;
      if (stripArtist) stripArtist.textContent = djOn ? "DJ · Telephantix" : artist;
      if (stripTime) stripTime.textContent = d > 0 ? `${fmtTime(p)} / ${fmtTime(d)}` : fmtTime(p);
      if (stripFill) {
        const pct = d > 0 ? Math.min(100, (p / d) * 100) : 0;
        stripFill.style.width = `${pct}%`;
      }
    }
  }

  function refresh() {
    const on = wantedOn();

    if (fabLabel) {
      if (panelOpen && !minimized) fabLabel.textContent = "Hide music";
      else if (panelOpen && minimized) fabLabel.textContent = "Expand music";
      else if (on) fabLabel.textContent = isMuted() ? "🔇 Radio" : "Show radio";
      else fabLabel.textContent = "♪ Play music";
    }
    if (fab) {
      fab.classList.toggle("on", panelOpen && !minimized);
      fab.classList.toggle("playing", on);
      fab.setAttribute("aria-expanded", panelOpen && !minimized ? "true" : "false");
      fab.title = on
        ? panelOpen && !minimized
          ? "Hide player (music keeps playing)"
          : "Show radio · minimize / mute available"
        : "Play Telephantix music — opens radio";
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
    document.body.classList.toggle("cmc-panel-min", panelOpen && minimized);
    document.body.classList.toggle("cmc-playing", on);
    document.body.classList.toggle("cmc-muted", isMuted());
    renderList();
    updateProgressUi();
    ensureTick();
  }

  function ensureTick() {
    if (tickTimer) return;
    tickTimer = setInterval(() => {
      if (!wantedOn() && !panelOpen) return;
      updateProgressUi();
    }, 400);
  }

  function openPanel(opts = {}) {
    panelOpen = true;
    minimized = false;
    bringToFront();
    // Only start if fully off — never re-roll when already on / paused mid-song
    if (opts.play !== false && !wantedOn()) {
      api.playAt?.(index());
    }
    refresh();
  }

  function minimizePanel() {
    if (!panelOpen) openPanel({ play: false });
    minimized = true;
    bringToFront();
    refresh();
  }

  function expandPanel() {
    panelOpen = true;
    minimized = false;
    bringToFront();
    refresh();
  }

  function closePanelKeepPlaying() {
    panelOpen = false;
    minimized = false;
    refresh();
  }

  fab?.addEventListener("click", () => {
    if (!panelOpen) {
      openPanel({ play: true });
      return;
    }
    if (minimized) {
      minimized = false;
      refresh();
      return;
    }
    panelOpen = false;
    refresh();
  });

  strip?.addEventListener("click", (e) => {
    // Don't expand when tapping mute / expand buttons
    if (e.target.closest(".rs-btn")) return;
    openPanel({ play: false });
  });
  stripMute?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMute();
  });
  stripExpand?.addEventListener("click", (e) => {
    e.stopPropagation();
    expandPanel();
  });

  let holdT = null;
  fab?.addEventListener("pointerdown", () => {
    if (!wantedOn()) return;
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

  minBtn?.addEventListener("click", () => minimizePanel());
  maxBtn?.addEventListener("click", () => expandPanel());
  minExpand?.addEventListener("click", () => expandPanel());
  root.querySelector("#cmc-close")?.addEventListener("click", () => closePanelKeepPlaying());
  function doPrev(e) {
    try {
      e?.preventDefault?.();
      e?.stopPropagation?.();
    } catch (_) {}
    try {
      if (typeof api.prev === "function") api.prev();
      else api.playAt?.(Math.max(0, index() - 1));
    } catch (err) {
      console.warn("[cmc] prev", err);
    }
    setTimeout(() => refresh(), 50);
  }
  function doNext(e) {
    try {
      e?.preventDefault?.();
      e?.stopPropagation?.();
    } catch (_) {}
    try {
      if (typeof api.next === "function") api.next();
      else api.playAt?.(index() + 1);
    } catch (err) {
      console.warn("[cmc] next", err);
    }
    setTimeout(() => refresh(), 50);
  }
  root.querySelector("#cmc-prev")?.addEventListener("click", doPrev);
  root.querySelector("#cmc-next")?.addEventListener("click", doNext);
  minPrev?.addEventListener("click", doPrev);
  minNext?.addEventListener("click", doNext);
  shuffleBtn?.addEventListener("click", (e) => {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (_) {}
    try {
      if (typeof api.shuffle === "function") api.shuffle();
      else console.warn("[cmc] no shuffle handler");
    } catch (err) {
      console.warn("[cmc] shuffle", err);
    }
    setTimeout(() => refresh(), 80);
  });
  root.querySelector("#cmc-stop")?.addEventListener("click", () => {
    api.stop?.();
    if (djOn) {
      djOn = false;
      try {
        api.setDjMode?.(false);
      } catch (_) {}
    }
    // Unmute on hard stop so next play is audible
    setMuted(false);
    refresh();
  });
  muteBtn?.addEventListener("click", () => toggleMute());
  muteIcon?.addEventListener("click", () => toggleMute());
  minMute?.addEventListener("click", () => toggleMute());
  djBtn?.addEventListener("click", () => {
    djOn = !djOn;
    try {
      api.setDjMode?.(djOn);
    } catch (_) {}
    if (djOn && !wantedOn()) {
      // Start music so DJ has a bed to talk over
      api.playAt?.(index());
    }
    if (djLineEl) {
      djLineEl.hidden = !djOn;
      if (djOn) djLineEl.textContent = "DJ Vox on the boards — free overnight host…";
    }
    bringToFront();
    refresh();
  });
  root.querySelector("#cmc-back")?.addEventListener("click", (e) => {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (_) {}
    try {
      if (typeof api.seekBy === "function") api.seekBy(-10);
      else if (typeof api.seekTo === "function") api.seekTo(Math.max(0, pos() - 10));
      else {
        const a = api.getAudio?.();
        if (a) a.currentTime = Math.max(0, (a.currentTime || 0) - 10);
      }
    } catch (err) {
      console.warn("[cmc] seek back", err);
    }
    setTimeout(() => refresh(), 40);
  });
  root.querySelector("#cmc-fwd")?.addEventListener("click", (e) => {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (_) {}
    try {
      if (typeof api.seekBy === "function") api.seekBy(10);
      else if (typeof api.seekTo === "function") api.seekTo(pos() + 10);
      else {
        const a = api.getAudio?.();
        if (a) a.currentTime = (a.currentTime || 0) + 10;
      }
    } catch (err) {
      console.warn("[cmc] seek fwd", err);
    }
    setTimeout(() => refresh(), 40);
  });
  function togglePlayPause() {
    if (!wantedOn()) {
      api.playAt?.(index());
    } else if (audioPaused()) {
      api.playAt?.(index()); // soft resume same index
    } else if (typeof api.pause === "function") {
      api.pause();
    } else {
      try {
        api.getAudio?.()?.pause();
      } catch (_) {}
    }
    refresh();
  }
  playPauseBtn?.addEventListener("click", () => togglePlayPause());
  minPlay?.addEventListener("click", () => togglePlayPause());

  seekEl?.addEventListener("pointerdown", () => {
    seekDragging = true;
  });
  seekEl?.addEventListener("pointerup", () => {
    seekDragging = false;
  });
  seekEl?.addEventListener("change", () => {
    const d = dur();
    if (!(d > 0) || !seekEl) return;
    const pct = Number(seekEl.value) / Number(seekEl.max || 1000);
    const t = pct * d;
    if (typeof api.seekTo === "function") api.seekTo(t);
    else {
      try {
        const a = api.getAudio?.();
        if (a) a.currentTime = t;
      } catch (_) {}
    }
    seekDragging = false;
    refresh();
  });
  seekEl?.addEventListener("input", () => {
    // Live preview of time while dragging
    const d = dur();
    if (!(d > 0) || !seekEl || !tCur) return;
    const pct = Number(seekEl.value) / Number(seekEl.max || 1000);
    tCur.textContent = fmtTime(pct * d);
  });

  refresh();

  // Default: DJ Vox on unless host sets djDefault: false
  const wantDefaultDj = api.djDefault !== false;
  if (wantDefaultDj) {
    djOn = true;
    if (djLineEl) {
      djLineEl.hidden = false;
      djLineEl.textContent = "DJ Vox · free overnight host (on by default)";
    }
    try {
      api.setDjMode?.(true);
    } catch (_) {}
    refresh();
  }

  return {
    refresh,
    openPanel,
    closePanel: closePanelKeepPlaying,
    setPlaying: () => refresh(),
    setDjOn(on) {
      djOn = !!on;
      if (djLineEl) {
        djLineEl.hidden = !djOn;
        if (!djOn) djLineEl.textContent = "";
        else if (!djLineEl.textContent) {
          djLineEl.textContent = "DJ Vox on the boards…";
        }
      }
      refresh();
    },
    setDjLine(text) {
      if (!djLineEl) return;
      const t = String(text || "").trim();
      if (!t) {
        if (!djOn) djLineEl.hidden = true;
        return;
      }
      djLineEl.hidden = false;
      djLineEl.textContent = t;
    },
    isDjOn: () => djOn,
  };
}
