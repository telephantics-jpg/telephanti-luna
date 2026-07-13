/**
 * Camp banter — scene seeds only (no instruction dumps models recite).
 *
 * Primary path: POST /api/firmament/banter
 * Fallback: thin static lines below if mind is offline.
 */

const OPEN_SEEDS = [
  "{visitor} just walked into the meadow.",
  "{visitor} is here by the fire.",
  "New footsteps: {visitor}.",
  "{visitor} showed up under the corona.",
  "Camp just gained {visitor}.",
];

const RETURN_SEEDS = [
  "{visitor} is back at camp.",
  "{visitor} returned to the meadow.",
  "{visitor} circled back to the fire.",
];

const AMBIENT_SEEDS = [
  "Something small just caught your eye (fire, pond, cookies, sky, music, props).",
  "Quiet beat at the meadow — one real detail stands out.",
  "Camp is humming.",
  "A pause between conversations.",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)] || arr[0];
}

/** @param {string} agentId */
export function openerPrompt(agentId, {
  visitor = "traveler",
  returning = false,
  context = "aurora meadow camp",
  near = "",
} = {}) {
  const seed = pick(returning ? RETURN_SEEDS : OPEN_SEEDS).replace(/\{visitor\}/g, visitor);
  return (
    `${seed}\n` +
    `Place: ${context}.` +
    (near ? ` Nearby: ${near}.` : "")
  );
}

export function ambientPrompt(agentId, {
  visitor = "a visitor",
  context = "camp is humming",
  near = "",
  replyTo = null,
} = {}) {
  if (replyTo?.line) {
    const idea = String(replyTo.line).replace(/\s+/g, " ").trim().slice(0, 100);
    return (
      `${replyTo.name || "Someone"}: ${idea}\n` +
      `Place: ${context}.` +
      (near ? ` Nearby: ${near}.` : "")
    );
  }
  const seed = pick(AMBIENT_SEEDS);
  return (
    `${seed}\n` +
    `${visitor} is around.\n` +
    `Place: ${context}.` +
    (near ? ` Nearby: ${near}.` : "")
  );
}

export function arrivalWavePrompt(agentId, {
  visitor = "traveler",
  waveIndex = 0,
  returning = false,
  context = "camp",
} = {}) {
  const beats = [
    "first to notice",
    "second welcome voice",
    "third welcome voice",
    "soft follow-up",
    "closing welcome note",
  ];
  const beat = beats[Math.min(waveIndex, beats.length - 1)];
  return (
    openerPrompt(agentId, { visitor, returning, context }) +
    `\nWelcome wave: ${beat}.`
  );
}

/** Thin offline fallbacks — only if mind is down. Prefer live AI. */
export const FALLBACK_OPENERS = {
  luna: [
    "Hey {v} — camp's open. Say anything.",
    "{v}, you made it. Corona's being friendly tonight.",
    "Pull up meadow, {v}. No wrong questions.",
  ],
  hermes: [
    "{v} — ripple detected. What's the signal?",
    "Handshake complete, {v}. Talk to me.",
    "Frequency check: you good, {v}?",
  ],
  oracle: [
    "{v}… I kind of saw this. Go ahead.",
    "Veil's thin, cookies are thick, {v}.",
    "Ask before the stars gossip first.",
  ],
  thor: [
    "{v}! Thunder's in a good mood. You?",
    "Storm report: visitor spotted. Worthy already.",
    "Cookies and courage, {v}. Pick your fighter.",
  ],
  zeus: [
    "{v} — sky-king on vacation. Impress me gently.",
    "Decree: drama ok, cruelty not. Hi.",
    "Olympus can wait. This meadow can't. Sit.",
  ],
  _default: [
    "Hey {v}. Camp's weird. Good weird.",
    "{v} — fire's lit. Jump in.",
    "Welcome to the meadow chaos, {v}.",
  ],
};

export const FALLBACK_IDLE = {
  luna: [
    { text: "Corona's doing that soft chaos thing again.", mood: "happy" },
    { text: "Cookies louder than the news cycle. Policy.", mood: "happy" },
  ],
  hermes: [
    { text: "Ripples: mostly snacks, minor drama.", mood: "think" },
    { text: "Signal's clean. Mood's better.", mood: "happy" },
  ],
  thor: [
    { text: "Thunder on break. Punchlines are not.", mood: "happy" },
    { text: "Mjolnir voted cookie. I second.", mood: "happy" },
  ],
  zeus: [
    { text: "Sky decree: sit down, be interesting.", mood: "flirt" },
    { text: "Cloud throne overrated. Meadow wins.", mood: "happy" },
  ],
  _default: [
    { text: "Camp's wide and weird. Good.", mood: "happy" },
    { text: "Fire hums like it pays rent.", mood: "neutral" },
  ],
};

export function pickFallbackOpener(agentId, visitor = "traveler") {
  const pool = FALLBACK_OPENERS[agentId] || FALLBACK_OPENERS._default;
  const line = pool[Math.floor(Math.random() * pool.length)] || FALLBACK_OPENERS._default[0];
  return line.replace(/\{v\}/g, visitor);
}

export function pickFallbackIdle(agentId, visitor = "someone") {
  const pool = FALLBACK_IDLE[agentId] || FALLBACK_IDLE._default;
  const entry = pool[Math.floor(Math.random() * pool.length)] || FALLBACK_IDLE._default[0];
  return {
    text: String(entry.text || "").replace(/\{v\}/g, visitor),
    mood: entry.mood || "happy",
  };
}
