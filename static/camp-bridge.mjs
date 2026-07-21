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
