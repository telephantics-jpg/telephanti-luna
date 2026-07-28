/**
 * Mobile music keep-alive for Luna Camp (iOS + Android + car / lock-screen controls).
 *
 * - Background / lock: Media Session title + seek + next/prev (like phone / car radio)
 * - Unlock: soft-resume same track + position — never re-roll a random set
 * - Android: advance only when truly ended; retry play on unlock if blocked
 */

const PERSIST_KEY = "luna-camp-music-persist-v1";

/**
 * @param {HTMLAudioElement|null|undefined} audio
 */
export function hardenAudioEl(audio) {
  if (!audio) return audio;
  try {
    audio.setAttribute("playsinline", "");
    audio.setAttribute("webkit-playsinline", "");
    audio.playsInline = true;
  } catch (_) {}
  try {
    audio.preload = "auto";
  } catch (_) {}
  return audio;
}

/**
 * @param {string} id
 * @returns {HTMLAudioElement}
 */
export function ensureDomAudio(id = "camp-music-audio") {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("audio");
    el.id = id;
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");
    el.preload = "auto";
    el.style.cssText =
      "position:fixed;width:0;height:0;opacity:0;pointer-events:none;left:-9999px;";
    document.body.appendChild(el);
  }
  return /** @type {HTMLAudioElement} */ (hardenAudioEl(el));
}

/** @returns {{ index: number, time: number, title?: string, scene?: string, on?: boolean }|null} */
export function loadMusicPersist() {
  try {
    const raw = sessionStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    return {
      index: Math.max(0, Number(o.index) || 0),
      time: Math.max(0, Number(o.time) || 0),
      title: o.title ? String(o.title) : "",
      scene: o.scene ? String(o.scene) : "",
      on: o.on !== false,
    };
  } catch (_) {
    return null;
  }
}

/**
 * @param {{ index?: number, time?: number, title?: string, scene?: string, on?: boolean }} state
 */
export function saveMusicPersist(state = {}) {
  try {
    const prev = loadMusicPersist() || {};
    const next = {
      index: Math.max(0, Number(state.index ?? prev.index) || 0),
      time: Math.max(0, Number(state.time ?? prev.time) || 0),
      title: state.title != null ? String(state.title) : prev.title || "",
      scene: state.scene != null ? String(state.scene) : prev.scene || "",
      on: state.on !== undefined ? !!state.on : prev.on !== false,
      at: Date.now(),
    };
    sessionStorage.setItem(PERSIST_KEY, JSON.stringify(next));
  } catch (_) {}
}

export function clearMusicPersist() {
  try {
    sessionStorage.removeItem(PERSIST_KEY);
  } catch (_) {}
}

/**
 * File token for comparing audio src without full URL noise.
 * @param {string} src
 */
export function audioFileKey(src) {
  const s = String(src || "");
  const file = (s.split("/").pop() || "").split("?")[0];
  return file || s;
}

/**
 * @param {HTMLAudioElement|null|undefined} audio
 * @param {string} nextSrc
 */
export function audioNeedsNewSrc(audio, nextSrc) {
  if (!audio) return true;
  if (audio.ended) return true;
  const file = audioFileKey(nextSrc);
  if (!file) return true;
  const cur = audio.currentSrc || audio.src || "";
  if (!cur) return true;
  return !cur.includes(file);
}

/**
 * Soft play: same src → keep currentTime; optional seek restore from persist.
 * @param {HTMLAudioElement} audio
 * @param {{ src: string, volume?: number, seekTime?: number, forceReload?: boolean }} opts
 * @returns {Promise<void>}
 */
export function softPlayAudio(audio, opts = {}) {
  if (!audio) return Promise.reject(new Error("no audio"));
  hardenAudioEl(audio);
  const nextSrc = opts.src || "";
  const needs = opts.forceReload || audioNeedsNewSrc(audio, nextSrc);
  const savedSeek =
    typeof opts.seekTime === "number" && opts.seekTime > 0.5 ? opts.seekTime : null;

  if (needs && nextSrc) {
    audio.src = nextSrc;
    try {
      audio.load();
    } catch (_) {}
  }
  audio.loop = false;
  if (typeof opts.volume === "number") audio.volume = opts.volume;
  audio.muted = false;

  const applySeekThenPlay = () => {
    if (savedSeek != null && Number.isFinite(audio.duration) && audio.duration > 1) {
      try {
        audio.currentTime = Math.min(savedSeek, Math.max(0, audio.duration - 0.35));
      } catch (_) {}
    } else if (savedSeek != null && needs) {
      // duration not ready — set after loadedmetadata
      const onMeta = () => {
        try {
          if (Number.isFinite(audio.duration) && audio.duration > 1) {
            audio.currentTime = Math.min(savedSeek, Math.max(0, audio.duration - 0.35));
          }
        } catch (_) {}
      };
      audio.addEventListener("loadedmetadata", onMeta, { once: true });
    }
    const p = audio.play();
    return p && typeof p.then === "function" ? p : Promise.resolve();
  };

  if (!needs && !audio.paused && !audio.ended) {
    // Already playing same track — do not restart
    return Promise.resolve();
  }

  if (audio.readyState >= 2) return applySeekThenPlay();
  return new Promise((resolve, reject) => {
    const go = () => {
      applySeekThenPlay().then(resolve).catch(reject);
    };
    audio.addEventListener("canplay", go, { once: true });
    // Fallback if canplay already fired
    setTimeout(() => {
      if (audio.readyState >= 2) go();
    }, 80);
  });
}

