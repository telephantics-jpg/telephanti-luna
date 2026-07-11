/**
 * Camp banter — single place for HOW agents open / idle / reply.
 *
 * Primary path (client): callAgentMind /api/firmament/agent/chat with these prompts.
 * Fallback: thin static lines below (only if server/mind offline).
 *
 * DO NOT scatter opening lines only in firmament-play.html anymore —
 * change prompts here so banter stays dynamic.
 */

/** @param {string} agentId */
export function openerPrompt(agentId, {
  visitor = "traveler",
  returning = false,
  context = "aurora meadow camp",
  near = "",
} = {}) {
  const who = (agentId || "luna").toLowerCase();
  const ret = returning
    ? `${visitor} is back at camp (treat them like a familiar friend — no CRM quotes).`
    : `${visitor} just arrived for the first time (or first this session).`;
  return (
    `(DYNAMIC OPENING LINE — invent it now, never reuse stock greetings.)\n` +
    `You are ${who} at Luna Camp. ${ret}\n` +
    `Greet them in YOUR voice in about one full paragraph (~50–90 words): hello, character color, invite to talk.\n` +
    `Funny, original, specific to right now. Camp context: ${context}.` +
    (near ? ` Nearby: ${near}.` : "") +
    `\nHard no: "last time you said", "I remember when you said", stage *actions*, AI talk.\n` +
    `Sound alive — like a sharp tweet expanded into a real spoken paragraph.`
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
      `${replyTo.name || "Someone"} just riffed (idea only): ${idea}. ` +
      `Reply TO them as ${(agentId || "agent").toLowerCase()} — short, funny, original. ` +
      `Don't copy their words. Camp: ${context}.` +
      (near ? ` Nearby: ${near}.` : "")
    );
  }
  return (
    `You're ${(agentId || "agent").toLowerCase()} at camp. Notice one real thing ` +
    `(fire, music, pond, ${visitor}, props) and riff 1–3 short paragraphs — funny, specific, YOUR voice. ` +
    `Camp: ${context}.` +
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
    "first to notice them",
    "second voice chiming in",
    "third take — don't repeat the others",
    "quiet follow-up beat",
    "last soft note in the welcome wave",
  ];
  const beat = beats[Math.min(waveIndex, beats.length - 1)];
  return (
    openerPrompt(agentId, { visitor, returning, context }) +
    `\nThis is the ${beat} in a welcome wave. Be distinct from other agents.`
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
