/**
 * Luna video avatar — HTML5 looping clips + canvas lip-sync overlay.
 */
const BUILD = "70";

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

// Portrait mouth anchor (normalized) — tuned for luna-portrait.jpg
const MOUTH = { x: 0.5, y: 0.575, w: 0.09, h: 0.035 };

export class LunaVideoAvatar {
  constructor(videoEl, overlayCanvas = null) {
    this.video = videoEl;
    this.motionEl = videoEl?.parentElement?.classList?.contains("luna-video-motion")
      ? videoEl.parentElement
      : null;
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
    this.mouth = 0;
    this.targetMouth = 0;
    this.nod = 0;
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
      this.analyser.smoothingTimeConstant = 0.55;
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
      this.spawnParticles("spark", 3 + Math.floor(Math.random() * 3));
    }
  }

  setMood(mood) {
    this.mood = mood || "happy";
  }

  setSpeaking(on) {
    this.speaking = !!on;
    if (on) {
      this.setState("speak");
      this.nod = Math.max(this.nod, 0.5);
    } else if (this.state === "speak") {
      this.setState("idle");
      this.targetMouth = 0;
    }
  }

  setPointer(nx, ny) {
    this.targetEyeX = nx;
    this.targetEyeY = ny;
    const parallax = Math.max(-8, Math.min(8, nx * 5));
    const tilt = Math.max(-2, Math.min(2, ny * 1.5));
    const target = this.motionEl || this.video;
    if (target) {
      target.style.transform = `translateX(${parallax}px) translateY(${tilt}px) scale(1.03)`;
    }
  }

  pulseTouch(strength = 1, nx = null, ny = null) {
    this.touchPulse = Math.min(1, this.touchPulse + 0.45 * strength);
    this.setState("touch");
    const count = 2 + Math.floor(strength * 2);
    if (nx != null && ny != null) this.spawnParticlesAt(nx, ny, "spark", count);
    else this.spawnParticles("spark", count);
  }

  setMouthLevel(v) {
    this.targetMouth = Math.max(0, Math.min(1, v));
    if (v > 0.25) this.nod = Math.max(this.nod, 0.35);
  }

  nodOnce() {
    this.nod = 1;
    const target = this.motionEl || this.video;
    if (!target) return;
    target.animate([
      { transform: target.style.transform || "translateY(0) scale(1.03)" },
      { transform: "translateY(8px) scale(1.05)" },
      { transform: target.style.transform || "translateY(0) scale(1.03)" },
    ], { duration: 420, easing: "ease-out" });
  }

  spawnParticlesAt(nx, ny, kind = "spark", count = 3) {
    const w = this.viewW;
    const h = this.viewH;
    const cx = Math.max(0, Math.min(1, nx)) * w;
    const cy = Math.max(0, Math.min(1, ny)) * h;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        kind,
        x: cx + (Math.random() - 0.5) * 28,
        y: cy + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 2.2,
        vy: -0.6 - Math.random() * 1.4,
        life: 1,
        size: 4 + Math.random() * 7,
        rot: Math.random() * Math.PI,
      });
    }
  }

  spawnParticles(kind = "spark", count = 3) {
    this.spawnParticlesAt(0.5, 0.42, kind, count);
  }

  observeResize() {
    if (this._resizeObs) return;
    this._resizeObs = new ResizeObserver(() => this._resize());
    const parent = this.video?.parentElement?.parentElement || this.video?.parentElement;
    if (parent) this._resizeObs.observe(parent);
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    const parent = this.video?.parentElement?.parentElement || this.video?.parentElement;
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

  _readAudioLevel() {
    if (!this.analyser || !this.speaking) return 0;
    const buf = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(buf);
    let sum = 0;
    const n = Math.min(28, buf.length);
    for (let i = 0; i < n; i++) sum += buf[i];
    return Math.min(1, (sum / n) / 95);
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
    const audioLvl = this._readAudioLevel();
    if (this.speaking) {
      this.targetMouth = Math.max(this.targetMouth * 0.82, audioLvl * 0.95);
      if (audioLvl > 0.18 && Math.random() < 0.05) this.nod = Math.max(this.nod, 0.55);
    }
    this.mouth += (this.targetMouth - this.mouth) * 0.38;
    if (!this.speaking) {
      this.mouth *= 0.78;
      this.targetMouth *= 0.85;
    }
    if (this.nod > 0) this.nod = Math.max(0, this.nod - 0.04);
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

  _drawMouth(ctx, w, h) {
    const open = this.mouth;
    const mouthX = w * MOUTH.x;
    const mouthY = h * MOUTH.y + this.nod * 5;
    if (open <= 0.03) return;

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    const lipW = w * MOUTH.w * (0.75 + open * 0.55);
    const lipH = h * MOUTH.h * (0.5 + open * 2.8);

    ctx.fillStyle = `rgba(28, 8, 14, ${0.35 + open * 0.45})`;
    ctx.beginPath();
    ctx.ellipse(mouthX, mouthY + lipH * 0.15, lipW * 0.92, lipH, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(175, 75, 95, ${0.25 + open * 0.35})`;
    ctx.beginPath();
    ctx.ellipse(mouthX, mouthY - lipH * 0.08, lipW, lipH * 0.42, 0, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = `rgba(195, 90, 110, ${0.3 + open * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(mouthX, mouthY + lipH * 0.22, lipW * 0.95, lipH * 0.55, 0, 0, Math.PI);
    ctx.fill();

    if (open > 0.2) {
      ctx.fillStyle = `rgba(255, 235, 230, ${open * 0.35})`;
      ctx.beginPath();
      ctx.ellipse(mouthX, mouthY + lipH * 0.05, lipW * 0.55, lipH * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
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

    this._drawMouth(ctx, w, h);

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