/**
 * @typedef {object} MediaSessionHandlers
 * @property {() => void} [play]
 * @property {() => void} [pause]
 * @property {() => void} [stop]
 * @property {() => void} [next]
 * @property {() => void} [prev]
 * @property {(delta: number) => void} [seekBy]  seconds (+/-)
 * @property {(time: number) => void} [seekTo]   absolute seconds
 */

/**
 * @param {MediaSessionHandlers} handlers
 */
export function installMediaSession(handlers = {}) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
    return {
      update() {},
      setPosition() {},
      clear() {},
      dispose() {},
    };
  }
  const ms = navigator.mediaSession;
  const bind = (action, fn) => {
    if (typeof fn !== "function") return;
    try {
      ms.setActionHandler(action, (details) => {
        try {
          fn(details);
        } catch (_) {}
      });
    } catch (_) {}
  };

  bind("play", () => handlers.play?.());
  bind("pause", () => handlers.pause?.());
  bind("stop", () => handlers.stop?.());
  bind("nexttrack", () => handlers.next?.());
  bind("previoustrack", () => handlers.prev?.());
  bind("seekbackward", (d) => {
    const sec = Math.max(5, Number(d?.seekOffset) || 10);
    handlers.seekBy?.(-sec);
  });
  bind("seekforward", (d) => {
    const sec = Math.max(5, Number(d?.seekOffset) || 10);
    handlers.seekBy?.(sec);
  });
  bind("seekto", (d) => {
    if (d && typeof d.seekTime === "number") handlers.seekTo?.(d.seekTime);
  });

  return {
    /**
     * @param {{ title?: string, artist?: string, album?: string, playing?: boolean, artwork?: MediaImage[] }} meta
     */
    update(meta = {}) {
      try {
        ms.metadata = new MediaMetadata({
          title: meta.title || "Telephantix",
          artist: meta.artist || "Telephantix",
          album: meta.album || "Luna Camp Radio",
          artwork: Array.isArray(meta.artwork) ? meta.artwork : defaultArtwork(),
        });
      } catch (_) {}
      try {
        if (meta.playing === true) ms.playbackState = "playing";
        else if (meta.playing === false) ms.playbackState = "paused";
      } catch (_) {}
    },
    /**
     * Drive car / lock-screen scrubber when supported.
     * @param {{ duration?: number, position?: number, playbackRate?: number }} pos
     */
    setPosition(pos = {}) {
      try {
        if (typeof ms.setPositionState !== "function") return;
        const duration = Number(pos.duration) || 0;
        const position = Math.max(0, Number(pos.position) || 0);
        if (!(duration > 0) || !Number.isFinite(duration)) return;
        ms.setPositionState({
          duration,
          playbackRate: Number(pos.playbackRate) || 1,
          position: Math.min(position, duration),
        });
      } catch (_) {}
    },
    clear() {
      try {
        ms.metadata = null;
        ms.playbackState = "none";
      } catch (_) {}
    },
    dispose() {
      for (const action of [
        "play",
        "pause",
        "stop",
        "nexttrack",
        "previoustrack",
        "seekbackward",
        "seekforward",
        "seekto",
      ]) {
        try {
          ms.setActionHandler(action, null);
        } catch (_) {}
      }
      try {
        ms.metadata = null;
        ms.playbackState = "none";
      } catch (_) {}
    },
  };
}

