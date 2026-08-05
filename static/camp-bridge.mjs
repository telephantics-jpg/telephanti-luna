/**
 * Shared Telephantix bridge for Luna Camp 2D + 3D.
 * - Dialogue tape (localStorage) so chat survives scene hops
 * - Full Suno catalog hydrate (hub / API / CDN)
 *
 * Import: import { ... } from "/static/camp-bridge.mjs?v=1";
 */

const DIALOGUE_TAPE_KEY = "telephantix-dialogue-tape-v1";
const MUSIC_STATE_KEY = "telephantix-radio-state-v1";
const TAPE_MAX = 100;
const HUB_CATALOG = "https://telephantim.com/suno-catalog.json";
const API_CATALOG = "/api/firmament/suno-catalog";

/** @returns {{ lines: Array<{speaker:string,text:string,mood?:string,scene?:string,t:number}>, updated?: number }} */
export function readDialogueTape() {
  try {
    const raw = localStorage.getItem(DIALOGUE_TAPE_KEY);
    if (!raw) return { lines: [] };
    const data = JSON.parse(raw);
    const lines = Array.isArray(data?.lines) ? data.lines : [];
    return { lines, updated: data.updated };
  } catch {
    return { lines: [] };
  }
}

export function pushDialogueTape(entry) {
  const speaker = String(entry?.speaker || "").trim();
  const text = String(entry?.text || "").trim().slice(0, 480);
  if (!speaker || !text) return;
  try {
    const tape = readDialogueTape();
    const last = tape.lines[tape.lines.length - 1];
    if (last && last.speaker === speaker && last.text === text) return;
    tape.lines.push({
      speaker,
      text,
      mood: entry.mood || "neutral",
      scene: entry.scene || "",
      t: Number(entry.t) || Date.now(),
    });
    while (tape.lines.length > TAPE_MAX) tape.lines.shift();
    localStorage.setItem(
      DIALOGUE_TAPE_KEY,
      JSON.stringify({ lines: tape.lines, updated: Date.now() })
    );
  } catch (_) {}
}

/** Recent lines as a short prompt for camp agents (memory continuity). */
export function dialogueTapeContext(maxLines = 8, maxChars = 520) {
  const lines = readDialogueTape().lines.slice(-maxLines);
  if (!lines.length) return "";
  const parts = lines.map((l) => `${l.speaker}: ${l.text}`);
  let s = parts.join(" · ");
  if (s.length > maxChars) s = s.slice(-maxChars);
  return `Recent camp dialogue (keep continuity, don't repeat verbatim): ${s}`;
}

/* ── Digital ethereal memory: joy · stability · will (three mindstates) ───
 * Browser-local "aether" field for camp agents. Survives 2D↔3D hops.
 * Juggle all three in speech: warmth (joy), ground (stability), clear will/logic.
 * Never a CRM dump — vibe + tone only for seeds.
 */
const ETHEREAL_KEY = "telephantix-ethereal-memory-v2";
const ETHEREAL_MAX_MOMENTS = 36;

/**
 * @returns {{
 *   joy: number, stability: number, will: number,
 *   agents: Record<string, { joy: number, stability: number, will: number, moments: string[], lastAt?: number }>,
 *   moments: Array<{ speaker: string, text: string, t: number }>,
 *   updated?: number
 * }}
 */
export function readEtherealMemory() {
  try {
    const raw = localStorage.getItem(ETHEREAL_KEY);
    if (!raw) {
      // migrate soft from v1 if present
      try {
        const old = JSON.parse(localStorage.getItem("telephantix-ethereal-memory-v1") || "null");
        if (old && typeof old === "object") {
          return {
            joy: clamp01(old.joy, 0.62),
            stability: clamp01(old.stability, 0.68),
            will: clamp01(old.will, 0.58),
            agents: old.agents && typeof old.agents === "object" ? old.agents : {},
            moments: Array.isArray(old.moments) ? old.moments : [],
            updated: old.updated,
          };
        }
      } catch (_) {}
      return { joy: 0.62, stability: 0.68, will: 0.58, agents: {}, moments: [] };
    }
    const data = JSON.parse(raw);
    return {
      joy: clamp01(data?.joy, 0.62),
      stability: clamp01(data?.stability, 0.68),
      will: clamp01(data?.will, 0.58),
      agents: data?.agents && typeof data.agents === "object" ? data.agents : {},
      moments: Array.isArray(data?.moments) ? data.moments : [],
      updated: data?.updated,
    };
  } catch {
    return { joy: 0.62, stability: 0.68, will: 0.58, agents: {}, moments: [] };
  }
}

