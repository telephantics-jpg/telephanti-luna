/**
 * Luna microphone — continuous listen + speech-to-text.
 * Desktop Chrome/Edge: Web Speech API (no server ffmpeg).
 * Mobile / fallback: VAD + MediaRecorder + /api/transcribe-file (WAV upload).
 */

function speechRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function isMobileUa() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function shouldUseWebSpeech() {
  if (!speechRecognitionCtor()) return false;
  if (isMobileUa()) return false;
  return true;
}

export function createLunaMic(opts) {
  if (shouldUseWebSpeech()) return new LunaWebSpeechMic(opts);
  return new LunaMic(opts);
}

export class LunaWebSpeechMic {
  constructor(opts) {
    this.onText = opts.onText;
    this.onStatus = opts.onStatus || (() => {});
    this.onError = opts.onError || (() => {});
    this.onLevel = opts.onLevel || (() => {});
    this.enabled = false;
    this.paused = false;
    this.busy = false;
    this.mode = "webspeech";
    this.unlocked = false;
    this.stream = null;
    this.recognition = null;
    this.restartTimer = null;
    this.monitorTimer = null;
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.timeData = null;
    this._starting = false;
    this._lastFinalAt = 0;
  }

  resetForRetry() {
    this._stopRecognition();
    this._stopLevelMonitor();
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.unlocked = false;
    this.enabled = false;
  }

  applySensitivity() {
    /* Web Speech API handles VAD internally */
  }

  setBusy(busy) {
    this.busy = !!busy;
    if (this.busy) this._stopRecognition();
    else if (this.enabled && !this.paused) this._startRecognition();
  }

  setPaused(paused) {
    this.paused = !!paused;
    if (this.paused) this._stopRecognition();
    else if (this.enabled && !this.busy) this._startRecognition();
  }

  async unlock() {
    const SR = speechRecognitionCtor();
    if (!SR) {
      this.onError("Speech recognition not supported — use Chrome or Edge.");
      return false;
    }
    try {
      if (!this.stream?.active && navigator.mediaDevices?.getUserMedia) {
        const constraints = [
          { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } },
          { audio: true },
        ];
        let lastErr = null;
        for (const audio of constraints) {
          try {
            this.stream = await navigator.mediaDevices.getUserMedia(audio);
            break;
          } catch (err) {
            lastErr = err;
            if (this.stream) {
              this.stream.getTracks().forEach((t) => t.stop());
              this.stream = null;
            }
          }
        }
        if (!this.stream?.active) throw lastErr || new Error("Microphone blocked");
        await this._ensureAnalyser();
        this._startLevelMonitor();
      }
      this._buildRecognition(SR);
      this.unlocked = true;
      this.mode = "webspeech";
      return true;
    } catch (err) {
      console.warn("LunaWebSpeechMic unlock:", err);
      this.onError("Allow microphone access — click 🎤 then Allow in the popup.");
      return false;
    }
  }

  _buildRecognition(SR) {
    if (this.recognition) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = (navigator.language || "en-US").replace("_", "-");
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const chunk = (result[0]?.transcript || "").trim();
        if (!chunk) continue;
        if (result.isFinal) finalText += (finalText ? " " : "") + chunk;
        else interim = chunk;
      }
      if (interim) this.onLevel(0.045, 0.07, true);
      if (finalText.length >= 2) {
        const now = Date.now();
        if (now - this._lastFinalAt < 400) return;
        this._lastFinalAt = now;
        this.onStatus("hearing...");
        this.onText(finalText);
      }
    };

    rec.onerror = (event) => {
      const code = event.error || "";
      if (code === "no-speech" || code === "aborted") return;
      if (code === "not-allowed" || code === "service-not-allowed") {
        this.unlocked = false;
        this.onError("Microphone blocked — click 🎤 and Allow access.");
        return;
      }
      if (code === "network") {
        this.onError("Speech network error — check your connection.");
        return;
      }
      console.warn("LunaWebSpeechMic:", code);
    };

    rec.onend = () => {
      this._starting = false;
      if (this.enabled && !this.paused && !this.busy) {
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => this._startRecognition(), 120);
      }
    };

    rec.onstart = () => {
      this._starting = false;
      this.onStatus("listening");
    };

    this.recognition = rec;
  }

  async _ensureAnalyser() {
    if (this.analyser && this.audioCtx?.state === "running") return;
    if (this.audioCtx?.state === "suspended") {
      await this.audioCtx.resume();
      return;
    }
    this._teardownAnalyser();
    this.audioCtx = new AudioContext({ latencyHint: "interactive" });
    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.1;
    this.source.connect(this.analyser);
    this.timeData = new Float32Array(this.analyser.fftSize);
    if (this.audioCtx.state === "suspended") await this.audioCtx.resume();
  }

  _teardownAnalyser() {
    clearInterval(this.monitorTimer);
    this.monitorTimer = null;
    try { this.source?.disconnect(); } catch { /* ignore */ }
    this.source = null;
    this.analyser = null;
    this.timeData = null;
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  _sampleLevels() {
    if (!this.analyser || !this.timeData) return { rms: 0, peak: 0 };
    this.analyser.getFloatTimeDomainData(this.timeData);
    let peak = 0;
    let sumSq = 0;
    const len = this.timeData.length;
    for (let i = 0; i < len; i++) {
      const a = Math.abs(this.timeData[i]);
      if (a > peak) peak = a;
      sumSq += this.timeData[i] * this.timeData[i];
    }
    return { rms: Math.sqrt(sumSq / len), peak };
  }

  _startLevelMonitor() {
    clearInterval(this.monitorTimer);
    this.monitorTimer = setInterval(() => {
      if (!this.enabled || this.paused || this.busy) return;
      const { rms, peak } = this._sampleLevels();
      const speaking = peak >= 0.008 || rms >= 0.003;
      this.onLevel(rms, peak, speaking);
    }, 40);
  }

  _stopLevelMonitor() {
    clearInterval(this.monitorTimer);
    this.monitorTimer = null;
    this._teardownAnalyser();
  }

  _startRecognition() {
    if (!this.recognition || this._starting || this.paused || this.busy || !this.enabled) return;
    this._starting = true;
    try {
      this.recognition.start();
      this.onStatus("listening");
    } catch (err) {
      this._starting = false;
      if (String(err?.message || err).includes("already started")) return;
      console.warn("LunaWebSpeechMic start:", err);
    }
  }

  _stopRecognition() {
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
    this._starting = false;
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch { /* ignore */ }
  }

  async setEnabled(on) {
    this.enabled = !!on;
    if (!this.enabled) {
      this._stopRecognition();
      this._stopLevelMonitor();
      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop());
        this.stream = null;
      }
      this.onStatus("mic off");
      return;
    }
    if (!this.unlocked) {
      const ok = await this.unlock();
      if (!ok) {
        this.enabled = false;
        return;
      }
    }
    if (!this.busy && !this.paused) {
      this._startLevelMonitor();
      this._startRecognition();
    }
  }

  stop() {
    this.enabled = false;
    this._stopRecognition();
    this._stopLevelMonitor();
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.unlocked = false;
    this.onStatus("mic off");
  }
}

