/**
 * Telephantix DJ Vox — Spotify-style: every track gets a witty comment.
 *
 * - Song always changes instantly on Next (never waits on TTS).
 * - Prefetch + cache bridge drops for upcoming songs so Vox is ready.
 * - Most songs: slightly longer witty bridge naming the track.
 * - Every 3–4 songs: "truth from today's world" then land on the title.
 * - Spam-skip cancels the old rant and starts the new track's intro ASAP.
 */

const DUCK_VOL = 0.2;
const PREFETCH_AHEAD = 3; // next N tracks in queue
const PREFETCH_LEAD_SEC = 22; // also warm near end of current
const MIN_TRACK_FOR_END_PREFETCH = 12;
const RAMP_UP_MS = 600;
const SETTLE_MS = 180; // after skip storm, announce the track you stayed on

/**
 * @param {object} api
 */
export function createDjRadio(api = {}) {
  let enabled = false;
  let micBusy = false;
  let dropCache = new Map(); // cacheKey (track|kind) -> drop
  let inflight = new Map();
  let micAudio = null;
  let savedMusicVol = null;
  let tick = null;
  let lastStatus = "";
  let saidId = false;
  let rampTimer = null;
  let announceGen = 0;
  let settleTimer = null;
  let lastAnnouncedKey = "";
  let songsSinceTruth = 0;
  let truthInterval = 3 + Math.floor(Math.random() * 2);

  function status(msg) {
    lastStatus = msg || "";
    try {
      api.setStatus?.(lastStatus);
    } catch (_) {}
    try {
      api.onUi?.({ enabled, micBusy, status: lastStatus });
    } catch (_) {}
  }

  function tracks() {
    try {
      const t = api.getTracks?.() || [];
      return Array.isArray(t) ? t : [];
    } catch {
      return [];
    }
  }

  function index() {
    try {
      return Math.max(0, Number(api.getIndex?.()) || 0);
    } catch {
      return 0;
    }
  }

  function trackKey(t) {
    if (!t) return "";
    return String(t.id || t.src || t.title || "").trim().toLowerCase();
  }

  function cacheKey(t, kind = "bridge") {
    const k = trackKey(t);
    if (!k) return "";
    const kindNorm = (kind || "bridge").toLowerCase() === "truth" ? "truth" : "bridge";
    return `${k}|${kindNorm}`;
  }

  function pickDropKind() {
    songsSinceTruth += 1;
    if (songsSinceTruth >= truthInterval) {
      songsSinceTruth = 0;
      truthInterval = 3 + Math.floor(Math.random() * 2);
      return "truth";
    }
    return "bridge";
  }

  function trackAt(i) {
    const ts = tracks();
    if (!ts.length) return null;
    const n = ts.length;
    return ts[((i % n) + n) % n];
  }

  function getMusic() {
    try {
      return api.getAudio?.() || null;
    } catch {
      return null;
    }
  }

  function clearRamp() {
    if (rampTimer) {
      clearInterval(rampTimer);
      rampTimer = null;
    }
  }

  function duckMusic() {
    const a = getMusic();
    if (!a) return;
    clearRamp();
    if (savedMusicVol == null) {
      const v = Number(a.volume);
      savedMusicVol = Number.isFinite(v) && v > 0.05 ? v : 0.55;
    }
    try {
      a.volume = Math.min(savedMusicVol, DUCK_VOL);
    } catch (_) {}
  }

  function unduckMusic({ ramp = true } = {}) {
    const a = getMusic();
    const target = savedMusicVol != null ? savedMusicVol : 0.55;
    savedMusicVol = null;
    if (!a) return;
    clearRamp();
    if (!ramp) {
      try {
        a.volume = target;
      } catch (_) {}
      return;
    }
    const start = Number(a.volume) || DUCK_VOL;
    const steps = 12;
    let i = 0;
    rampTimer = setInterval(() => {
      i++;
      const t = Math.min(1, i / steps);
      try {
        a.volume = start + (target - start) * t;
      } catch (_) {}
      if (i >= steps) {
        clearRamp();
        try {
          a.volume = target;
        } catch (_) {}
      }
    }, Math.max(28, RAMP_UP_MS / steps));
  }

  function stopMic() {
    if (!micAudio) return;
    try {
      micAudio.pause();
      micAudio.removeAttribute("src");
      micAudio.load?.();
    } catch (_) {}
    micAudio = null;
  }

  function cancelMic() {
    stopMic();
    micBusy = false;
    if (savedMusicVol != null) unduckMusic({ ramp: true });
  }

  function playMicB64(b64) {
    return new Promise((resolve, reject) => {
      try {
        stopMic();
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const a = new Audio();
        a.preload = "auto";
        try {
          a.setAttribute("playsinline", "");
          a.playsInline = true;
        } catch (_) {}
        a.src = url;
        a.volume = 1;
        micAudio = a;
        const done = (ok) => {
          try {
            URL.revokeObjectURL(url);
          } catch (_) {}
          if (micAudio === a) micAudio = null;
          ok ? resolve() : reject(new Error("mic failed"));
        };
        a.addEventListener("ended", () => done(true), { once: true });
        a.addEventListener("error", () => done(false), { once: true });
        a.play().catch(() => done(false));
      } catch (err) {
        reject(err);
      }
    });
  }

  async function fetchDrop(prevTrack, nextTrack, kind = "bridge") {
    const kindNorm = (kind || "bridge").toLowerCase() === "truth" ? "truth" : kind || "bridge";
    const body = {
      prev_title: prevTrack?.title || "",
      next_title: nextTrack?.title || "the next track",
      artist: nextTrack?.artist || "Telephantix",
      station: "Telephantix Radio",
      voice: "vox",
      use_llm: true,
      mood: kindNorm === "truth" ? "thoughtful" : "happy",
      rate: kindNorm === "truth" ? 10 : 12,
      pitch: -2,
      kind: kindNorm,
    };
    const res = await fetch("/api/firmament/dj/drop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`DJ drop HTTP ${res.status}`);
    return res.json();
  }

  function ensureDrop(track, prevTrack, kind = "bridge") {
    const kindNorm = (kind || "bridge").toLowerCase() === "truth" ? "truth" : "bridge";
    const key = cacheKey(track, kindNorm);
    if (!key) return Promise.resolve(null);
    if (dropCache.has(key)) {
      return Promise.resolve(dropCache.get(key));
    }
    if (inflight.has(key)) return inflight.get(key);

    const p = fetchDrop(prevTrack, track, kindNorm)
      .then((data) => {
        if (data?.audio_b64) {
          dropCache.set(key, { ...data, at: Date.now(), kind: kindNorm });
          if (dropCache.size > 48) {
            const oldest = [...dropCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
            if (oldest) dropCache.delete(oldest[0]);
          }
        }
        inflight.delete(key);
        return data;
      })
      .catch((err) => {
        console.warn("[dj] fetch", err);
        inflight.delete(key);
        return null;
      });
    inflight.set(key, p);
    return p;
  }

  function warmAhead() {
    if (!enabled) return;
    const ts = tracks();
    if (ts.length < 2) return;
    const i = index();
    const prev = ts[i];
    for (let k = 1; k <= PREFETCH_AHEAD; k++) {
      const t = ts[(i + k) % ts.length];
      const key = cacheKey(t, "bridge");
      if (!key || dropCache.has(key) || inflight.has(key)) continue;
      ensureDrop(t, k === 1 ? prev : ts[(i + k - 1) % ts.length], "bridge");
    }
  }

  async function announceTrack(forIndex, prevTrack, opts = {}) {
    if (!enabled) return;
    const gen = ++announceGen;
    const ts = tracks();
    if (!ts.length) return;
    const n = ts.length;
    const ni = ((forIndex % n) + n) % n;
    const next = ts[ni];
    const key = trackKey(next);
    const title = next?.title || "this track";
    const kind = opts.kind || pickDropKind();

    cancelMic();

    if (key && key === lastAnnouncedKey && !opts.force) {
      warmAhead();
      return;
    }

    status(kind === "truth" ? `Vox · truth · ${title}…` : `Vox · ${title}…`);

    const ck = cacheKey(next, kind);
    let data = ck && dropCache.has(ck) ? dropCache.get(ck) : null;
    if (!data?.audio_b64 && kind === "bridge") {
      const bridgeCk = cacheKey(next, "bridge");
      if (dropCache.has(bridgeCk)) data = dropCache.get(bridgeCk);
    }
    if (!data?.audio_b64) {
      data = await ensureDrop(next, prevTrack, kind);
    }

    if (gen !== announceGen) return;
    if (index() !== ni) return;
    if (!data?.audio_b64) {
      status(`♫ ${title}`);
      warmAhead();
      return;
    }

    lastAnnouncedKey = key;
    micBusy = true;
    try {
      duckMusic();
      try {
        const m = getMusic();
        if (m?.paused) await m.play?.();
      } catch (_) {}

      if (gen !== announceGen || index() !== ni) return;

      api.onUi?.({
        enabled: true,
        micBusy: true,
        status: data.text,
        dropText: data.text,
        source: data.source,
        kind,
        dj: data.dj,
      });
      status(data.text || `Vox · ${title}`);
      await playMicB64(data.audio_b64);
    } catch (err) {
      console.warn("[dj] mic", err);
    } finally {
      if (gen === announceGen) {
        micBusy = false;
        unduckMusic({ ramp: true });
        status(`♫ ${title}`);
        try {
          api.onUi?.({ enabled, micBusy: false, status: lastStatus });
        } catch (_) {}
        warmAhead();
      }
    }
  }

  function scheduleAnnounceForCurrent(prevTrack) {
    if (!enabled) return;
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    const ni = index();
    const next = trackAt(ni);
    const key = cacheKey(next, "bridge");
    const cached = key && dropCache.has(key);
    const delay = cached ? 40 : SETTLE_MS;

    if (next) ensureDrop(next, prevTrack, "bridge");
    warmAhead();

    settleTimer = setTimeout(() => {
      settleTimer = null;
      if (!enabled) return;
      if (index() !== ni) return;
      void announceTrack(ni, prevTrack, { force: true });
    }, delay);
  }

  function onMusicEnded() {
    if (!enabled) return;
    const ts = tracks();
    if (!ts.length) return;
    const from = index();
    const prev = ts[from];
    const ni = (from + 1) % ts.length;
    // Song first
    try {
      api.playAt?.(ni, { forceReload: true, hard: true, seekTime: 0, quiet: true });
    } catch (_) {
      try {
        api.playAt?.(ni);
      } catch (_) {}
    }
    lastAnnouncedKey = ""; // new play of next track needs its comment
    scheduleAnnounceForCurrent(prev);
  }

  function startWatch() {
    if (tick) return;
    tick = setInterval(() => {
      if (!enabled) return;
      warmAhead();
      const music = getMusic();
      if (!music || micBusy) return;
      const dur = Number(music.duration) || 0;
      const t = Number(music.currentTime) || 0;
      // Near end: make sure next drop is hot
      if (dur > MIN_TRACK_FOR_END_PREFETCH && dur - t < PREFETCH_LEAD_SEC) {
        warmAhead();
      }
      if (dur > 2 && t >= dur - 0.12 && music.paused) {
        onMusicEnded();
      }
    }, 700);
  }

  function stopWatch() {
    if (tick) {
      clearInterval(tick);
      tick = null;
    }
  }

  let boundAudio = null;
  function bindEnded(a) {
    if (boundAudio === a) return;
    if (boundAudio) {
      try {
        boundAudio.removeEventListener("ended", onMusicEnded);
      } catch (_) {}
    }
    boundAudio = a || null;
    if (boundAudio) boundAudio.addEventListener("ended", onMusicEnded);
  }

  function setEnabled(on) {
    enabled = !!on;
    if (enabled) {
      startWatch();
      bindEnded(getMusic());
      status("DJ Vox · witty lines · truth every 3–4 songs");
      songsSinceTruth = 0;
      truthInterval = 3 + Math.floor(Math.random() * 2);
      warmAhead();
      // Comment on whatever is already playing
      if (api.isWantedOn?.()) {
        lastAnnouncedKey = "";
        scheduleAnnounceForCurrent(null);
        if (!saidId) {
          saidId = true;
        }
      }
    } else {
      announceGen++;
      if (settleTimer) clearTimeout(settleTimer);
      stopWatch();
      cancelMic();
      clearRamp();
      unduckMusic({ ramp: false });
      micBusy = false;
      status("");
    }
    try {
      api.onUi?.({ enabled, micBusy, status: lastStatus });
    } catch (_) {}
  }

  const rebind = setInterval(() => {
    if (!enabled) return;
    const a = getMusic();
    if (a && a !== boundAudio) bindEnded(a);
  }, 2000);

  return {
    setEnabled,
    isEnabled: () => enabled,
    isBusy: () => micBusy,
    getStatus: () => lastStatus,

    /** Immediate song change already done by host — queue this track's comment */
    onTrackChanged(prevTrack) {
      if (!enabled) return;
      lastAnnouncedKey = "";
      scheduleAnnounceForCurrent(prevTrack || null);
    },

    /** Legacy: change song then comment (song first, always) */
    introThenPlay(targetIndex) {
      const ts = tracks();
      const n = Math.max(1, ts.length);
      const ni = ((Number(targetIndex) % n) + n) % n;
      const prev = ts[index()];
      try {
        api.playAt?.(ni, { forceReload: true, hard: true, seekTime: 0, quiet: true });
      } catch (_) {
        try {
          api.playAt?.(ni);
        } catch (_) {}
      }
      lastAnnouncedKey = "";
      if (enabled) scheduleAnnounceForCurrent(prev);
    },

    hush() {
      announceGen++;
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      cancelMic();
    },

    /** Pre-warm whole visible queue (e.g. after shuffle) */
    rewarm() {
      dropCache.clear();
      inflight.clear();
      lastAnnouncedKey = "";
      warmAhead();
    },

    dispose() {
      setEnabled(false);
      clearInterval(rebind);
      clearRamp();
      dropCache.clear();
      if (boundAudio) {
        try {
          boundAudio.removeEventListener("ended", onMusicEnded);
        } catch (_) {}
      }
    },
  };
}

export async function probeDjStatus() {
  try {
    const r = await fetch("/api/firmament/dj/status", { cache: "no-store" });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}