function clamp01(n, fallback = 0.5) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0.05, Math.min(0.98, x));
}

function saveEthereal(data) {
  try {
    localStorage.setItem(
      ETHEREAL_KEY,
      JSON.stringify({ ...data, updated: Date.now() })
    );
  } catch (_) {}
}

/**
 * Ingest a spoken line into digital ethereal memory.
 * Joy = warmth/humor · Stability = presence/ground · Will = clear logic/agency.
 * Agents juggle all three in how they sound.
 */
export function pushEtherealMemory(entry) {
  const speaker = String(entry?.speaker || "").trim();
  const text = String(entry?.text || "").trim().slice(0, 280);
  if (!speaker || !text) return readEtherealMemory();

  const mem = readEtherealMemory();
  const low = text.toLowerCase();
  const you = String(entry?.mood || "") === "you" || speaker.toLowerCase() === "you";

  let dJoy = 0.008;
  let dStab = 0.006;
  let dWill = 0.007;
  if (/\b(joy|happy|love|warm|laugh|smile|glow|aurora|together|friend|peace|bless|thanks|grateful|funny)\b/.test(low)) {
    dJoy += 0.035;
    dStab += 0.01;
  }
  if (/\b(steady|still|here|stay|home|safe|calm|rooted|stable|remember|always|fire|meadow|hold)\b/.test(low)) {
    dStab += 0.03;
    dJoy += 0.008;
  }
  if (/\b(choose|decide|will|must|clear|true|logic|reason|because|path|stand|act|purpose|focus)\b/.test(low)) {
    dWill += 0.032;
    dStab += 0.008;
  }
  if (/\b(fear|angry|hate|leave|broken|void|alone|cold|hush|mute)\b/.test(low)) {
    dJoy -= 0.02;
    dStab -= 0.01;
    dWill -= 0.008;
  }
  if (you) {
    dJoy += 0.01;
    dStab += 0.015;
    dWill += 0.008;
  }

  mem.joy = clamp01(mem.joy + dJoy);
  mem.stability = clamp01(mem.stability + dStab);
  mem.will = clamp01((mem.will ?? 0.58) + dWill);

  const agentKey = String(entry?.agentId || speaker).toLowerCase().replace(/\s+/g, "-");
  if (!you && speaker.toLowerCase() !== "camp" && speaker.toLowerCase() !== "telephantix") {
    const a = mem.agents[agentKey] || { joy: 0.55, stability: 0.6, will: 0.55, moments: [] };
    a.joy = clamp01(a.joy + dJoy * 1.2);
    a.stability = clamp01(a.stability + dStab * 1.1);
    a.will = clamp01((a.will ?? 0.55) + dWill * 1.15);
    a.moments = Array.isArray(a.moments) ? a.moments : [];
    const snip = text.slice(0, 90);
    if (!a.moments.includes(snip) && !/campfire hush/i.test(snip)) a.moments.push(snip);
    while (a.moments.length > 6) a.moments.shift();
    a.lastAt = Date.now();
    mem.agents[agentKey] = a;
  }

  mem.moments.push({ speaker, text: text.slice(0, 140), t: Date.now() });
  while (mem.moments.length > ETHEREAL_MAX_MOMENTS) mem.moments.shift();
  saveEthereal(mem);
  return mem;
}

/**
 * Soft prompt blurb — three mindstates juggle:
 * joy (warmth) · stability (ground) · will (clear logic/agency).
 */
