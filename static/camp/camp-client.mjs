/**
 * Luna Camp Protocol client — shared by Three.js (and later 2D).
 * All brains/text go through the server; this module only transports + normalizes.
 */

const VISITOR_KEY = "luna-play-visitor-id";
const VISITOR_NAME_KEY = "luna-play-visitor-name";

export function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY) || "";
    if (!id) {
      id = `v_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export function getVisitorName() {
  try {
    return localStorage.getItem(VISITOR_NAME_KEY) || "Visitor";
  } catch {
    return "Visitor";
  }
}

async function postJSON(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail || data.message || res.statusText || "request failed";
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data;
}

async function getJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || res.statusText || "request failed");
  return data;
}

/** Discovery — super clean for README / debugging */
export function fetchProtocol() {
  return getJSON("/api/firmament/camp/protocol");
}

export function fetchVisualKits() {
  return getJSON("/api/firmament/visual/kits");
}

export function useProp(propId, opts = {}) {
  return postJSON("/api/firmament/prop/use", {
    prop_id: propId,
    visitor_id: opts.visitorId ?? getVisitorId(),
    visitor_name: opts.visitorName ?? getVisitorName(),
    agent_id: opts.agentId || "",
    speak: opts.speak !== false,
  });
}

export function enterHouse(houseId, opts = {}) {
  return postJSON("/api/firmament/house/enter", {
    house_id: houseId,
    visitor_id: opts.visitorId ?? getVisitorId(),
    visitor_name: opts.visitorName ?? getVisitorName(),
    speak: opts.speak !== false,
  });
}

export function useStructure(structureId, opts = {}) {
  return postJSON("/api/firmament/structure/use", {
    structure_id: structureId,
    visitor_id: opts.visitorId ?? getVisitorId(),
    visitor_name: opts.visitorName ?? getVisitorName(),
    speak: opts.speak !== false,
  });
}

export function fetchShop() {
  return getJSON("/api/firmament/shop/catalog");
}

export function fetchLucidFeed(channel = "random") {
  return getJSON(`/api/firmament/lucid-feed?channel=${encodeURIComponent(channel)}`);
}

export function fetchXPulse(refresh = false) {
  return getJSON(`/api/firmament/x-pulse${refresh ? "?refresh=true" : ""}`);
}

/** Shared camp feed + free world pulse (HN etc.) */
export function fetchLiveFeed() {
  return getJSON("/api/firmament/live-feed");
}

/** Hub world pulse when unified server exposes /api/pulse */
export function fetchHubPulse(force = false) {
  return getJSON(`/api/pulse${force ? "?force=1" : ""}`);
}

export async function buyShopItem(itemId, opts = {}) {
  return postJSON("/api/firmament/shop/buy", {
    visitor_id: opts.visitorId ?? getVisitorId(),
    item_id: itemId,
  });
}

export function getWallet(opts = {}) {
  const vid = opts.visitorId ?? getVisitorId();
  return getJSON(`/api/firmament/wallet?visitor_id=${encodeURIComponent(vid)}`);
}

export function campBanter(opts = {}) {
  return postJSON("/api/firmament/camp/banter", {
    agent_a: opts.agentA || "",
    agent_b: opts.agentB || "",
    topic: opts.topic || "",
    rounds: opts.rounds ?? 2,
    visitor_id: opts.visitorId ?? getVisitorId(),
    visitor_name: opts.visitorName ?? getVisitorName(),
  });
}

/** Multi-agent threaded talk (2–4) — pow-wow / circle conversation */
export function agentsConverse(opts = {}) {
  return postJSON("/api/firmament/agents/converse", {
    agent_a: opts.agentA || opts.agent_a || "luna",
    agent_b: opts.agentB || opts.agent_b || "hermes",
    agent_c: opts.agentC || opts.agent_c || "",
    agent_d: opts.agentD || opts.agent_d || "",
    topic: opts.topic || "",
    rounds: opts.rounds ?? 3,
    visitor_id: opts.visitorId ?? getVisitorId(),
    visitor_name: opts.visitorName ?? getVisitorName(),
  });
}

export function agentChat(agentId, message, opts = {}) {
  return postJSON("/api/firmament/agent/chat", {
    agent_id: agentId,
    message,
    speak: false,
    ambient: !!opts.ambient,
    visitor_id: opts.visitorId ?? getVisitorId(),
    visitor_name: opts.visitorName ?? getVisitorName(),
    force_grok: !!opts.forceGrok,
  });
}

/** Spirit board API (cloud path when available; 3D also falls back to Oracle/Ollama). */
export function askOuija(question, opts = {}) {
  return postJSON("/api/ouija", {
    question: question || "",
    context:
      opts.context ||
      "Luna Camp firmament 3D — outdoor Ouija board by the fire. Oracle is the medium.",
    history: opts.history || [],
    avoid_recent: opts.avoidRecent || [],
  });
}

/** Server-side mind states — keep living while the browser/tab is closed. */
export function fetchCampMinds(opts = {}) {
  const since = opts.since != null ? Number(opts.since) : 0;
  const limit = opts.limit != null ? Number(opts.limit) : 40;
  const q = new URLSearchParams();
  if (since > 0) q.set("since", String(since));
  if (limit) q.set("limit", String(limit));
  const qs = q.toString();
  return getJSON(`/api/firmament/camp/minds${qs ? `?${qs}` : ""}`);
}

/**
 * Apply a CampEvent to UI callbacks.
 * @param {object} event protocol CampEvent
 * @param {{ onNarration?: fn, onLine?: fn, onFx?: fn }} hooks
 */
export function applyCampEvent(event, hooks = {}) {
  if (!event) return;
  if (event.message && hooks.onNarration) hooks.onNarration(event.message, event);
  for (const line of event.lines || []) {
    if (hooks.onLine) hooks.onLine(line, event);
  }
  if (event.fx?.length && hooks.onFx) hooks.onFx(event.fx, event);
  return event;
}