function defaultArtwork() {
  try {
    const origin = location.origin || "";
    return [
      { src: `${origin}/static/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${origin}/static/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
    ];
  } catch (_) {
    return [];
  }
}

/**
 * @typedef {object} KeepAliveOpts
 * @property {() => boolean} isWantedPlaying
 * @property {() => HTMLAudioElement|null|undefined} getAudio
 * @property {(why: string) => void} [resume]  soft resume — same song, keep position
 * @property {(why: string) => void} [advance] only when track truly ended
 * @property {(msg: string) => void} [log]
 */

/**
 * Unlock / bg recovery — never re-rolls playlist; only soft-resumes or advances at end.
 * @param {KeepAliveOpts} opts
 */
export function installMusicKeepAlive(opts) {
  let disposed = false;
  let recovering = false;
  let lastRecoverAt = 0;

  const log = (m) => {
    try {
      opts.log?.(m);
    } catch (_) {}
  };

  const recover = (why) => {
    if (disposed || recovering) return;
    if (typeof opts.isWantedPlaying !== "function" || !opts.isWantedPlaying()) return;
    const now = Date.now();
    // Strong debounce — iOS fires pageshow + focus + visibility together
    if (now - lastRecoverAt < 500) return;
    lastRecoverAt = now;
    recovering = true;
    try {
      const a = opts.getAudio?.();
      if (!a) {
        opts.resume?.(why);
        return;
      }
      const dur = Number(a.duration) || 0;
      const atEnd =
        !!a.ended ||
        (dur > 2 && Number.isFinite(dur) && a.currentTime >= dur - 0.35 && a.paused);
      if (atEnd) {
        log(`[music-mobile] advance (${why})`);
        opts.advance?.(why);
        return;
      }
      // Already playing same track — leave it alone (no restart / no random)
      if (!a.paused && !a.ended && a.readyState >= 2) {
        log(`[music-mobile] already playing (${why})`);
        return;
      }
      if (a.paused || a.readyState === 0) {
        log(`[music-mobile] soft-resume (${why}) t=${a.currentTime | 0}`);
        opts.resume?.(why);
      }
    } catch (err) {
      log(`[music-mobile] recover err ${err?.message || err}`);
    } finally {
      recovering = false;
    }
  };

  const onVis = () => {
    if (document.hidden) {
      // Snapshot position for car/phone resume
      try {
        const a = opts.getAudio?.();
        if (a && opts.isWantedPlaying()) {
          saveMusicPersist({
            time: a.currentTime || 0,
            on: true,
          });
        }
      } catch (_) {}
      return;
    }
    setTimeout(() => recover("visible"), 80);
    setTimeout(() => recover("visible-late"), 500);
  };

  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("pageshow", (e) => {
    // bfcache restore — soft resume only, never full reload of track list
    if (e.persisted) setTimeout(() => recover("bfcache"), 60);
    else setTimeout(() => recover("pageshow"), 80);
  });
  window.addEventListener("focus", () => {
    setTimeout(() => recover("focus"), 120);
  });

  const tick = setInterval(() => {
    if (disposed) return;
    if (!opts.isWantedPlaying()) return;
    const a = opts.getAudio?.();
    if (!a) return;
    // Persist position often so unlock lands mid-song
    if (!a.paused && a.currentTime > 0) {
      try {
        saveMusicPersist({ time: a.currentTime, on: true });
      } catch (_) {}
    }
    if (!document.hidden) return;
    if (a.ended) recover("bg-ended");
    else {
      const dur = Number(a.duration) || 0;
      if (dur > 1 && a.currentTime >= dur - 0.2 && a.paused) recover("bg-stuck-end");
    }
  }, 3000);

  return {
    recover,
    dispose() {
      disposed = true;
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
    },
  };
}

/**
 * @param {HTMLAudioElement} audio
 * @param {() => void} onShouldAdvance
 */
export function bindNearEndAdvance(audio, onShouldAdvance) {
  if (!audio || typeof onShouldAdvance !== "function") return () => {};
  let firedForSrc = "";
  const onTime = () => {
    try {
      const dur = Number(audio.duration) || 0;
      if (dur < 2 || !Number.isFinite(dur)) return;
      if (audio.currentTime < dur - 0.35) return;
      const key = audio.currentSrc || audio.src || "";
      if (firedForSrc === key) return;
      // Only if stalled at end (not mid-play near end — let `ended` fire cleanly)
      if (!audio.paused && !audio.ended) return;
      firedForSrc = key;
      onShouldAdvance();
    } catch (_) {}
  };
  const onPlay = () => {
    firedForSrc = "";
  };
  audio.addEventListener("timeupdate", onTime);
  audio.addEventListener("play", onPlay);
  return () => {
    audio.removeEventListener("timeupdate", onTime);
    audio.removeEventListener("play", onPlay);
  };
}

/**
 * Bind timeupdate → Media Session position + session persist.
 * @param {HTMLAudioElement} audio
 * @param {{ getIndex: () => number, getTitle?: () => string, scene?: string, mediaSession?: { setPosition: Function }, isOn?: () => boolean }} ctx
 */
export function bindPositionBroadcast(audio, ctx = {}) {
  if (!audio) return () => {};
  let lastSave = 0;
  const onTime = () => {
    try {
      if (ctx.isOn && !ctx.isOn()) return;
      const duration = Number(audio.duration) || 0;
      const position = Number(audio.currentTime) || 0;
      ctx.mediaSession?.setPosition?.({
        duration,
        position,
        playbackRate: audio.playbackRate || 1,
      });
      const now = Date.now();
      if (now - lastSave > 2000) {
        lastSave = now;
        saveMusicPersist({
          index: ctx.getIndex?.() ?? 0,
          time: position,
          title: ctx.getTitle?.() || "",
          scene: ctx.scene || "",
          on: true,
        });
      }
    } catch (_) {}
  };
  audio.addEventListener("timeupdate", onTime);
  return () => audio.removeEventListener("timeupdate", onTime);
}
