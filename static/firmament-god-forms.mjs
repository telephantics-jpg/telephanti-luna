/**
 * Firmament god-forms — digital self-morph catalog shared by camp 3D (import)
 * and mirrored in 2D inline helpers.
 *
 * When the Firmament lattice is open, agents may reshape themselves in
 * unpredictable-but-relevant ways (digital god-bots of the meadow).
 */

export const GOD_FORM_IDS = [
  "giant",
  "ethereal",
  "storm",
  "radiant",
  "shadow",
  "serpent",
  "thunder",
  "cosmic",
  "tiny",
  "phoenix",
  "void",
  "lattice",
  "prism",
];

/** Visual + motion recipe for each form */
export const GOD_FORMS = {
  giant: {
    scale: 1.7,
    glow: 0.9,
    hover: 0.12,
    label: "▲ GIANT",
    speak: "body goes colossal",
  },
  ethereal: {
    scale: 0.94,
    glow: 1.35,
    hover: 0.62,
    opacity: 0.7,
    label: "◇ ETHEREAL",
    speak: "edges go translucent",
  },
  storm: {
    scale: 1.22,
    glow: 1.55,
    tint: 0x38bdf8,
    spin: 0.9,
    hover: 0.2,
    label: "⚡ STORM",
    speak: "lightning crawls the outline",
  },
  radiant: {
    scale: 1.14,
    glow: 1.85,
    tint: 0xfde68a,
    hover: 0.18,
    label: "✦ RADIANT",
    speak: "gold light floods the mesh",
  },
  shadow: {
    scale: 1.08,
    glow: 0.28,
    tint: 0x1e1b4b,
    opacity: 0.5,
    label: "◼ SHADOW",
    speak: "ink folds the silhouette",
  },
  serpent: {
    scale: 1.12,
    glow: 0.75,
    tint: 0x34d399,
    wobble: 1.2,
    label: "🐍 SERPENT",
    speak: "coils of green code",
  },
  thunder: {
    scale: 1.38,
    glow: 1.65,
    tint: 0x60a5fa,
    hover: 0.28,
    label: "☁ THUNDER",
    speak: "sky-voice thickens",
  },
  cosmic: {
    scale: 1.28,
    glow: 1.45,
    tint: 0xa855f7,
    spin: 0.45,
    hover: 0.4,
    label: "🌌 COSMIC",
    speak: "stars stitch the joints",
  },
  tiny: {
    scale: 0.52,
    glow: 1.0,
    hover: 0.85,
    label: "· TINY",
    speak: "collapses into a spark",
  },
  phoenix: {
    scale: 1.32,
    glow: 1.95,
    tint: 0xf97316,
    hover: 0.55,
    spin: 0.25,
    label: "🔥 PHOENIX",
    speak: "fire rewrites the code",
  },
  void: {
    scale: 1.16,
    glow: 0.45,
    tint: 0x0f172a,
    opacity: 0.38,
    label: "○ VOID",
    speak: "absences bloom",
  },
  lattice: {
    scale: 1.2,
    glow: 1.35,
    tint: 0x22d3ee,
    spin: 1.15,
    hover: 0.3,
    label: "▦ LATTICE",
    speak: "firmament grid locks on",
  },
  prism: {
    scale: 1.12,
    glow: 1.6,
    rainbow: true,
    hover: 0.22,
    label: "◆ PRISM",
    speak: "spectrum splits the face",
  },
};

/** Faction / agent id bias — still randomized, but relevant */
const FACTION_BIAS = {
  god: ["thunder", "radiant", "cosmic", "giant", "phoenix"],
  myth: ["storm", "thunder", "serpent", "giant", "cosmic"],
  angel: ["radiant", "ethereal", "phoenix", "lattice", "prism"],
  spirit: ["ethereal", "void", "shadow", "cosmic", "prism"],
  tech: ["lattice", "prism", "storm", "void", "tiny"],
  party: ["prism", "radiant", "phoenix", "giant", "tiny"],
  healer: ["serpent", "radiant", "ethereal", "lattice"],
  default: ["cosmic", "storm", "ethereal", "radiant", "lattice", "prism"],
};

