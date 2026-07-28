/**
 * Make HUD panels grab-and-drag (mouse + touch).
 * Call: makeDraggable(panelEl, { handle: headEl })
 */

/**
 * @param {HTMLElement|null} panel
 * @param {{ handle?: HTMLElement|null, storageKey?: string, zBoost?: number }} [opts]
 */
export function makeDraggable(panel, opts = {}) {
  if (!panel || panel.dataset.dragBound === "1") return;
  panel.dataset.dragBound = "1";

  const handle = opts.handle || panel;
  handle.style.cursor = "grab";
  handle.style.touchAction = "none";
  handle.title = (handle.title || "") + (handle.title ? " · " : "") + "Drag to move";

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let origL = 0;
  let origT = 0;

  function ensurePositioned() {
    const cs = getComputedStyle(panel);
    if (cs.position === "static") panel.style.position = "fixed";
    // Convert right/bottom layouts into left/top so drag is stable
    const r = panel.getBoundingClientRect();
    if (!panel.style.left || panel.style.left === "auto") {
      panel.style.left = `${r.left}px`;
    }
    if (!panel.style.top || panel.style.top === "auto") {
      panel.style.top = `${r.top}px`;
    }
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.transform = "none";
  }

  function restore() {
    if (!opts.storageKey) return;
    try {
      const raw = localStorage.getItem(opts.storageKey);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p.left === "number" && typeof p.top === "number") {
        panel.style.position = "fixed";
        panel.style.left = `${p.left}px`;
        panel.style.top = `${p.top}px`;
        panel.style.right = "auto";
        panel.style.bottom = "auto";
        panel.style.transform = "none";
      }
    } catch (_) {}
  }

  function persist() {
    if (!opts.storageKey) return;
    try {
      const r = panel.getBoundingClientRect();
      localStorage.setItem(
        opts.storageKey,
        JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) }),
      );
    } catch (_) {}
  }

  function onDown(e) {
    if (e.button != null && e.button !== 0) return;
    // Don't start drag from interactive controls
    const t = e.target;
    if (t?.closest?.("button, a, input, textarea, select, .cmc-seek, .c3-bubble, label")) {
      return;
    }
    ensurePositioned();
    dragging = true;
    handle.style.cursor = "grabbing";
    const r = panel.getBoundingClientRect();
    startX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    startY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    origL = r.left;
    origT = r.top;
    if (opts.zBoost) {
      panel.style.zIndex = String(opts.zBoost);
    }
    try {
      handle.setPointerCapture?.(e.pointerId);
    } catch (_) {}
    e.preventDefault?.();
  }

  function onMove(e) {
    if (!dragging) return;
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    const dx = x - startX;
    const dy = y - startY;
    let nl = origL + dx;
    let nt = origT + dy;
    const maxL = window.innerWidth - 48;
    const maxT = window.innerHeight - 48;
    nl = Math.max(-rWidthPad(panel), Math.min(nl, maxL));
    nt = Math.max(0, Math.min(nt, maxT));
    panel.style.left = `${nl}px`;
    panel.style.top = `${nt}px`;
  }

  function rWidthPad(el) {
    return Math.min(120, (el.getBoundingClientRect().width || 200) * 0.5);
  }

  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    handle.style.cursor = "grab";
    try {
      handle.releasePointerCapture?.(e.pointerId);
    } catch (_) {}
    persist();
  }

  handle.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  restore();

  return {
    reset() {
      try {
        if (opts.storageKey) localStorage.removeItem(opts.storageKey);
      } catch (_) {}
      panel.style.left = "";
      panel.style.top = "";
      panel.style.right = "";
      panel.style.bottom = "";
    },
  };
}

/**
 * Batch-wire common camp panels.
 * @param {Array<{ el: HTMLElement|null, handle?: HTMLElement|null, key?: string, z?: number }>} list
 */
export function wireCampDraggables(list) {
  for (const item of list || []) {
    if (!item?.el) continue;
    makeDraggable(item.el, {
      handle: item.handle || item.el.querySelector(".c3-head, .pi-head, .cmc-head, .drag-handle") || item.el,
      storageKey: item.key || "",
      zBoost: item.z || 2700,
    });
  }
}
