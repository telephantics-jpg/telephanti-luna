/**
 * Camp banter — single place for HOW agents open / idle / reply.
 *
 * Primary path (client): callAgentMind /api/firmament/agent/chat with these prompts.
 * Preferred server path: POST /api/firmament/banter (uses firmament/banter.py).
 * Fallback: thin static lines below (only if server/mind offline).
 *
 * Scene seeds only — no ALL-CAPS instruction dumps models recite out loud.
 */

const OPEN_SEEDS = [
  "{visitor} just walked into the meadow. Notice them and say hi in your own voice.",
  "{visitor} is here — give a real hello, not a stock greeter line.",
  "New footsteps by the fire: {visitor}. Welcome them like only you would.",
  "{visitor} showed up under the corona. Greet them; leave an easy door to talk.",
  "Camp gained a body: {visitor}. Open with something specific and warm.",
];

const RETURN_SEEDS = [
  "{visitor} is back. Treat them like a familiar friend — no memory receipts.",
  "Hey — {visitor} returned. Easy familiarity, zero CRM vibes.",
  "{visitor} circled back to camp. Warm nod energy; invent a fresh hello.",
];

const AMBIENT_SEEDS = [
  "Something small just caught your eye at camp (fire, pond, cookies, sky, music, props).",
  "Idle moment by the meadow — notice one real detail and talk about it.",
  "Camp is humming. Share one observation in your voice.",
  "A quiet beat between conversations. What are you actually noticing?",
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
    (near ? ` Nearby: ${near}.` : "") +
    `\nSpeak as yourself only — natural hello, a little character color, invite to talk.`
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
      `${replyTo.name || "Someone"} just riffed (meaning only): ${idea}\n` +
      `Answer them naturally — funny, specific, your spin. Don't copy their wording.\n` +
      `Place: ${context}.` +
      (near ? ` Nearby: ${near}.` : "")
    );
  }
  const seed = pick(AMBIENT_SEEDS);
  return (
    `${seed}\n` +
    `${visitor} is around if that matters.\n` +
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
    "You're first to notice them.",
    "You're the second voice in the welcome — don't copy the first.",
    "Third take — be distinct from whoever already spoke.",
    "Soft follow-up energy.",
    "Closing note in the welcome wave.",
  ];
  const beat = beats[Math.min(waveIndex, beats.length - 1)];
  return (
    openerPrompt(agentId, { visitor, returning, context }) +
    `\n${beat}`
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
