/**
 * Live Luna — animated virtual assistant portrait (Ani/Mika-style).
 * States, eye tracking, lip-sync, blush, particles.
 */
export class LiveLunaPortrait {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.imageSrc = options.imageSrc || "/static/avatars/luna-portrait.jpg";
    this.ctx = canvas.getContext("2d");
    this.image = null;
    this.raf = 0;
    this.t = 0;
    this.mouth = 0;
    this.targetMouth = 0;
    this.blink = 0;
    this.nextBlink = 2.4 + Math.random() * 2;
    this.touchPulse = 0;
    this.speaking = false;
    this.state = "idle";
    this.mood = "happy";
    this.stateBlend = 0;
    this.targetStateBlend = 0;
    this.blush = 0;
    this.targetBlush = 0;
    this.eyeX = 0;
    this.eyeY = 0;
    this.targetEyeX = 0;
    this.targetEyeY = 0;
    this.headTilt = 0;
    this.nod = 0;
    this.orgasmNod = 0;
    this.lucidDrift = 0;
    this.wink = 0;
    this.particles = [];
    this.analyser = null;
    this.audioCtx = null;
    this.source = null;
    this._resizeObs = null;
    this._audioAttached = false;
    this.viewW = 360;
    this.viewH = 520;
  }

  async load() {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Portrait load failed"));
      img.src = this.imageSrc + (this.imageSrc.includes("?") ? "&" : "?") + "v=2";
    });
    this.image = img;
    this._resize();
    return this;
  }

  start() {
    if (this.raf) return;
    const tick = (now) => {
      this.t = now * 0.001;
      this._step();
      this._draw();
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
      console.warn("Live portrait audio:", err);
    }
  }

  async resumeAudio() {
    if (this.audioCtx?.state === "suspended") await this.audioCtx.resume();
  }

  setState(state = "idle") {
    this.state = state || "idle";
    const blushMap = {
      idle: 0.08, listen: 0.12, think: 0.05, speak: 0.15,
      flirt: 0.55, love: 0.45, excited: 0.35, help: 0.18, touch: 0.5, dream: 0.25,
    };
    this.targetBlush = blushMap[this.state] ?? 0.1;
    this.targetStateBlend = 1;
    if (state === "flirt" || state === "love" || state === "touch") {
      this.spawnParticles(state === "love" ? "heart" : "spark", 4 + Math.floor(Math.random() * 4));
    }
    if (state === "excited") this.spawnParticles("spark", 6);
  }

  setMood(mood) {
    this.mood = mood || "happy";
    if (["love", "happy"].includes(this.mood)) this.targetBlush = Math.max(this.targetBlush, 0.2);
  }

  setSpeaking(on) {
    this.speaking = !!on;
    if (on) this.setState("speak");
    else if (this.state === "speak") this.setState("idle");
    if (!on) this.targetMouth = 0;
  }

  setPointer(nx, ny) {
    this.targetEyeX = Math.max(-1, Math.min(1, nx));
    this.targetEyeY = Math.max(-1, Math.min(1, ny));
  }

  pulseTouch(strength = 1) {
    this.touchPulse = Math.min(1, this.touchPulse + 0.4 * strength);
    this.setState("touch");
    this.spawnParticles("heart", 2 + Math.floor(strength * 3));
    if (Math.random() < 0.35) {
      this.wink = 1;
      this.nextBlink = this.t + 2.5;
    }
  }

  setMouthLevel(v) {
    this.targetMouth = Math.max(0, Math.min(1, v));
  }

  nodOnce() {
    this.nod = 1;
  }

  orgasmPulse(level = 1, nodStrength = 0.5) {
    const lv = Math.max(1, Math.min(7, level));
    this.orgasmNod = Math.min(1, nodStrength);
    this.nod = Math.max(this.nod, this.orgasmNod);
    this.targetBlush = Math.min(1, this.targetBlush + 0.12 * lv);
    this.targetMouth = Math.min(1, this.targetMouth + 0.1 * lv);
    this.spawnParticles("spark", lv >= 6 ? 7 : 2 + Math.floor(lv * 0.5));
  }

  startLucidDrift() {
    this.lucidDrift = 1;
    this.orgasmNod = 0;
    this.setState("dream");
  }

  stopLucidDrift() {
    this.lucidDrift = 0;
    this.orgasmNod = 0;
    this.setState("idle");
  }

  spawnParticles(kind = "spark", count = 3) {
    const w = this.viewW || 360;
    const h = this.viewH || 520;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        kind,
        x: w * (0.35 + Math.random() * 0.3),
        y: h * (0.32 + Math.random() * 0.28),
        vx: (Math.random() - 0.5) * 1.8,
        vy: -0.6 - Math.random() * 1.4,
        life: 1,
        size: 4 + Math.random() * 8,
        rot: Math.random() * Math.PI,
      });
    }
  }

  observeResize() {
    if (this._resizeObs) return;
    this._resizeObs = new ResizeObserver(() => this._resize());
    if (this.canvas.parentElement) this._resizeObs.observe(this.canvas.parentElement);
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(280, Math.min(rect.width || 360, 520));
    const h = Math.max(380, Math.min(rect.height || 520, 720));
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = w;
    this.viewH = h;
  }

  _readAudioLevel() {
    if (!this.analyser || !this.speaking) return 0;
    const buf = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(buf);
    let sum = 0;
    const n = Math.min(24, buf.length);
    for (let i = 0; i < n; i++) sum += buf[i];
    return Math.min(1, (sum / n) / 110);
  }

  _step() {
    const audioLvl = this._readAudioLevel();
    if (this.speaking) {
      this.targetMouth = Math.max(this.targetMouth * 0.88, audioLvl);
      if (audioLvl > 0.2 && Math.random() < 0.04) this.nod = Math.max(this.nod, 0.6);
    }
    this.mouth += (this.targetMouth - this.mouth) * 0.3;
    if (!this.speaking) this.mouth *= 0.8;

    this.eyeX += (this.targetEyeX - this.eyeX) * 0.12;
    this.eyeY += (this.targetEyeY - this.eyeY) * 0.12;
    this.blush += (this.targetBlush - this.blush) * 0.06;
    if (this.state === "idle") this.targetBlush = 0.06 + Math.sin(this.t * 0.7) * 0.03;

    if (this.t >= this.nextBlink) {
      this.blink = 1;
      this.nextBlink = this.t + 2 + Math.random() * 4;
    }
    if (this.blink > 0) this.blink = Math.max(0, this.blink - 0.16);
    if (this.wink > 0) this.wink = Math.max(0, this.wink - 0.12);
    if (this.lucidDrift > 0) {
      this.lucidDrift = Math.max(0, this.lucidDrift - 0.0009);
      this.nod = Math.sin(this.t * 0.035) * 0.35 * this.lucidDrift;
      this.targetMouth = Math.max(0, this.targetMouth * 0.9 - 0.02);
      this.targetBlush = Math.max(0.04, this.targetBlush * 0.98);
    } else if (this.orgasmNod > 0) {
      this.nod = Math.max(this.nod, this.orgasmNod * (0.85 + Math.sin(this.t * 0.12) * 0.15));
      this.orgasmNod = Math.max(0, this.orgasmNod - 0.02);
    } else if (this.nod > 0) {
      this.nod = Math.max(0, this.nod - 0.045);
    }
    this.touchPulse *= 0.88;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02;
      p.life -= 0.018;
      p.rot += 0.04;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  _stateMotion() {
    const s = this.state;
    let breathe = 1 + Math.sin(this.t * 1.35) * 0.003;
    let sway = Math.sin(this.t * 0.55) * 0.002;
    let tilt = 0;
    let bob = Math.sin(this.t * 0.9) * 0.6;
    let scaleBoost = 1;

    if (s === "listen") {
      breathe += 0.006;
      bob += Math.sin(this.t * 2.2) * 1.5;
      tilt = Math.sin(this.t * 1.1) * 0.012;
    } else if (s === "think") {
      tilt = -0.025;
      this.targetEyeX = -0.25;
      this.targetEyeY = -0.2;
    } else if (s === "speak") {
      bob += this.nod * 6;
      sway += Math.sin(this.t * 3.5) * 0.004;
    } else if (s === "flirt" || s === "touch") {
      breathe += 0.014 + this.touchPulse * 0.02;
      tilt = Math.sin(this.t * 1.8) * 0.018;
      scaleBoost = 1 + this.touchPulse * 0.015;
    } else if (s === "love" || s === "dream") {
      breathe += 0.01;
      sway *= 1.4;
    } else if (s === "excited" || s === "help") {
      breathe += 0.012;
      bob += Math.sin(this.t * 2.8) * 3;
      scaleBoost = 1.012;
    }

    return { breathe: breathe * scaleBoost, sway, tilt, bob };
  }

  _draw() {
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    ctx.clearRect(0, 0, w, h);

    const { breathe, sway, tilt, bob } = this._stateMotion();
    const img = this.image;
    if (!img) return;

    const scale = Math.max(w / img.width, h / img.height) * breathe;
    const iw = img.width * scale;
    const ih = img.height * scale;
    const ix = (w - iw) / 2 + sway * w;
    const iy = (h - ih) / 2 + bob;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(tilt);
    ctx.translate(-w / 2, -h / 2);
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 32;
    ctx.drawImage(img, ix, iy, iw, ih);
    ctx.restore();

    const ex = this.eyeX * w * 0.018;
    const ey = this.eyeY * h * 0.012;
    if (Math.abs(ex) > 0.5 || Math.abs(ey) > 0.5) {
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = `rgba(255, 220, 200, ${0.08 + Math.abs(this.eyeX) * 0.06})`;
      const shiftX = w * 0.5 + ex;
      const shiftY = h * 0.38 + ey;
      ctx.beginPath();
      ctx.ellipse(shiftX - w * 0.12, shiftY, w * 0.08, h * 0.04, 0, 0, Math.PI * 2);
      ctx.ellipse(shiftX + w * 0.12, shiftY, w * 0.08, h * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.blush > 0.04) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      const a = this.blush * 0.55;
      ctx.fillStyle = `rgba(220, 80, 110, ${a})`;
      ctx.beginPath();
      ctx.ellipse(w * 0.34, h * 0.44, w * 0.09, h * 0.05, 0, 0, Math.PI * 2);
      ctx.ellipse(w * 0.66, h * 0.44, w * 0.09, h * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const mouthY = h * 0.56;
    const mouthX = w * 0.5;
    const open = this.mouth;
    if (open > 0.03) {
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = `rgba(180, 70, 90, ${0.18 + open * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(mouthX, mouthY, 10 + open * 16, 4 + open * 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (this.state === "flirt" || this.mood === "love") {
      ctx.save();
      ctx.strokeStyle = `rgba(200, 90, 120, ${0.25 + this.blush * 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mouthX, mouthY + 2, 8, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    const eyeY = h * 0.39 + ey;
    const blinkAmt = Math.max(this.blink, this.wink * 0.85);
    if (blinkAmt > 0) {
      ctx.fillStyle = `rgba(12, 8, 18, ${0.5 + blinkAmt * 0.45})`;
      const leftH = 6 + blinkAmt * (this.wink > 0.5 ? 22 : 18);
      const rightH = 6 + blinkAmt * 18;
      ctx.beginPath();
      ctx.ellipse(w * 0.38 + ex, eyeY, w * 0.09, leftH, 0, 0, Math.PI * 2);
      ctx.ellipse(w * 0.62 + ex, eyeY, w * 0.09, this.wink > 0.5 ? 6 : rightH, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.life * 0.85;
      if (p.kind === "heart") {
        ctx.fillStyle = "#fb7185";
        ctx.font = `${p.size + 6}px serif`;
        ctx.fillText("♥", -4, 4);
      } else {
        ctx.fillStyle = "#e9d5ff";
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const glow = ctx.createRadialGradient(w * 0.5, h * 0.42, h * 0.1, w * 0.5, h * 0.45, h * 0.75);
    const glowColor = this.state === "flirt" || this.state === "touch"
      ? "rgba(251,113,133,0.12)" : this.state === "listen"
        ? "rgba(107,140,255,0.1)" : "rgba(0,0,0,0)";
    glow.addColorStop(0, glowColor);
    glow.addColorStop(1, "rgba(8,6,14,0.4)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }
}