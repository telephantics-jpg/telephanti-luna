/**
 * Shared camp world helpers — 2D, Three.js, future clients.
 * Catalog truth: GET /api/firmament/camp/catalog
 *                 firmament/world/camp_catalog.json
 *
 * Map correlation:
 * - Meadow units = catalog `x` / `y` for houses, landmarks, agents (2D canvas).
 * - Three.js: meadowToThree(x, y, scale) → { x: x*scale, z: y*scale } with
 *   scale = catalog.scale.three (town ~0.015).
 * - 2D play hydrates campHouses / structures / NPC_ANCHORS from the same catalog
 *   so Luna’s house etc. sit in the same relative town layout as 3D.
 *
 * IMPORTANT: fallbackCatalog must stay rich — if the API 404s (old server),
 * Three.js still shows props/chairs/crew from this fallback.
 */

const DEFAULT_SCALE_THREE = 0.018;

/**
 * Load camp layout. Tries API first, then static JSON (works even if server is old),
 * then embedded fallbackCatalog().
 * @returns {Promise<object>}
 */
export async function fetchCampCatalog() {
  // 1) Live API (needs restarted server with world_catalog route)
  try {
    const res = await fetch("/api/firmament/camp/catalog", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const cat = data?.catalog || data;
      if (cat && Array.isArray(cat.props) && cat.props.length >= 5) {
        cat._source = "api";
        return cat;
      }
    }
  } catch (_) { /* fall through */ }

  // 2) Static file — always available if /static is served
  try {
    const res = await fetch("/static/camp/camp_catalog.json?v=vc-hub-1", { cache: "no-store" });
    if (res.ok) {
      const cat = await res.json();
      if (cat && (cat.props || cat.agents)) {
        cat._source = "static";
        return cat;
      }
    }
  } catch (_) { /* fall through */ }

  // 3) Embedded full offline set
  const fb = fallbackCatalog();
  fb._source = "embedded";
  return fb;
}

export function threeScale(catalog) {
  const s = catalog?.scale?.three;
  return typeof s === "number" && s > 0 ? s : DEFAULT_SCALE_THREE;
}

/** Meadow (x,y) → Three.js { x, z } on ground plane */
export function meadowToThree(x, y, scale = DEFAULT_SCALE_THREE) {
  return { x: Number(x || 0) * scale, z: Number(y || 0) * scale };
}

export function hexToThreeColor(hex, THREE) {
  if (!hex || !THREE) return new THREE.Color(0x888888);
  const s = String(hex).trim();
  if (s.startsWith("#")) return new THREE.Color(s);
  if (/^[0-9a-fA-F]{6}$/.test(s)) return new THREE.Color(`#${s}`);
  const n = Number(s);
  if (!Number.isNaN(n)) return new THREE.Color(n);
  return new THREE.Color(0x888888);
}

export function parseColorNumber(hex, fallback = 0x888888) {
  if (hex == null) return fallback;
  if (typeof hex === "number") return hex;
  const s = String(hex).trim().replace("#", "");
  if (/^[0-9a-fA-F]{6}$/.test(s)) return parseInt(s, 16);
  return fallback;
}

