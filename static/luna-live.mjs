/**
 * Live portrait renderer — photorealistic Luna with breathe, blink, and lip-sync.
 */
export class LiveLunaPortrait {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.imageSrc = options.imageSrc || "/static/avatars/luna-portrait.jpg";
    this.image = null;
    this.raf = 0;
    this.t = 0;
    this.mouth = 0;
    this.targetMouth = 0;
    this.blink = 0;
    this.nextBlink = 2.4 + Math.random() * 2;
    this.touchPulse = 0;
    this.speaking = false;
    this.analyser = null;
    this.audioCtx = null;
    this.source = null;
    this._resizeObs = null;
  }

  async load() {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Portrait load failed"));
      img.src = this.imageSrc + (this.imageSrc.includes("?") ? "&" : "?") + "v=1";
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

  setSpeaking(on) {
    this.speaking = !!on;
    if (!on) this.targetMouth = 0;
  }

  pulseTouch(strength = 1) {
    this.touchPulse = Math.min(1, this.touchPulse + 0.35 * strength);
  }

  setMouthLevel(v) {
    this.targetMouth = Math.max(0, Math.min(1, v));
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

  observeResize() {
    if (this._resizeObs) return;
    this._resizeObs = new ResizeObserver(() => this._resize());
    if (this.canvas.parentElement) this._resizeObs.observe(this.canvas.parentElement);
    window.addEventListener("resize", () => this._resize());
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
      this.targetMouth = Math.max(this.targetMouth * 0.9, audioLvl);
    }
    this.mouth += (this.targetMouth - this.mouth) * 0.28;
    if (!this.speaking) this.mouth *= 0.82;

    if (this.t >= this.nextBlink) {
      this.blink = 1;
      this.nextBlink = this.t + 2.2 + Math.random() * 3.5;
    }
    if (this.blink > 0) {
      this.blink = Math.max(0, this.blink - 0.14);
    }

    this.touchPulse *= 0.9;
  }

  _draw() {
    const ctx = this.ctx;
    const w = this.viewW || 360;
    const h = this.viewH || 520;
    ctx.clearRect(0, 0, w, h);

    const breathe = 1 + Math.sin(this.t * 1.35) * 0.008 + this.touchPulse * 0.012;
    const sway = Math.sin(this.t * 0.55) * 0.006;
    const img = this.image;
    if (!img) return;

    const scale = Math.max(w / img.width, h / img.height) * breathe;
    const iw = img.width * scale;
    const ih = img.height * scale;
    const ix = (w - iw) / 2 + sway * w;
    const iy = (h - ih) / 2 + Math.sin(this.t * 0.9) * 2;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 28;
    ctx.drawImage(img, ix, iy, iw, ih);
    ctx.restore();

    const mouthY = h * 0.56;
    const mouthX = w * 0.5;
    const open = this.mouth;
    if (open > 0.04) {
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = `rgba(180, 70, 90, ${0.15 + open * 0.35})`;
      ctx.beginPath();
      ctx.ellipse(mouthX, mouthY, 10 + open * 14, 4 + open * 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.blink > 0) {
      const eyeY = h * 0.39;
      const eyeW = w * 0.09;
      const eyeH = 8 + this.blink * 18;
      ctx.fillStyle = `rgba(12, 8, 18, ${0.55 + this.blink * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(w * 0.38, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
      ctx.ellipse(w * 0.62, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const vignette = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.2, w * 0.5, h * 0.5, h * 0.72);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(8,6,14,0.35)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }
}