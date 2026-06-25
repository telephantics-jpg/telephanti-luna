/**
 * Luna video avatar — HTML5 looping clips (modern Flash-style motion).
 * Same API surface as LiveLunaPortrait for drop-in use.
 */
const BUILD = "69";

const CLIPS = {
  idle: "/static/avatars/luna-idle.mp4",
  listen: "/static/avatars/luna-idle.mp4",
  think: "/static/avatars/luna-speak.mp4",
  speak: "/static/avatars/luna-speak.mp4",
  help: "/static/avatars/luna-speak.mp4",
  flirt: "/static/avatars/luna-flirt.mp4",
  touch: "/static/avatars/luna-flirt.mp4",
  love: "/static/avatars/luna-flirt.mp4",
  excited: "/static/avatars/luna-flirt.mp4",
  dream: "/static/avatars/luna-idle.mp4",
};

const RATES = {
  idle: 1,
  listen: 0.92,
  think: 1.05,
  speak: 1.12,
  help: 1.02,
  flirt: 1.15,
  touch: 1.18,
  love: 1.08,
  excited: 1.2,
  dream: 0.78,
};

export class LunaVideoAvatar {
  constructor(videoEl, overlayCanvas = null) {
    this.video = videoEl;
    this.canvas = overlayCanvas;
    this.ctx = overlayCanvas?.getContext("2d");
    this.state = "idle";
    this.mood = "happy";
    this.speaking = false;
    this.t = 0;
    this.raf = 0;
    this.touchPulse = 0;
    this.particles = [];
    this.targetEyeX = 0;
    this.targetEyeY = 0;
    this._currentClip = "";
    this._swapLock = false;
    this._isLive = false;
    this.onLive = null;
    this.analyser = null;
    this.audioCtx = null;
    this.source = null;
    this._audioAttached = false;
    this.viewW = 360;
    this.viewH = 520;
    this._bindVideoEvents();
  }

  _bindVideoEvents() {
    if (!this.video || this.video.__lunaBound) return;
    this.video.__lunaBound = true;
    const mark = () => this._markLive();
    this.video.addEventListener("playing", mark);
    this.video.addEventListener("timeupdate", () => {
      if (!this._isLive && this.video.currentTime > 0.04 && !this.video.paused) mark();
    });
  }

  _markLive() {
    if (this._isLive) return;
    this._isLive = true;
    this.video?.removeAttribute("poster");
    this.video?.classList.add("is-playing");
    this.onLive?.();
  }

  async load() {
    this.video.muted = true;
    this.video.loop = true;
    this.video.playsInline = true;
    this.video.setAttribute("playsinline", "");
    this.video.setAttribute("webkit-playsinline", "");
    this.video.preload = "auto";
    await this._setClip("idle", true);
    try {
      await this.video.play();
      this._markLive();
    } catch {
      /* needs user gesture */
    }
    this._resize();
    this.start();
    return this;
  }

  async ensurePlaying() {
    if (!this.video) return false;
    try {
      if (this.audioCtx?.state === "suspended") await this.audioCtx.resume();
      await this.video.play();
      this._markLive();
      return !this.video.paused;
    } catch {
      return false;
    }
  }