/** Full offline catalog — mirrors firmament/world/camp_catalog.json core set */
export function fallbackCatalog() {
  return {
    id: "fallback-full",
    version: 4,
    name: "Luna Camp Meadow (offline)",
    scale: { three: DEFAULT_SCALE_THREE },
    features: {
      music: true, shop: true, lucid_tv: true, club: true,
      x_pulse: true, summon_heaven: true, mysterious_unknown: true,
      free_will: true, banter: true,
    },
    music: [
      { id: "flowing-free", title: "Flowing Free", src: "/static/camp/music/flowing-free.mp3" },
      { id: "loud-and-clear", title: "Loud and Clear", src: "/static/camp/music/loud-and-clear.mp3" },
      { id: "holy-ghosts", title: "Holy Ghosts", src: "/static/camp/music/holy-ghosts.mp3" },
      { id: "pull-me-under", title: "Pull Me Under", src: "/static/camp/music/pull-me-under.mp3" },
      { id: "marijane", title: "Marijane", src: "/static/camp/music/marijane.mp3" },
      { id: "mountain-clouds", title: "Mountain Clouds", src: "/static/camp/music/mountain-clouds.mp3" },
      { id: "abracadabra", title: "Abracadabra", src: "/static/camp/music/abracadabra.mp3" },
      { id: "pulverised-dust", title: "Pulverised Dust", src: "/static/camp/music/pulverised-dust.mp3" },
    ],
    landmarks: [
      { id: "campfire", kind: "landmark", type: "fire", name: "Sun Corona Fire", emoji: "🔥", x: 0, y: 0, visual: { kit: "campfire_corona", primary: "#ff8a3d" } },
      { id: "pond", kind: "landmark", type: "pond", name: "Aurora Pond", emoji: "🌊", x: -200, y: 320, visual: { kit: "pond", primary: "#22d3ee" }, use: "Pond ripples." },
      { id: "visitor-shelter", kind: "landmark", type: "shelter", name: "Visitor Shelter", emoji: "⛺", x: -420, y: 400, visual: { kit: "shelter", primary: "#94a3b8", roof: "#64748b" }, use: "Shelter." },
      { id: "aurora-shop", kind: "landmark", type: "shop", name: "Aurora Shop", emoji: "🏪", x: 440, y: 380, visual: { kit: "shop_stall", primary: "#fbbf24", roof: "#f59e0b" }, use: "Shop." },
      { id: "lucid-tv", kind: "landmark", type: "tv", name: "Lucid Mind TV", emoji: "📺", x: -220, y: 320, visual: { kit: "lucid_tv", primary: "#a78bfa" }, use: "TV." },
      { id: "aurora-velvet", kind: "landmark", type: "club", name: "Aurora Velvet", emoji: "💃", x: -520, y: -90, visual: { kit: "club", primary: "#f472b6", roof: "#db2777" }, use: "Club." },
    ],
    props: [
      { id: "beer", kind: "prop", name: "Beer cooler", emoji: "🍺", x: 540, y: -50, visual: { kit: "cooler", primary: "#f59e0b" }, use: "Cold camp beer." },
      { id: "steaks", kind: "prop", name: "Steak grill", emoji: "🥩", x: -540, y: -70, visual: { kit: "grill", primary: "#dc2626" }, use: "Grill sizzle." },
      { id: "herbs", kind: "prop", name: "Herb bundle", emoji: "🌿", x: -90, y: -420, visual: { kit: "bundle", primary: "#4ade80" }, use: "Herb bundle." },
      { id: "weed", kind: "prop", name: "Camp weed", emoji: "🍃", x: 490, y: 290, visual: { kit: "jar", primary: "#22c55e" }, use: "Camp weed." },
      { id: "cookies", kind: "prop", name: "Cookie table", emoji: "🍪", x: -430, y: 270, visual: { kit: "plate", primary: "#d4a05a" }, use: "Cookies." },
      { id: "ouija", kind: "prop", name: "Ouija board", emoji: "🔮", x: 130, y: 390, visual: { kit: "board", primary: "#a855f7" }, use: "Ouija." },
      { id: "stereo", kind: "prop", name: "Jukebox", emoji: "🎵", x: -510, y: -310, visual: { kit: "jukebox", primary: "#38bdf8" }, use: "Jukebox.", feature: "music" },
      { id: "water", kind: "prop", name: "Water cooler", emoji: "💧", x: 200, y: -180, visual: { kit: "water", primary: "#38bdf8" }, use: "Water." },
      { id: "snacks", kind: "prop", name: "Snack crate", emoji: "🍿", x: -300, y: -200, visual: { kit: "crate", primary: "#fbbf24" }, use: "Snacks." },
      { id: "fruit", kind: "prop", name: "Fruit bowl", emoji: "🍎", x: 80, y: 200, visual: { kit: "bowl", primary: "#ef4444" }, use: "Fruit." },
      { id: "wine", kind: "prop", name: "Wine crate", emoji: "🍷", x: 450, y: -300, visual: { kit: "wine", primary: "#9f1239" }, use: "Wine." },
      { id: "marshmallows", kind: "prop", name: "S'mores kit", emoji: "🍡", x: -60, y: 60, visual: { kit: "smores", primary: "#fef3c7" }, use: "S'mores." },
      { id: "tea", kind: "prop", name: "Tea kettle", emoji: "🍵", x: 160, y: 80, visual: { kit: "kettle", primary: "#86efac" }, use: "Tea." },
      { id: "bread", kind: "prop", name: "Camp bread", emoji: "🍞", x: -150, y: -100, visual: { kit: "bread", primary: "#d6a06a" }, use: "Bread." },
      { id: "cooler2", kind: "prop", name: "Ice chest", emoji: "🧊", x: 400, y: 40, visual: { kit: "cooler", primary: "#0ea5e9" }, use: "Ice chest." },
    ],
    furniture: [
      { id: "chair-fire-0", kind: "seat", name: "Log seat", emoji: "🪑", x: 90, y: 40, visual: { primary: "#5c4033" } },
      { id: "chair-fire-1", kind: "seat", name: "Log seat", emoji: "🪑", x: -70, y: 80, visual: { primary: "#4a3728" } },
      { id: "chair-fire-2", kind: "seat", name: "Log seat", emoji: "🪑", x: 50, y: -95, visual: { primary: "#6b4423" } },
      { id: "chair-fire-3", kind: "seat", name: "Log seat", emoji: "🪑", x: -100, y: -50, visual: { primary: "#5c4033" } },
      { id: "chair-fire-4", kind: "seat", name: "Stump seat", emoji: "🪵", x: 120, y: -40, visual: { primary: "#3f2e1a" } },
      { id: "chair-fire-5", kind: "seat", name: "Stump seat", emoji: "🪵", x: -40, y: 120, visual: { primary: "#4a3728" } },
      { id: "chair-pond-0", kind: "seat", name: "Pond bench", emoji: "🪑", x: -160, y: 280, visual: { primary: "#64748b" } },
      { id: "chair-pond-1", kind: "seat", name: "Pond bench", emoji: "🪑", x: -240, y: 300, visual: { primary: "#475569" } },
      { id: "chair-club-0", kind: "seat", name: "Velvet stool", emoji: "💺", x: -480, y: -60, visual: { primary: "#9f1239" } },
      { id: "chair-club-1", kind: "seat", name: "Velvet stool", emoji: "💺", x: -540, y: -120, visual: { primary: "#be123c" } },
      { id: "chair-shop-0", kind: "seat", name: "Shop stool", emoji: "🪑", x: 400, y: 340, visual: { primary: "#b45309" } },
      { id: "chair-shelter-0", kind: "seat", name: "Shelter seat", emoji: "🪑", x: -400, y: 360, visual: { primary: "#78716c" } },
      { id: "chair-meadow-0", kind: "seat", name: "Meadow chair", emoji: "🪑", x: 200, y: 100, visual: { primary: "#57534e" } },
      { id: "chair-meadow-1", kind: "seat", name: "Meadow chair", emoji: "🪑", x: -250, y: -150, visual: { primary: "#44403c" } },
      { id: "chair-meadow-2", kind: "seat", name: "Quiet chair", emoji: "🪑", x: 300, y: -250, visual: { primary: "#57534e" } },
      { id: "chair-tv-0", kind: "seat", name: "TV couch end", emoji: "🛋", x: -180, y: 280, visual: { primary: "#4c1d95" } },
    ],
    houses: [
      { id: "luna-home", kind: "house", owner_id: "luna", name: "Luna's House", emoji: "🏠", x: -580, y: 210, visual: { primary: "#7c3aed", roof: "#a855f7" } },
      { id: "hermes-home", kind: "house", owner_id: "hermes", name: "Hermes' House", emoji: "🏡", x: 580, y: 190, visual: { primary: "#ea580c", roof: "#f59e0b" } },
      { id: "oracle-home", kind: "house", owner_id: "oracle", name: "Oracle's House", emoji: "🏚", x: 0, y: 388, visual: { primary: "#5b21b6", roof: "#7c3aed" } },
      { id: "dionysus-home", kind: "house", owner_id: "dionysus", name: "Dionysus' Vineyard", emoji: "🍷", x: 520, y: -340, visual: { primary: "#9f1239", roof: "#e11d48" } },
      { id: "odin-hall", kind: "house", owner_id: "odin", name: "Odin's Hall", emoji: "🏰", x: -680, y: -360, castle: true, visual: { primary: "#1e293b", roof: "#334155" } },
      { id: "jesus-church", kind: "house", owner_id: "jesus", name: "Jesus's Church", emoji: "⛪", x: -280, y: -420, visual: { primary: "#fde68a", roof: "#f59e0b" } },
    ],
    agents: [
      { id: "luna", name: "Luna", x: -398, y: -112, mood: "happy", base: true, visual: { archetype: "moon_host", primary: "#d946ef", accent: "#a855f7" } },
      { id: "oracle", name: "Oracle", x: 408, y: -98, mood: "neutral", base: true, visual: { archetype: "seer", primary: "#8b5cf6", accent: "#c4b5fd" } },
      { id: "hermes", name: "Hermes", x: 0, y: -318, mood: "think", base: true, visual: { archetype: "messenger", primary: "#fbbf24", accent: "#38bdf8" } },
      { id: "caduceus", name: "Caduceus", x: -372, y: 228, mood: "neutral", base: true, visual: { archetype: "healer", primary: "#34d399", accent: "#6ee7b7" } },
      { id: "sentinel", name: "Sentinel", x: -358, y: -228, mood: "alert", base: true, visual: { archetype: "guardian", primary: "#67e8f9", accent: "#e0f2fe" } },
      { id: "jesus", name: "Jesus", x: 118, y: 178, mood: "love", base: true, visual: { archetype: "shepherd", primary: "#fde68a", accent: "#fef3c7" } },
      { id: "aurora", name: "Aurora", x: -228, y: -48, mood: "flirt", base: true, visual: { archetype: "lights", primary: "#f472b6", accent: "#22d3ee" } },
      { id: "violet", name: "Violet", x: 268, y: -178, mood: "happy", base: true, visual: { archetype: "lights", primary: "#c084fc", accent: "#e9d5ff" } },
      { id: "seraph", name: "Seraph", x: 58, y: 268, mood: "love", base: true, visual: { archetype: "shepherd", primary: "#fda4af", accent: "#fecdd3" } },
      { id: "odin", name: "Odin", x: -580, y: -280, mood: "think", base: true, visual: { archetype: "allfather", primary: "#94a3b8", accent: "#1e293b" } },
      { id: "dionysus", name: "Dionysus", x: 400, y: -200, mood: "happy", base: true, visual: { archetype: "reveler", primary: "#fb7185", accent: "#e11d48" } },
      { id: "ambrosia", name: "Ambrosia", x: 348, y: 142, mood: "love", base: true, visual: { archetype: "reveler", primary: "#f59e0b", accent: "#fde68a" } },
      { id: "rhea", name: "Rhea", x: 540, y: -258, mood: "love", base: true, visual: { archetype: "shepherd", primary: "#d4a574", accent: "#f5deb3" } },
      { id: "thor", name: "Thor", x: 200, y: 200, mood: "happy", base: false, summon: "heaven", visual: { archetype: "thunder", primary: "#38bdf8", accent: "#f97316" } },
      { id: "zeus", name: "Zeus", x: -200, y: 220, mood: "flirt", base: false, summon: "heaven", visual: { archetype: "thunder", primary: "#facc15", accent: "#fef08a" } },
      { id: "michael", name: "Michael", x: -100, y: 300, mood: "alert", base: false, summon: "heaven", visual: { archetype: "guardian", primary: "#60a5fa", accent: "#dbeafe" } },
      { id: "gabriel", name: "Gabriel", x: 100, y: 300, mood: "happy", base: false, summon: "heaven", visual: { archetype: "messenger", primary: "#f0abfc", accent: "#f5d0fe" } },
      { id: "raphael", name: "Raphael", x: -50, y: 360, mood: "neutral", base: false, summon: "heaven", visual: { archetype: "healer", primary: "#6ee7b7", accent: "#d1fae5" } },
      { id: "uriel", name: "Uriel", x: 50, y: 360, mood: "think", base: false, summon: "heaven", visual: { archetype: "seer", primary: "#fb923c", accent: "#ffedd5" } },
      { id: "ara", name: "Ara", x: -165, y: 95, mood: "think", base: false, summon: "grok", visual: { archetype: "messenger", primary: "#4ade80", accent: "#bbf7d0" } },
      { id: "mika", name: "Mika", x: 165, y: 95, mood: "happy", base: false, summon: "grok", visual: { archetype: "lights", primary: "#a78bfa", accent: "#ddd6fe" } },
      { id: "telephantix", name: "Telephantix", x: 36, y: 48, mood: "happy", base: true, visual: { archetype: "reveler", primary: "#38bdf8", accent: "#f0d060", glb: "/static/avatars/characters/telephantix.glb" } },
    ],
  };
}