export class LunaMic {
  constructor(opts) {
    this.onText = opts.onText;
    this.onStatus = opts.onStatus || (() => {});
    this.onError = opts.onError || (() => {});
    this.onLevel = opts.onLevel || (() => {});
    this.enabled = false;
    this.paused = false;
    this.busy = false;
    this.mode = "none";
    this.stream = null;
    this.recorder = null;
    this.monitorTimer = null;
    this.stopTimer = null;
    this.unlocked = false;
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.timeData = null;
    this._trackEndedBound = false;

    this.minSpeechRms = 0.0032;
    this.minSpeechPeak = 0.009;
    this.silenceRms = 0.0018;
    this.silenceHoldMs = 280;
    this.maxRecordMs = 14000;
    this.minRecordMs = 180;
    this.monitorIntervalMs = 36;
    this.warmupMs = 60;
  }

  _isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  _pickMime() {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/aac",
    ];
    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    }
    return "";
  }

  resetForRetry() {
    this._stopMonitor();
    this._stopRecording();
    this._teardownAnalyser();
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this._trackEndedBound = false;
    this.unlocked = false;
    this.enabled = false;
  }

  _bindTrackLifecycle() {
    if (this._trackEndedBound || !this.stream) return;
    this._trackEndedBound = true;
    for (const track of this.stream.getTracks()) {
      track.addEventListener("ended", () => {
        this.unlocked = false;
        this.onStatus("mic-retry");
        if (this.enabled && !this.busy) {
          this.unlock().then((ok) => {
            if (ok && !this.paused && !this.busy) this._startMonitor();
          });
        }
      });
    }
  }

  async unlock() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.onError("Microphone not supported in this browser.");
      return false;
    }
    const constraints = [
      {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      },
      { audio: true },
    ];
    let lastErr = null;
    for (const audio of constraints) {
      try {
        if (!this.stream?.active) {
          if (this.stream) {
            this.stream.getTracks().forEach((t) => t.stop());
            this.stream = null;
          }
          this.stream = await navigator.mediaDevices.getUserMedia(audio);
          this._trackEndedBound = false;
        }
        await this._ensureAnalyser();
        this._bindTrackLifecycle();
        this.unlocked = true;
        this.mode = "browser";
        return true;
      } catch (err) {
        lastErr = err;
        if (this.stream) {
          this.stream.getTracks().forEach((t) => t.stop());
          this.stream = null;
        }
        this._trackEndedBound = false;
      }
    }
    console.warn("LunaMic unlock:", lastErr);
    this.onError("Allow microphone access — tap 🎤 then Allow in the popup.");
    return false;
  }

  async _ensureAnalyser() {
    if (this.analyser && this.audioCtx?.state === "running") return;
    if (this.audioCtx?.state === "suspended") {
      await this.audioCtx.resume();
      return;
    }
    this._teardownAnalyser();
    this.audioCtx = new AudioContext({ latencyHint: "interactive" });
    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.08;
    this.source.connect(this.analyser);
    this.timeData = new Float32Array(this.analyser.fftSize);
    if (this.audioCtx.state === "suspended") await this.audioCtx.resume();
  }

  _teardownAnalyser() {
    clearInterval(this.monitorTimer);
    this.monitorTimer = null;
    try { this.source?.disconnect(); } catch { /* ignore */ }
    this.source = null;
    this.analyser = null;
    this.timeData = null;
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  setBusy(busy) {
    this.busy = !!busy;
    if (this.busy) this._stopRecording();
  }

  setPaused(paused) {
    this.paused = !!paused;
    if (this.paused) this._stopMonitor();
    else if (this.enabled && !this.busy) this._startMonitor();
  }

  applySensitivity(sensitivity = 52, { desktop = false } = {}) {
    const s = Math.max(0, Math.min(100, Number(sensitivity) || 52));
    const gain = 0.55 + s / 100;
    this.minSpeechRms = 0.0052 / gain;
    this.minSpeechPeak = 0.014 / gain;
    this.silenceHoldMs = 190 + Math.round(s * 1.35);
    this.minRecordMs = 140 + Math.round(s * 0.7);
    this.maxRecordMs = 12000 + Math.round(s * 35);
    if (desktop) {
      this.minSpeechRms *= 0.62;
      this.minSpeechPeak *= 0.62;
      this.silenceHoldMs += 140;
      this.minRecordMs = Math.max(120, this.minRecordMs - 30);
    }
  }

  async setEnabled(on) {
    this.enabled = !!on;
    if (!this.enabled) {
      this._stopAll();
      this.onStatus("mic off");
      return;
    }
    if (!this.unlocked) {
      const ok = await this.unlock();
      if (!ok) {
        this.enabled = false;
        return;
      }
    }
    if (!this.busy && !this.paused) await this._startMonitor();
  }

  stop() {
    this._stopAll();
    this.onStatus("mic off");
  }

  _stopAll() {
    this._stopMonitor();
    this._stopRecording();
    this._teardownAnalyser();
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this._trackEndedBound = false;
    this.unlocked = false;
  }

  _stopMonitor() {
    clearInterval(this.monitorTimer);
    this.monitorTimer = null;
  }

  _stopRecording() {
    clearTimeout(this.stopTimer);
    this.stopTimer = null;
    if (this.recorder && this.recorder.state !== "inactive") {
      try { this.recorder.stop(); } catch { /* ignore */ }
    }
  }

  _sampleLevels() {
    if (!this.analyser || !this.timeData) return { rms: 0, peak: 0 };
    this.analyser.getFloatTimeDomainData(this.timeData);
    let peak = 0;
    let sumSq = 0;
    const len = this.timeData.length;
    for (let i = 0; i < len; i++) {
      const a = Math.abs(this.timeData[i]);
      if (a > peak) peak = a;
      sumSq += this.timeData[i] * this.timeData[i];
    }
    return { rms: Math.sqrt(sumSq / len), peak };
  }

  async _startMonitor() {
    if (!this.enabled || this.paused || this.busy) return;
    if (!this.unlocked || !this.stream?.active) {
      const ok = await this.unlock();
      if (!ok) return;
    }
    this.mode = "browser";
    this.onStatus("listening");
    this._stopMonitor();

    let recording = false;
    let recordStarted = 0;
    let lastSpeechAt = 0;
    let hadSpeechDuringRecord = false;
    let warmupUntil = Date.now() + this.warmupMs;
    let chunks = [];
    let mime = "";

    const beginRecord = () => {
      if (recording || !this.stream?.active) return;
      mime = this._pickMime();
      try {
        this.recorder = mime
          ? new MediaRecorder(this.stream, { mimeType: mime, audioBitsPerSecond: 128000 })
          : new MediaRecorder(this.stream);
      } catch (err) {
        this.onError("Mic recorder failed — " + (err.message || "try again"));
        return;
      }
      chunks = [];
      recording = true;
      recordStarted = Date.now();
      lastSpeechAt = recordStarted;
      hadSpeechDuringRecord = false;

      this.recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunks.push(e.data);
      };

      this.recorder.onstop = async () => {
        recording = false;
        const blob = new Blob(chunks, { type: this.recorder?.mimeType || mime || "audio/webm" });
        this.recorder = null;
        chunks = [];

        if (!blob.size || blob.size < 200 || this.busy || this.paused) {
          if (this.enabled && !this.paused && !this.busy) this.onStatus("listening");
          return;
        }

        if (hadSpeechDuringRecord || blob.size > 700) {
          this.onStatus("hearing...");
          await this._transcribeBlob(blob);
        } else {
          this.onStatus("no-speech");
        }
        if (this.enabled && !this.paused && !this.busy) this.onStatus("listening");
      };

      try {
        this.recorder.start(80);
      } catch {
        recording = false;
        this.recorder = null;
        this.onError("Could not start microphone recording.");
      }
    };

    const endRecord = () => {
      if (!recording || !this.recorder) return;
      const elapsed = Date.now() - recordStarted;
      if (elapsed < this.minRecordMs) return;
      try {
        if (this.recorder.state === "recording") this.recorder.stop();
      } catch { /* ignore */ }
    };

    this.monitorTimer = setInterval(() => {
      if (!this.enabled || this.paused || this.busy) return;
      if (!this.stream?.active) {
        this.onStatus("mic-retry");
        return;
      }

      const now = Date.now();
      if (now < warmupUntil) return;

      const { rms, peak } = this._sampleLevels();
      const speaking =
        peak >= this.minSpeechPeak ||
        rms >= this.minSpeechRms;

      this.onLevel(rms, peak, speaking);

      if (speaking) {
        lastSpeechAt = now;
        hadSpeechDuringRecord = true;
        if (!recording) beginRecord();
        clearTimeout(this.stopTimer);
        const elapsed = recording ? now - recordStarted : 0;
        const hold = elapsed < 2200
          ? Math.round(this.silenceHoldMs * 1.45)
          : this.silenceHoldMs;
        this.stopTimer = setTimeout(endRecord, hold);
      } else if (recording) {
        const silentFor = now - lastSpeechAt;
        const elapsed = now - recordStarted;
        const hold = elapsed < 2200
          ? Math.round(this.silenceHoldMs * 1.45)
          : this.silenceHoldMs;
        if (silentFor >= hold) endRecord();
      }

      if (recording && now - recordStarted >= this.maxRecordMs) endRecord();
    }, this.monitorIntervalMs);
  }

  async _blobToWav(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const ctx = new AudioContext();
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const samples = audioBuffer.getChannelData(0);
      const rate = audioBuffer.sampleRate;
      const int16 = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      const dataLen = int16.length * 2;
      const buffer = new ArrayBuffer(44 + dataLen);
      const view = new DataView(buffer);
      const writeStr = (offset, str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      };
      writeStr(0, "RIFF");
      view.setUint32(4, 36 + dataLen, true);
      writeStr(8, "WAVE");
      writeStr(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, rate, true);
      view.setUint32(28, rate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, "data");
      view.setUint32(40, dataLen, true);
      new Uint8Array(buffer, 44).set(new Uint8Array(int16.buffer));
      return new Blob([buffer], { type: "audio/wav" });
    } finally {
      ctx.close().catch(() => {});
    }
  }

  async _prepareUploadBlob(blob) {
    try {
      return { blob: await this._blobToWav(blob), name: "luna.wav" };
    } catch (err) {
      console.warn("LunaMic wav convert:", err);
      const name = blob.type.includes("mp4") ? "luna.mp4" : "luna.webm";
      return { blob, name };
    }
  }

  async _transcribeBlob(blob) {
    try {
      const { blob: upload, name } = await this._prepareUploadBlob(blob);
      const form = new FormData();
      form.append("file", upload, name);
      const res = await fetch("/api/transcribe-file", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail || `Transcribe failed (${res.status})`;
        if (String(detail).toLowerCase().includes("ffmpeg")) {
          this.onError("Voice server missing ffmpeg — refresh and try again.");
        } else {
          this.onError(detail);
        }
        this.onStatus("transcribe-error");
        return;
      }
      const text = (data.text || "").trim();
      if (text.length >= 2) {
        this.onText(text);
      } else {
        this.onStatus("no-speech");
      }
    } catch (err) {
      console.warn("LunaMic:", err);
      this.onError(err.message || "Could not reach speech service.");
      this.onStatus("transcribe-error");
    }
  }
}