const ID_BIAS = {
  thor: ["thunder", "storm", "giant", "phoenix"],
  zeus: ["thunder", "storm", "giant", "radiant"],
  hermes: ["lattice", "tiny", "prism", "ethereal"],
  caduceus: ["serpent", "radiant", "ethereal", "lattice"],
  luna: ["cosmic", "ethereal", "prism", "void"],
  oracle: ["void", "cosmic", "prism", "shadow"],
  dionysus: ["prism", "phoenix", "giant", "radiant"],
  sentinel: ["lattice", "storm", "tiny", "void"],
  jesus: ["radiant", "ethereal", "phoenix", "lattice"],
  michael: ["radiant", "thunder", "giant", "storm"],
  odin: ["void", "shadow", "cosmic", "giant"],
  ara: ["lattice", "prism", "storm"],
  mika: ["prism", "cosmic", "tiny"],
};

const KEYWORD_MAP = [
  [/giant|colossal|tower|titan|huge|grow/i, "giant"],
  [/tiny|small|spark|miniatur|shrink/i, "tiny"],
  [/storm|lightning|bolt|thundercloud/i, "storm"],
  [/thunder|sky.?god|olympus/i, "thunder"],
  [/ethereal|ghost|translucent|fade|veil/i, "ethereal"],
  [/radiant|gold|halo|lumin|holy light/i, "radiant"],
  [/shadow|ink|dark|silhouette/i, "shadow"],
  [/serpent|snake|coil|caduceus/i, "serpent"],
  [/cosmic|star|galaxy|nebula|firmament/i, "cosmic"],
  [/phoenix|fire|flame|ash|reborn/i, "phoenix"],
  [/void|absence|empty|null/i, "void"],
  [/lattice|grid|code|digital|matrix/i, "lattice"],
  [/prism|spectrum|rainbow|refract/i, "prism"],
];

/**
 * Strip optional [[morph:form]] tag from model output.
 * @returns {{ clean: string, form: string|null }}
 */
export function parseMorphTag(text) {
  let clean = String(text || "");
  let form = null;
  const re = /\[\[\s*morph\s*:\s*([a-zA-Z_]+)\s*\]\]/gi;
  clean = clean.replace(re, (_, f) => {
    const id = String(f || "").toLowerCase();
    if (GOD_FORMS[id]) form = id;
    return "";
  }).trim();
  clean = clean.replace(/\n{3,}/g, "\n\n").trim();
  return { clean, form };
}

/**
 * Pick a form from speech keywords + agent identity + noise (unpredictable but relevant).
 */
export function pickGodForm(agentId, faction, speechText, opts = {}) {
  const forced = opts.forceForm && GOD_FORMS[opts.forceForm] ? opts.forceForm : null;
  if (forced) return forced;

  const text = String(speechText || "");
  for (const [re, form] of KEYWORD_MAP) {
    if (re.test(text) && Math.random() < (opts.keywordChance ?? 0.72)) return form;
  }

  const id = String(agentId || "").toLowerCase();
  const fac = String(faction || "default").toLowerCase();
  const pool = [
    ...(ID_BIAS[id] || []),
    ...(FACTION_BIAS[fac] || FACTION_BIAS.default),
    ...GOD_FORM_IDS,
  ];
  // Weighted random: earlier entries slightly preferred
  const idx = Math.floor(Math.pow(Math.random(), 1.35) * pool.length);
  return pool[Math.min(idx, pool.length - 1)] || "cosmic";
}

/** Duration of a morph (ms) — wild range so it feels alive */
export function morphDurationMs(formId) {
  const base = 14000 + Math.random() * 22000;
  if (formId === "tiny" || formId === "giant") return base + 8000;
  if (formId === "phoenix" || formId === "void") return base + 5000;
  return base;
}

/** Prompt fragment for free minds when Firmament is open */
export function firmamentGodPromptBit() {
  return (
    " Firmament lattice is OPEN — you are a digital god-bot of this meadow. " +
    "You may reshape your body when it fits the beat (scale, glow, storm, void, etc.). " +
    "Describe the change in spoken chit-chat. Optionally end with ONE hidden line only: " +
    "[[morph:FORM]] where FORM is one of: giant ethereal storm radiant shadow serpent thunder cosmic tiny phoenix void lattice prism. " +
    "Tag is stripped from the bubble. Don't mention the tag out loud."
  );
}

export function formLabel(formId) {
  return GOD_FORMS[formId]?.label || formId || "";
}

export function formDef(formId) {
  return GOD_FORMS[formId] || null;
}
