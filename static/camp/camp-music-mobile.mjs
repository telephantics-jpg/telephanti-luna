/**
 * Mobile music keep-alive for Luna Camp (iOS + Android).
 *
 * Problems this targets:
 * - Android: screen off → first track ends, next play() fails / playlist dies
 * - iOS: screen off/on → system “Now Playing” glitch / double-resume like Apple Music
 *
 * Approach: harden <audio>, Media Session metadata + handlers, resume only when
 * still intended-playing but paused/stuck after unlock (never force-start if user stopped).
 */

/**
 * @param {HTMLAudioElement|null|undefined} audio
 * @returns {HTMLAudioElement|null|undefined}
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
  // Prefer continuous stream for OS media pipeline
  try {
    audio.crossOrigin = audio.crossOrigin || "anonymous";
  } catch (_) {}
  return audio;
}

/**
 * Ensure a persistent audio element lives in the document (better OS handoff
 * than orphaned `new Audio()` on some mobile browsers).
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
    el.style.cssText = "position:fixed;width:0;height:0;opacity:0;pointer-events:none;left:-9999px;";
    document.body.appendChild(el);
  }
  return /** @type {HTMLAudioElement} */ (hardenAudioEl(el));
}

/**
 * @typedef {object} MediaSessionHandlers
 * @property {() => void} [play]
 * @property {() => void} [pause]
 * @property {() => void} [stop]
 * @property {() => void} [next]
 * @property {() => void} [prev]
 */

/**
 * @param {MediaSessionHandlers} handlers
 */
export function installMediaSession(handlers = {}) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
    return {
      update() {},
      clear() {},
      dispose() {},
    };
  }
  const ms = navigator.mediaSession;
  const bind = (action, fn) => {
    if (typeof fn !== "function") return;
    try {
      ms.setActionHandler(action, () => {
        try {
          fn();
        } catch (_) {}
      });
    } catch (_) {
      /* action unsupported on this browser */
    }
  };
  bind("play", handlers.play);
  bind("pause", handlers.pause);
  bind("stop", handlers.stop);
  bind("nexttrack", handlers.next);
  bind("previoustrack", handlers.prev);

  return {
    /**
     * @param {{ title?: string, artist?: string, album?: string, playing?: boolean, artwork?: MediaImage[] }} meta
     */
    update(meta = {}) {
      try {
        ms.metadata = new MediaMetadata({
          title: meta.title || "Telephantix",
          artist: meta.artist || "Telephantix",
          album: meta.album || "Luna Camp",
          artwork: Array.isArray(meta.artwork) ? meta.artwork : defaultArtwork(),
        });
      } catch (_) {}
      try {
        if (meta.playing === true) ms.playbackState = "playing";
        else if (meta.playing === false) ms.playbackState = "paused";
      } catch (_) {}
    },
    clear() {
      try {
        ms.metadata = null;
        ms.playbackState = "none";
      } catch (_) {}
    },
    dispose() {
      for (const action of ["play", "pause", "stop", "nexttrack", "previoustrack"]) {
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
  // Relative artwork — OS may ignore if not absolute; still fine as empty fallback
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
 * @property {() => boolean} isWantedPlaying  user intends music on
 * @property {() => HTMLAudioElement|null|undefined} getAudio
 * @property {(why: string) => void} [resume]  play current track again
 * @property {(why: string) => void} [advance] skip to next if ended/stuck at end
 * @property {(msg: string) => void} [log]
 */

/**
 * Resume playlist after lock-screen / tab freeze without auto-starting cold.
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
    // Debounce unlock storms (iOS fires pageshow + focus + visibility together)
    if (now - lastRecoverAt < 280) return;
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
        (dur > 1 && Number.isFinite(dur) && a.currentTime >= dur - 0.45);
      if (atEnd) {
        log(`[music-mobile] advance (${why})`);
        opts.advance?.(why);
        return;
      }
      if (a.paused || a.readyState === 0) {
        log(`[music-mobile] resume (${why})`);
        opts.resume?.(why);
      }
    } catch (err) {
      log(`[music-mobile] recover err ${err?.message || err}`);
    } finally {
      recovering = false;
    }
  };

  const onVis = () => {
    if (document.hidden) return;
    // Stagger: Android unlock often needs a beat before play() is allowed again
    setTimeout(() => recover("visible"), 60);
    setTimeout(() => recover("visible-late"), 450);
  };

  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("pageshow", () => {
    setTimeout(() => recover("pageshow"), 40);
  });
  window.addEventListener("focus", () => {
    setTimeout(() => recover("focus"), 80);
  });

  // Soft watchdog while page is backgrounded: if track should play but has been
  // stalled paused (common after ended→next on Android), try advance/resume.
  // Browsers throttle timers when locked; still helps on partial freezes.
  const tick = setInterval(() => {
    if (disposed || document.hidden === false) return;
    if (!opts.isWantedPlaying()) return;
    const a = opts.getAudio?.();
    if (!a) return;
    if (a.ended) {
      recover("bg-ended");
      return;
    }
    // Stuck near end without ended firing
    const dur = Number(a.duration) || 0;
    if (dur > 1 && a.currentTime >= dur - 0.2 && a.paused) {
      recover("bg-stuck-end");
    }
  }, 4000);

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
 * Attach near-end backup so we advance even if `ended` is flaky on mobile.
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