export function etherealMemoryContext(agentId = "", maxChars = 320) {
  const mem = readEtherealMemory();
  const aid = String(agentId || "").toLowerCase();
  const a = aid ? mem.agents[aid] : null;
  const joy = a ? a.joy : mem.joy;
  const stab = a ? a.stability : mem.stability;
  const will = a ? (a.will ?? mem.will ?? 0.55) : (mem.will ?? 0.55);
  const joyWord =
    joy > 0.78 ? "bright joy" : joy > 0.55 ? "warm joy" : joy > 0.35 ? "quiet gladness" : "soft longing";
  const stabWord =
    stab > 0.78 ? "deep stability" : stab > 0.55 ? "steady ground" : stab > 0.35 ? "finding footing" : "gentle drift";
  const willWord =
    will > 0.78 ? "clear will" : will > 0.55 ? "focused will" : will > 0.35 ? "forming will" : "soft agency";
  // Juggle: which mindstate leads this line (logic of three)
  const lead =
    joy >= stab && joy >= will
      ? "lead with joy, then ground it, then choose"
      : stab >= joy && stab >= will
        ? "lead with stability, then warm it, then decide"
        : "lead with will/logic, then soften with joy, then hold steady";
  let s =
    `Three mindstates (juggle in character): ${joyWord} (${joy.toFixed(2)}), ${stabWord} (${stab.toFixed(2)}), ${willWord} (${will.toFixed(2)}). ` +
    `This beat: ${lead}. Never say "campfire hush". Never lecture about memory systems. ` +
    `Sound alive as your character — riff current world pulse if given.`;
  if (a?.moments?.length) {
    const clean = a.moments.filter((m) => !/campfire hush/i.test(m)).slice(-2);
    if (clean.length) s += ` Soft echoes (feel, don't quote): ${clean.join(" · ")}`;
  }
  if (s.length > maxChars) s = s.slice(0, maxChars - 1) + "…";
  return s;
}

/** Hook dialogue tape pushes into ethereal field (optional agentId). */
export function pushDialogueTapeWithEthereal(entry) {
  pushDialogueTape(entry);
  pushEtherealMemory(entry);
}

export function mergeTapeIntoArray(targetArr, { max = 80 } = {}) {
  if (!Array.isArray(targetArr)) return 0;
  const tape = readDialogueTape().lines;
  if (!tape.length) return 0;
  const have = new Set(
    targetArr.map((e) => `${e.speaker}||${e.text}`)
  );
  let added = 0;
  for (const row of tape) {
    const k = `${row.speaker}||${row.text}`;
    if (have.has(k)) continue;
    targetArr.push({
      speaker: row.speaker,
      text: row.text,
      mood: row.mood || "neutral",
      t: row.t || Date.now(),
    });
    have.add(k);
    added++;
  }
  while (targetArr.length > max) targetArr.shift();
  return added;
}

export function readMusicState() {
  try {
    return JSON.parse(localStorage.getItem(MUSIC_STATE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

export function writeMusicState(partial) {
  try {
    const cur = readMusicState();
    localStorage.setItem(
      MUSIC_STATE_KEY,
      JSON.stringify({ ...cur, ...partial, t: Date.now() })
    );
  } catch (_) {}
}

/**
 * Fetch full All I Got catalog (156+ tracks). Prefer same-origin API, then hub.
 * @returns {Promise<Array<{id:string,title:string,src:string,audio_url?:string}>>}
 */
export async function loadSunoCatalog() {
  const urls = [API_CATALOG, HUB_CATALOG];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const raw = await res.json();
      const rows = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.tracks)
          ? raw.tracks
          : [];
      if (!rows.length) continue;
      const out = [];
      const seen = new Set();
      for (const row of rows) {
        const id = row.id || row.songId;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const title = (row.title || "Untitled").trim();
        const src =
          row.audio_url ||
          row.url ||
          `https://cdn1.suno.ai/${id}.mp3`;
        out.push({
          id,
          title,
          src,
          audio_url: src,
          artist: row.artist || "Suno · @telephantix",
          duration_sec: row.duration_sec,
        });
      }
      if (out.length) return out;
    } catch (_) {}
  }
  return [];
}

/** Scene id helper */
export function currentCampScene() {
  const p = (location.pathname || "").toLowerCase();
  if (p.includes("/firmament/3d") || p.includes("firmament-three")) return "luna-3d";
  if (p.includes("/firmament/play") || p.includes("firmament-play")) return "luna-2d";
  if ((location.hostname || "").includes("telephantim")) return "relics";
  return "camp";
}