  start() {
    if (this.raf) return;
    const tick = (now) => {
      this.t = now * 0.001;
      this._step();
      this._drawOverlay();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  attachAudioElement(el) {
    if (!el || this._audioAttached) return;
    try {
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.source = this.audioCtx.createMediaElementSource(el);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      this._audioAttached = true;
    } catch (err) {
      console.warn("Video avatar audio:", err);
    }
  }

  async resumeAudio() {
    await this.ensurePlaying();
  }

  setState(state = "idle") {
    this.state = state || "idle";
    this._setClip(state).catch(() => {});
    if (["flirt", "touch", "love", "excited"].includes(state)) {
      this.spawnParticles(state === "love" ? "heart" : "spark", 3 + Math.floor(Math.random() * 3));
    }
  }

  setMood(mood) {
    this.mood = mood || "happy";
  }

  setSpeaking(on) {
    this.speaking = !!on;
    if (on) this.setState("speak");
    else if (this.state === "speak") this.setState("idle");
  }

  setPointer(nx, ny) {
    this.targetEyeX = nx;
    this.targetEyeY = ny;
    const parallax = Math.max(-10, Math.min(10, nx * 6));
    const tilt = Math.max(-3, Math.min(3, ny * 2));
    if (this.video) {
      this.video.style.transform = `translateX(${parallax}px) translateY(${tilt}px) scale(1.04)`;
    }
  }

  pulseTouch(strength = 1) {
    this.touchPulse = Math.min(1, this.touchPulse + 0.45 * strength);
    this.setState("touch");
    this.spawnParticles("spark", 2 + Math.floor(strength * 2));
  }

  setMouthLevel() { /* driven by speak clip */ }

  nodOnce() {
    if (!this.video) return;
    this.video.animate([
      { transform: "translateY(0) scale(1.04)" },
      { transform: "translateY(8px) scale(1.06)" },
      { transform: "translateY(0) scale(1.04)" },
    ], { duration: 420, easing: "ease-out" });
  }

  spawnParticles(kind = "spark", count = 3) {
    const w = this.viewW;
    const h = this.viewH;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        kind,
        x: w * (0.3 + Math.random() * 0.4),
        y: h * (0.28 + Math.random() * 0.35),
        vx: (Math.random() - 0.5) * 2,
        vy: -0.8 - Math.random() * 1.2,
        life: 1,
        size: 4 + Math.random() * 8,
        rot: Math.random() * Math.PI,
      });
    }
  }

  observeResize() {
    if (this._resizeObs) return;
    this._resizeObs = new ResizeObserver(() => this._resize());
    const parent = this.video?.parentElement;
    if (parent) this._resizeObs.observe(parent);
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    const parent = this.video?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    this.viewW = Math.max(280, Math.min(rect.width || 360, 520));
    this.viewH = Math.max(380, Math.min(rect.height || 520, 720));
    if (this.canvas) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.floor(this.viewW * dpr);
      this.canvas.height = Math.floor(this.viewH * dpr);
      this.canvas.style.width = this.viewW + "px";
      this.canvas.style.height = this.viewH + "px";
      this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  async _setClip(state, initial = false) {
    const src = CLIPS[state] || CLIPS.idle;
    if (this._currentClip === src && !initial) {
      this.video.playbackRate = RATES[state] || 1;
      return;
    }
    if (this._swapLock) return;
    this._swapLock = true;
    try {
      if (!initial) this.video.style.opacity = "0.72";
      this.video.src = src + "?v=" + BUILD;
      this.video.load();
      this.video.playbackRate = RATES[state] || 1;
      await new Promise((res) => {
        const onReady = () => {
          this.video.removeEventListener("loadeddata", onReady);
          res();
        };
        this.video.addEventListener("loadeddata", onReady);
        setTimeout(res, 800);
      });
      await this.video.play().catch(() => {});
      this.video.style.opacity = "1";
      this._currentClip = src;
      if (!this.video.paused) this._markLive();
    } finally {
      this._swapLock = false;
    }
  }

  _step() {
    this.touchPulse *= 0.9;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02;
      p.life -= 0.02;
      p.rot += 0.05;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  _drawOverlay() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    ctx.clearRect(0, 0, w, h);

    if (this.touchPulse > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(167, 139, 250, ${this.touchPulse * 0.12})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    for (const p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.life * 0.9;
      if (p.kind === "heart") {
        ctx.fillStyle = "#c4b5fd";
        ctx.font = `${p.size + 8}px serif`;
        ctx.fillText("♥", -5, 5);
      } else {
        ctx.fillStyle = "#e9d5ff";
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}