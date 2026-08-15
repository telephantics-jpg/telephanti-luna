    // Static imports only for boot-critical deps — dynamic import() + timeouts
    // were false-failing (files serve in <100ms; import() still hit 14–20s races).
    import * as THREE from "three";
    import { OrbitControls } from "three/addons/controls/OrbitControls.js";
    import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
    import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
    import * as campWorld from "camp-world";
    import * as campClient from "camp-client";
    import * as campFeatures from "camp-features";
    import * as campChars from "camp-characters";
    import * as campProps from "camp-props";

    const BUILD = "2026-08-15-talk-thread";
    /** Talk-to-everyone id — must exist before first refreshWhoSelect() */
    const TALK_ALL_ID = "__all__";
    const statusEl = document.getElementById("status");
    const bootErr = document.getElementById("boot-error");
    const bootOverlay = document.getElementById("boot-overlay");
    const bootStepEl = document.getElementById("boot-step");
    let bootFinished = false;
    // let (not const) — initialized early so no TDZ "Cannot access before initialization"
    let chat3dPanel = null;
    let chat3dThread = null;
    let chat3dWho = null;
    let chat3dInput = null;
    let chat3dSend = null;
    let chat3dMetaEth = null;
    const chat3dLines = [];
    const CHAT3D_MAX = 48;
    function bindChat3dDom() {
      chat3dPanel = document.getElementById("chat3d-panel");
      chat3dThread = document.getElementById("chat3d-thread");
      chat3dWho = document.getElementById("chat3d-who");
      chat3dInput = document.getElementById("chat3d-input");
      chat3dSend = document.getElementById("chat3d-send");
      chat3dMetaEth = document.getElementById("chat3d-ethereal");
    }
    bindChat3dDom();
    function setBootStep(msg) {
      const t = String(msg || "");
      if (statusEl) {
        // Keep activity text off-screen (user asked to hide “what you’re doing” bar)
        statusEl.hidden = true;
        statusEl.textContent = t;
      }
      if (bootStepEl) bootStepEl.textContent = t;
      console.info("[camp3d]", t);
    }
    function finishBoot(ok = true) {
      // Allow success to override a prior fail / stuck "loading" card
      if (bootFinished && ok && bootOverlay?.classList.contains("done")) return;
      if (ok) bootFinished = true;
      else if (!bootFinished) bootFinished = true;
      if (bootOverlay) {
        if (ok) {
          bootOverlay.classList.add("done");
          bootOverlay.classList.remove("fail");
          // Force hide even if CSS transition glitches
          bootOverlay.style.opacity = "0";
          bootOverlay.style.visibility = "hidden";
          bootOverlay.style.pointerEvents = "none";
          bootOverlay.style.display = "none";
          try {
            bootOverlay.setAttribute("aria-hidden", "true");
          } catch (_) {}
        } else {
          bootOverlay.classList.remove("done");
          bootOverlay.classList.add("fail");
          bootOverlay.style.opacity = "";
          bootOverlay.style.visibility = "";
          bootOverlay.style.display = "";
        }
      }
      if (ok && statusEl) {
        statusEl.hidden = true;
        statusEl.textContent = "Free Ollama meadow";
      }
      if (ok) console.info("[camp3d] boot cleared — meadow playable");
    }
    // Local free town URL (not telephanti.com / not https)
    function localTownUrl() {
      try {
        const u = new URL(location.href);
        // Prefer whatever port this page was served from
        if (u.hostname === "127.0.0.1" || u.hostname === "localhost") {
          return `${u.protocol}//${u.host}/firmament/3d`;
        }
      } catch (_) {}
      return "http://127.0.0.1:8767/firmament/3d";
    }
    const LOCAL_TOWN = localTownUrl();

    // Never leave user staring at boot forever (server drop / hung import / no WebGL)
    async function forceBootClear(reason) {
      if (bootFinished) return;
      const hasCanvas = !!document.querySelector("#canvas-host canvas");
      if (hasCanvas) {
        setBootStep(reason || "Meadow ready");
        finishBoot(true);
        return;
      }
      const isLast = reason && String(reason).includes("last-resort");
      // Probe local health before blaming Three.js
      let healthOk = false;
      let ollamaOk = false;
      try {
        const hr = await fetch("/api/health", { cache: "no-store" });
        if (hr.ok) {
          const h = await hr.json();
          healthOk = !!h.ok;
          ollamaOk = !!h.ollama_ok;
        }
      } catch (_) {
        healthOk = false;
      }
      if (healthOk && !isLast) {
        // Soft nudge only once — never soft-loop forever without a canvas
        setBootStep(
          ollamaOk
            ? "Server OK · free Ollama — still painting WebGL…"
            : "Server OK · still painting WebGL…",
        );
        return;
      }
      if (healthOk && isLast) {
        showBootError(
          "Server is up but WebGL meadow never painted. Try Ctrl+Shift+R, disable extensions, or another browser. " +
            LOCAL_TOWN,
        );
        finishBoot(false);
        return;
      }
      showBootError(
        "Can't reach the local Luna town server. " +
          "Double-click START_TOWN_LOCAL.bat (keep the black window open), then open " +
          LOCAL_TOWN +
          " — use http not https. Free Ollama only works on local, not telephanti.com.",
      );
      finishBoot(false);
    }
    // Poll: as soon as canvas exists, kill the boot card (don't wait for GLB finish)
    const bootPoll = setInterval(() => {
      if (bootFinished) {
        clearInterval(bootPoll);
        return;
      }
      if (document.querySelector("#canvas-host canvas")) {
        setBootStep("Meadow is up");
        finishBoot(true);
        clearInterval(bootPoll);
      }
    }, 250);
    setTimeout(() => {
      if (bootFinished) return;
      if (document.querySelector("#canvas-host canvas")) {
        finishBoot(true);
      } else {
        setBootStep("Still loading meadow… (server should be on :8767)");
      }
    }, 5000);
    // Hard deadlines — health OK must not leave the card up forever
    setTimeout(() => forceBootClear("Taking a bit — waiting on WebGL…"), 10000);
    setTimeout(() => {
      if (bootFinished) return;
      if (document.querySelector("#canvas-host canvas")) finishBoot(true);
      else forceBootClear("last-resort");
    }, 16000);
    // Surface silent module errors on the boot card
    window.addEventListener("unhandledrejection", (ev) => {
      if (bootFinished) return;
      const msg = ev?.reason?.message || String(ev?.reason || "unknown");
      console.error("[camp3d] unhandledrejection", ev?.reason);
      if (/fetch|network|failed to fetch|load/i.test(msg)) {
        showBootError(msg);
      }
    });
    function showBootError(msg) {
      // Never re-cover a playable meadow with a red fail card
      if (bootFinished && document.querySelector("#canvas-host canvas")) {
        console.error("[camp3d] post-boot error (meadow already up)", msg);
        try {
          showToast?.("Camp module warning — meadow still playable");
        } catch (_) {}
        return;
      }
      console.error(msg);
      const text = String(msg && msg.message ? msg.message : msg);
      setBootStep("3D failed — see message");
      if (bootOverlay) {
        bootOverlay.classList.add("fail");
        bootOverlay.classList.remove("done");
        if (bootStepEl) {
          bootStepEl.innerHTML =
            `<b>Local camp didn't start</b><br>${text.replace(/</g, "&lt;")}` +
            `<br><br><b>Free Ollama path (what you want):</b>` +
            `<br>1) Run <code>START_TOWN_LOCAL.bat</code> — leave black window open` +
            `<br>2) Open <code>${LOCAL_TOWN}</code> (http only)` +
            `<br>3) Ctrl+Shift+R hard refresh` +
            `<br>4) Not telephanti.com — live has no free Ollama`;
        }
      }
      if (statusEl) {
        statusEl.hidden = true;
        statusEl.textContent = "3D failed — local server?";
      }
      if (bootErr) {
        bootErr.hidden = false;
        bootErr.innerHTML =
          `<b>Three.js camp failed to start</b><br>${text.replace(/</g, "&lt;")}` +
          `<br><br>Free brains = <b>local Ollama</b> via <code>${LOCAL_TOWN}</code>` +
          `<br>Keep START_TOWN_LOCAL.bat open · Ctrl+Shift+R · http not https.`;
      }
    }

    // All boot-critical modules already loaded via static import above
    let charSystem = null;
    let propSystem = null;
    // Prefer progressive boot canvas (firmament-three-boot.mjs) — no second WebGL context
    let renderer = (typeof window !== "undefined" && window.__LUNA_THREE_BOOT__ && window.__LUNA_THREE_BOOT__.renderer) || null;
    try {
      if (!THREE || !THREE.WebGLRenderer) {
        throw new Error("Three.js loaded but WebGLRenderer missing");
      }
      // ── Canvas first ── clear boot card before catalog / agents
      {
        const hostEarly = document.getElementById("canvas-host");
        if (!hostEarly) throw new Error("#canvas-host missing from page");
        if (renderer && renderer.domElement && !renderer.domElement.isConnected) {
          hostEarly.appendChild(renderer.domElement);
        }
        if (!renderer) {
          setBootStep("Starting WebGL meadow…");
          try {
            renderer = new THREE.WebGLRenderer({
              antialias: true,
              powerPreference: "high-performance",
              alpha: false,
              failIfMajorPerformanceCaveat: false,
            });
          } catch (err) {
            showBootError(
              "WebGL failed to start (GPU/driver). Try Chrome, update graphics drivers. " +
                String(err && err.message ? err.message : err),
            );
            throw err;
          }
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
          renderer.setSize(window.innerWidth, window.innerHeight);
          renderer.setClearColor(0x0a1230, 1);
          if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = THREE.PCFSoftShadowMap;
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.28;
          hostEarly.appendChild(renderer.domElement);
        }
        setBootStep("Meadow canvas ready — placing camp…");
        try {
          finishBoot(true);
        } catch (_) {}
      }

      setBootStep("Wiring camp systems…");
      try {
        charSystem = campChars.createCharacterSystem(THREE, GLTFLoader, SkeletonUtils);
      } catch (e) {
        console.warn("[camp3d] character system failed", e);
        charSystem = null;
      }
      try {
        propSystem = campProps.createPropSystem(THREE, GLTFLoader);
      } catch (e) {
        console.warn("[camp3d] prop system failed", e);
        propSystem = null;
      }
      setBootStep("Loading world catalog…");
    } catch (err) {
      showBootError(err);
      throw err;
    }

    const stampEl = document.getElementById("stamp");
    const whoEl = document.getElementById("who-select");
    const msgEl = document.getElementById("msg");
    const sendBtn = document.getElementById("send");
    const toastEl = document.getElementById("prop-toast");
    const speechLayer = document.getElementById("speech-layer");
    // Define early — boot used to toast before this existed (optional-chain no-op or stale wording)
    function showToast(msg) {
      if (!toastEl) return;
      toastEl.textContent = String(msg || "");
      toastEl.classList.add("show");
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => toastEl.classList.remove("show"), 3200);
    }
    // 3D camp: no scrolling chat log UI — only world speech bubbles + toast
    let bubbleFrontZ = 220;

    const isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
    if (stampEl) {
      stampEl.textContent = isLocal ? `✦ SANDBOX 3D · ${BUILD}` : `✦ 3D THREE · ${BUILD}`;
      stampEl.style.borderColor = isLocal ? "#38bdf8" : "rgba(56,189,248,0.45)";
    }

    // ── Shared world catalog (architecture layer B) ──
    let catalog;
    let catalogSource = "unknown";
    try {
      catalog = await Promise.race([
        campWorld.fetchCampCatalog(),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error("catalog timeout")), 6000),
        ),
      ]);
      catalogSource = catalog._source || "loaded";
    } catch (err) {
      console.warn("catalog load failed, embedded fallback", err);
      catalog = campWorld.fallbackCatalog();
      catalogSource = "embedded";
    }
    // Safety: never boot with <5 props
    if (!(catalog.props && catalog.props.length >= 5)) {
      const fb = campWorld.fallbackCatalog();
      catalog = { ...fb, ...catalog, props: fb.props, furniture: fb.furniture || catalog.furniture };
      catalogSource = (catalogSource || "") + "+propsfix";
    }
    console.info("[camp3d] catalog", catalogSource, "props", (catalog.props || []).length, "agents", (catalog.agents || []).length, "furniture", (catalog.furniture || []).length);

    const SCALE = campWorld.threeScale(catalog);
    const PROPS = (catalog.props || []).map((p) => ({
      id: p.id,
      name: p.name || p.id,
      emoji: p.emoji || "✦",
      x: p.x ?? 0,
      y: p.y ?? 0,
      color: campWorld.parseColorNumber(p.visual?.primary, 0x888888),
      use: p.use || `You use ${p.name || p.id}.`,
      visual: p.visual || {},
      feature: p.feature || "",
    }));
    const HOUSES = (catalog.houses || []).map((h) => ({
      id: h.owner_id || h.id,
      catalogId: h.id,
      name: h.name || h.id,
      emoji: h.emoji || "🏠",
      x: h.x ?? 0,
      y: h.y ?? 0,
      wall: campWorld.parseColorNumber(h.visual?.primary, 0x555555),
      roof: campWorld.parseColorNumber(h.visual?.roof || h.visual?.accent, 0x333333),
      castle: !!h.castle || h.visual?.kit === "mead_hall",
      visual: h.visual || {},
    }));
    const LANDMARKS = (catalog.landmarks || []).filter((l) => l.id !== "campfire").map((l) => ({
      id: l.id,
      type: l.type || "landmark",
      name: l.name || l.id,
      emoji: l.emoji || "✦",
      x: l.x ?? 0,
      y: l.y ?? 0,
      color: campWorld.parseColorNumber(l.visual?.primary, 0x666666),
      roof: campWorld.parseColorNumber(l.visual?.roof, 0x444444),
      use: l.use || `You visit ${l.name || l.id}.`,
      visual: l.visual || {},
    }));
    // Base cast on field; heaven / grok wait for summon buttons
    const ALL_AGENT_DEFS = (catalog.agents || []).map((a) => ({
      id: a.id,
      name: a.name || a.id,
      color: campWorld.parseColorNumber(a.visual?.primary, 0xaaaaaa),
      accent: campWorld.parseColorNumber(a.visual?.accent, 0xffffff),
      x: a.x ?? 0,
      y: a.y ?? 0,
      visual: a.visual || {},
      base: a.base !== false && !a.summon,
      summon: a.summon || "",
      mood: a.mood || "neutral",
      faction: a.faction || a.visual?.faction || "",
      daily: !!a.daily,
      opener: a.opener || "",
      blurb: a.blurb || a.persona_hint || "",
    }));
    let AGENTS = ALL_AGENT_DEFS.filter((a) => a.base || !a.summon);
    // Mjolnir needs Thor on the meadow (usually Heaven-summon) — always include him in 3D
    if (!AGENTS.some((a) => a.id === "thor")) {
      const thorDef =
        ALL_AGENT_DEFS.find((a) => a.id === "thor") ||
        {
          id: "thor",
          name: "Thor",
          color: 0x38bdf8,
          accent: 0xf97316,
          x: 200,
          y: 200,
          visual: { archetype: "thunder", primary: "#38bdf8", accent: "#f97316" },
          base: true,
          summon: "",
          mood: "happy",
          faction: "heaven",
        };
      AGENTS = [
        ...AGENTS,
        {
          ...thorDef,
          base: true,
          summon: "",
          name: thorDef.name || "Thor",
          color: thorDef.color || 0x38bdf8,
          mood: thorDef.mood || "happy",
        },
      ];
      console.info("[camp3d] Thor forced onto meadow for Mjolnir");
    }
    // Never boot with empty talk roster
    if (!AGENTS.length) {
      const fb = campWorld.fallbackCatalog();
      AGENTS = (fb.agents || [])
        .filter((a) => a.base !== false && !a.summon)
        .map((a) => ({
          id: a.id,
          name: a.name || a.id,
          color: campWorld.parseColorNumber(a.visual?.primary, 0xaaaaaa),
          accent: campWorld.parseColorNumber(a.visual?.accent, 0xffffff),
          x: a.x ?? 0,
          y: a.y ?? 0,
          visual: a.visual || {},
          base: true,
          summon: "",
          mood: a.mood || "happy",
        }));
      console.warn("[camp3d] catalog agents empty — fallback roster", AGENTS.length);
    }

    function toWorld(x, y) {
      return new THREE.Vector3(x * SCALE, 0, y * SCALE);
    }

    setBootStep("Building meadow…");

    // Enterable places (houses + town centers) — used by click / E key / prompts
    const ENTERABLE_CENTER_TYPES = new Set([
      "shop", "club", "shelter", "tv", "carnival", "inn", "temple", "square",
      "terrace", "gate", "church", "market", "pond",
    ]);

    // Mood/prop look tables MUST exist before makeAgent → applyLook (const TDZ bug froze boot)
    const MOOD_TINT = {
      happy: 0xfbbf24, love: 0xf472b6, think: 0xa78bfa, alert: 0x38bdf8,
      flirt: 0xfb7185, neutral: 0x94a3b8, afraid: 0x64748b, urgent: 0xf97316,
    };
    const PROP_LOOK = {
      beer: { tint: 0xf59e0b, glow: 0.45, scaleY: 1.06, mood: "happy" },
      steaks: { tint: 0xdc2626, glow: 0.5, scaleX: 1.08, mood: "happy" },
      herbs: { tint: 0x4ade80, glow: 0.35, scaleY: 0.96, mood: "love" },
      weed: { tint: 0x22c55e, glow: 0.4, scaleY: 0.92, mood: "think" },
      cookies: { tint: 0xd4a05a, glow: 0.35, scaleX: 1.05, mood: "happy" },
      ouija: { tint: 0xa855f7, glow: 0.55, scaleY: 1.04, mood: "think" },
      stereo: { tint: 0x38bdf8, glow: 0.5, scaleX: 1.06, mood: "flirt" },
      water: { tint: 0x38bdf8, glow: 0.3, scaleY: 1.0, mood: "neutral" },
      snacks: { tint: 0xfbbf24, glow: 0.4, scaleX: 1.05, mood: "happy" },
      fruit: { tint: 0xef4444, glow: 0.35, scaleY: 1.02, mood: "love" },
      wine: { tint: 0x9f1239, glow: 0.45, scaleY: 1.05, mood: "flirt" },
      marshmallows: { tint: 0xfef3c7, glow: 0.35, scaleX: 1.04, mood: "love" },
      tea: { tint: 0x86efac, glow: 0.3, scaleY: 0.98, mood: "think" },
      bread: { tint: 0xd6a06a, glow: 0.25, scaleX: 1.03, mood: "love" },
      cooler2: { tint: 0x0ea5e9, glow: 0.4, scaleY: 1.04, mood: "happy" },
      trex: { tint: 0x3f7a3a, glow: 0.55, scaleX: 1.06, scaleY: 1.08, mood: "alert" },
      horse: { tint: 0x3f7a3a, glow: 0.55, scaleX: 1.06, scaleY: 1.08, mood: "alert" },
      flamingo: { tint: 0xf472b6, glow: 0.4, mood: "flirt" },
      parrot: { tint: 0x22c55e, glow: 0.4, mood: "happy" },
      duck: { tint: 0xfbbf24, glow: 0.35, mood: "love" },
      mjolnir: { tint: 0x38bdf8, glow: 0.75, scaleX: 1.06, scaleY: 1.08, mood: "alert" },
    };

    /** Props you + agents can pick up and tote (X to drop · tap a friend to gift). */
    const PICKABLE_PROPS = new Set([
      "cookies", "snacks", "fruit", "bread", "marshmallows", "herbs", "weed",
      "beer", "wine", "tea", "water", "avocado", "steaks", "cooler2", "beer",
      "ouija", "snacks", "fruit", "water", "herbs", "cookies", "bread",
    ]);
    const NOT_PICKABLE = new Set([
      "trex", "t-rex", "horse", "flamingo", "parrot", "duck", "stereo",
      "mjolnir", // only Thor can wield — others interact, cannot lift
    ]);
    const WILDLIFE_PROPS = new Set(["trex", "t-rex", "horse", "flamingo", "parrot", "duck"]);
    function isPickableProp(id) {
      const k = String(id || "").toLowerCase();
      if (!k || NOT_PICKABLE.has(k) || WILDLIFE_PROPS.has(k)) return false;
      if (k === "ouija") return false; // opens spirit chat, not carry
      if (k === "mjolnir") return false;
      if (PICKABLE_PROPS.has(k)) return true;
      // Default: most camp props are grab-able for fun
      return true;
    }

    // ── Scene ── (renderer already created canvas-first above)
    const host = document.getElementById("canvas-host");
    if (!renderer) {
      // Fallback if early canvas path was skipped
      try {
        setBootStep("Starting WebGL meadow…");
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          powerPreference: "high-performance",
          alpha: false,
          failIfMajorPerformanceCaveat: false,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x0a1230, 1);
        if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.28;
        host.appendChild(renderer.domElement);
        try {
          finishBoot(true);
        } catch (_) {}
      } catch (err) {
        showBootError(
          "WebGL failed to start (GPU/driver). Try Chrome, update graphics drivers. " +
            String(err && err.message ? err.message : err),
        );
        throw err;
      }
    }
    // Ensure boot card is gone once canvas is on the page
    if (document.querySelector("#canvas-host canvas")) {
      try {
        finishBoot(true);
      } catch (_) {}
    }

    const scene = new THREE.Scene();
    // Lighter, teal-violet fog so color pops (2D neon night)
    scene.fog = new THREE.FogExp2(0x14203a, 0.0016);

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 900);
    // Follow player start pose (target set with OrbitControls below)
    camera.position.set(12.5, 9, 16);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = true; // touch pinch still uses this; wheel is smoothed below
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.screenSpacePanning = true;
    // zoomToCursor causes wild jump-in/out — keep off
    controls.zoomToCursor = false;
    controls.rotateSpeed = 0.75;
    // Soft pinch zoom (wheel handled by our smooth radius)
    controls.zoomSpeed = 0.55;
    controls.panSpeed = 0.85;
    // Wide band so intermediate zoom levels feel natural
    const ZOOM_MIN = 3.2;
    const ZOOM_MAX = 96;
    controls.minDistance = ZOOM_MIN;
    controls.maxDistance = ZOOM_MAX;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = Math.PI * 0.48;
    // Start on the player
    controls.target.set(2.5, 1.15, 4);
    camera.position.set(2.5 + 10, 9, 4 + 12);
    if (THREE.TOUCH) {
      controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
    }
    if (THREE.MOUSE) {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
    }

    /** Smooth zoom: any distance between min/max (no leap to only near/far). */
    function camRadius() {
      return camera.position.distanceTo(controls.target);
    }
    function setCamRadius(r) {
      const radius = THREE.MathUtils.clamp(r, ZOOM_MIN, ZOOM_MAX);
      const offset = camera.position.clone().sub(controls.target);
      if (offset.lengthSq() < 1e-6) offset.set(0, 6, 12);
      offset.setLength(radius);
      camera.position.copy(controls.target).add(offset);
      return radius;
    }
    let zoomGoal = camRadius(); // eased toward each frame

    // Capture wheel so OrbitControls doesn't apply raw huge trackpad deltas
    renderer.domElement.addEventListener("wheel", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!controls.enabled || !controls.enableZoom) return;
      // Normalize lines/pages → pixels-ish, then cap so one tick is a small step
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16; // DOM_DELTA_LINE
      if (e.deltaMode === 2) dy *= window.innerHeight || 800; // DOM_DELTA_PAGE
      // Precision trackpads send many small events; mice send ~100/notch
      const mag = Math.min(Math.abs(dy), 100);
      // ~4–10% radius change per event — plenty of stops between min and max
      const factor = 1 + (mag / 100) * 0.09;
      const cur = zoomGoal || camRadius();
      if (dy > 0) zoomGoal = Math.min(ZOOM_MAX, cur * factor);
      else zoomGoal = Math.max(ZOOM_MIN, cur / factor);
    }, { passive: false, capture: true });

    // Keyboard fine zoom (hold for smooth in-between)
    window.addEventListener("keydown", (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === "=" || e.key === "+" || e.key === "]") {
        zoomGoal = Math.max(ZOOM_MIN, (zoomGoal || camRadius()) / 1.08);
        e.preventDefault();
      } else if (e.key === "-" || e.key === "[") {
        zoomGoal = Math.min(ZOOM_MAX, (zoomGoal || camRadius()) * 1.08);
        e.preventDefault();
      }
    });

    renderer.domElement.style.touchAction = "none";

    let followPlayer = true; // follow user at start

    // Lights — vivid 2D-style aurora night
    scene.add(new THREE.AmbientLight(0xb8c8ff, 0.62));
    // Cool sky / dark ground so video floor isn’t washed green
    const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x1a1528, 0.72);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe4c4, 1.25);
    sun.position.set(28, 40, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 160;
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    scene.add(sun);
    // Magenta / cyan accent lights (2D neon)
    const accentA = new THREE.PointLight(0xf472b6, 0.85, 55, 2);
    accentA.position.set(-12, 6, 8);
    scene.add(accentA);
    const accentB = new THREE.PointLight(0x67e8f9, 0.75, 50, 2);
    accentB.position.set(14, 5, -10);
    scene.add(accentB);
    const accentC = new THREE.PointLight(0xa78bfa, 0.65, 48, 2);
    accentC.position.set(0, 8, -14);
    scene.add(accentC);

    const fireLight = new THREE.PointLight(0xff7a2e, 3.6, 42, 1.45);
    fireLight.position.set(0, 1.5, 0);
    fireLight.castShadow = true;
    scene.add(fireLight);
    const fireGlow = new THREE.PointLight(0xffc266, 1.4, 18, 2);
    fireGlow.position.set(0, 0.9, 0);
    scene.add(fireGlow);

    // Sky dome — animated aurora bands + denser stars
    let skyMat = null;
    {
      const skyGeo = new THREE.SphereGeometry(280, 40, 28);
      skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          topColor: { value: new THREE.Color(0x0a1640) },
          midColor: { value: new THREE.Color(0x2e1065) },
          bottomColor: { value: new THREE.Color(0x0c1a2e) },
          aurora: { value: new THREE.Color(0x34d399) },
          aurora2: { value: new THREE.Color(0xa78bfa) },
          aurora3: { value: new THREE.Color(0xf472b6) },
          uTime: { value: 0 },
        },
        vertexShader: `
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 midColor;
          uniform vec3 bottomColor;
          uniform vec3 aurora;
          uniform vec3 aurora2;
          uniform vec3 aurora3;
          uniform float uTime;
          varying vec3 vPos;
          void main() {
            vec3 n = normalize(vPos);
            float h = n.y * 0.5 + 0.5;
            vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.42, h));
            col = mix(col, topColor, smoothstep(0.38, 1.0, h));
            // Moving aurora curtains
            float wave = sin(n.x * 4.5 + uTime * 0.35) * cos(n.z * 3.2 - uTime * 0.28);
            float band = sin(n.x * 2.8 + n.z * 1.6 + uTime * 0.55 + wave) * 0.5 + 0.5;
            float band2 = sin(n.x * 5.0 - n.z * 2.4 - uTime * 0.4) * 0.5 + 0.5;
            float a = smoothstep(0.12, 0.5, h) * smoothstep(0.92, 0.38, h);
            vec3 aur = mix(aurora, aurora2, band);
            aur = mix(aur, aurora3, band2 * 0.55);
            col = mix(col, aur, a * (0.45 + 0.4 * band) * 0.85);
            // denser twinkle stars
            float hash = fract(sin(dot(n.xz * 90.0, vec2(12.9898,78.233))) * 43758.5453);
            float stars = step(0.994, hash) * (0.6 + 0.4 * sin(uTime * 3.0 + hash * 40.0));
            col += stars * smoothstep(0.28, 1.0, h);
            // horizon neon rim
            col += vec3(0.15, 0.45, 0.55) * pow(1.0 - abs(n.y), 4.0) * 0.35;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      });
      scene.add(new THREE.Mesh(skyGeo, skyMat));
    }

    // Distant mountain silhouettes (simple, cheap depth)
    {
      const mMat = new THREE.MeshStandardMaterial({
        color: 0x1e1b4b, roughness: 0.95, metalness: 0.05, flatShading: true,
        emissive: 0x4c1d95, emissiveIntensity: 0.28,
      });
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + 0.2;
        const dist = 55 + (i % 3) * 8;
        const peak = new THREE.Mesh(
          new THREE.ConeGeometry(8 + (i % 4) * 2.5, 10 + (i % 5) * 3, 5),
          mMat,
        );
        peak.position.set(Math.cos(ang) * dist, 2, Math.sin(ang) * dist);
        peak.rotation.y = ang;
        scene.add(peak);
      }
    }

    // Ground — cool Caduceus still on mobile immediately; video floor when it can play.
    // Sticky: no green grass mesh. Phones often block autoplay → still must show first.
    let groundVideoTex = null;
    let groundVideoEl = null;
    let groundFloorMesh = null;
    let groundStillTex = null;
    let groundVideoLive = false;
    let groundVideoLastKeepAlive = 0;
    {
      const FLOOR_VIDEO = `/static/camp/camp_floor_video.mp4?v=${BUILD}`;
      const FLOOR_STILL = `/static/camp/caduceus-wallpaper.jpg?v=${BUILD}`;
      // Dark underlay — never neon green if media stalls
      const under = new THREE.Mesh(
        new THREE.PlaneGeometry(240, 240),
        new THREE.MeshStandardMaterial({
          color: 0x0a0c14,
          roughness: 0.95,
          metalness: 0.05,
          emissive: 0x05070f,
          emissiveIntensity: 0.25,
        }),
      );
      under.rotation.x = -Math.PI / 2;
      under.position.y = -0.04;
      under.receiveShadow = true;
      under.name = "groundUnderlay";
      scene.add(under);

      // Floor mesh first with cool still — visible on iOS before any video gesture
      const floorGeo = new THREE.PlaneGeometry(200, 200, 1, 1);
      const floorMat = new THREE.MeshBasicMaterial({
        color: 0x0c1220,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.y = 0.012;
      floorMesh.receiveShadow = true;
      floorMesh.name = "mjolnirFloor";
      floorMesh.renderOrder = -1;
      scene.add(floorMesh);
      groundFloorMesh = floorMesh;

      const applyFloorMap = (tex) => {
        if (!groundFloorMesh || !tex) return;
        try {
          if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        } catch (_) {}
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        tex.needsUpdate = true;
        groundFloorMesh.material.map = tex;
        groundFloorMesh.material.color?.set?.(0xffffff);
        groundFloorMesh.material.needsUpdate = true;
      };

      try {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin("anonymous");
        loader.load(
          FLOOR_STILL,
          (tex) => {
            groundStillTex = tex;
            // Only keep still if video has not taken over yet
            if (!groundVideoLive) {
              applyFloorMap(tex);
              console.info("[camp3d] cool still floor ready (mobile-safe)", FLOOR_STILL);
            }
          },
          undefined,
          (err) => console.warn("[camp3d] still floor failed", err),
        );
      } catch (err) {
        console.warn("[camp3d] still floor loader", err);
      }

      try {
        const vid = document.createElement("video");
        vid.src = FLOOR_VIDEO;
        vid.crossOrigin = "anonymous";
        vid.loop = true;
        vid.muted = true;
        vid.defaultMuted = true;
        vid.volume = 0;
        try { vid.setAttribute("muted", "muted"); } catch (_) {}
        vid.playsInline = true;
        vid.setAttribute("playsinline", "");
        vid.setAttribute("webkit-playsinline", "");
        vid.setAttribute("muted", "");
        // metadata first on phones — auto often stalls; unlock upgrades to full play
        const isPhone =
          /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "") ||
          (window.matchMedia && window.matchMedia("(max-width: 899px)").matches);
        vid.preload = isPhone ? "metadata" : "auto";
        // Never let floor audio leak (even if the file still has a track)
        const forceMute = () => {
          try {
            vid.muted = true;
            vid.defaultMuted = true;
            vid.volume = 0;
          } catch (_) {}
        };
        forceMute();
        vid.addEventListener("volumechange", forceMute);
        vid.addEventListener("play", forceMute);
        vid.addEventListener("playing", forceMute);
        // Keep element in DOM (hidden) so browsers don't GC the decoder
        vid.style.cssText =
          "position:fixed;width:2px;height:2px;opacity:0.01;pointer-events:none;left:0;top:0;z-index:-1;";
        document.body.appendChild(vid);
        groundVideoEl = vid;

        const tex = new THREE.VideoTexture(vid);
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        tex.needsUpdate = true;
        groundVideoTex = tex;

        const promoteVideoFloor = () => {
          if (!groundVideoTex || !groundFloorMesh) return;
          if (vid.readyState < 2 || vid.videoWidth <= 0) return;
          groundVideoLive = true;
          applyFloorMap(groundVideoTex);
          groundVideoTex.needsUpdate = true;
        };

        const tryPlay = () => {
          forceMute();
          const p = vid.play();
          if (p && typeof p.then === "function") {
            p.then(() => promoteVideoFloor()).catch(() => {});
          } else {
            promoteVideoFloor();
          }
        };
        // Mobile: keep trying unlock until video actually plays (not once-only)
        let unlockBound = false;
        const bindUnlock = () => {
          if (unlockBound) return;
          unlockBound = true;
          const unlock = () => {
            forceMute();
            try {
              vid.preload = "auto";
              if (vid.readyState < 2) vid.load();
            } catch (_) {}
            tryPlay();
            // Drop listeners once playing
            if (!vid.paused && vid.readyState >= 2) {
              window.removeEventListener("pointerdown", unlock);
              window.removeEventListener("touchstart", unlock);
              window.removeEventListener("keydown", unlock);
            }
          };
          window.addEventListener("pointerdown", unlock, { passive: true });
          window.addEventListener("touchstart", unlock, { passive: true });
          window.addEventListener("keydown", unlock);
        };
        bindUnlock();

        const kick = () => {
          tryPlay();
          if (groundVideoTex) groundVideoTex.needsUpdate = true;
        };
        if (vid.readyState >= 2) kick();
        else {
          vid.addEventListener("canplay", kick, { once: true });
          vid.addEventListener("loadeddata", kick, { once: true });
        }
        // Stickiness: if the loop ends or stalls, restart — never leave a dead first frame
        vid.addEventListener("ended", () => {
          try {
            vid.currentTime = 0;
            vid.play().then(() => promoteVideoFloor()).catch(() => {});
          } catch (_) {}
        });
        vid.addEventListener("pause", () => {
          if (!document.hidden) {
            setTimeout(() => {
              if (vid.paused && !document.hidden) tryPlay();
            }, 120);
          }
        });
        vid.addEventListener("playing", () => promoteVideoFloor());
        vid.addEventListener("error", () => {
          console.warn("[camp3d] video floor error — keeping still", vid.error);
          groundVideoLive = false;
          if (groundStillTex) applyFloorMap(groundStillTex);
        });
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden && vid.paused) tryPlay();
        });
        console.info("[camp3d] floor: still first, video when unlocked", FLOOR_VIDEO);
      } catch (err) {
        console.warn("[camp3d] video floor failed, still/underlay only", err);
      }
    }

    // Meadow ring path — glowing path like 2D camp circle
    {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(4.2, 5.15, 64),
        new THREE.MeshStandardMaterial({
          color: 0x5b3a1a,
          roughness: 0.85,
          metalness: 0.08,
          emissive: 0xfbbf24,
          emissiveIntensity: 0.12,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.025;
      ring.receiveShadow = true;
      scene.add(ring);
      const glowRing = new THREE.Mesh(
        new THREE.RingGeometry(3.95, 4.15, 64),
        new THREE.MeshBasicMaterial({
          color: 0x67e8f9,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      glowRing.rotation.x = -Math.PI / 2;
      glowRing.position.y = 0.04;
      glowRing.name = "pathGlow";
      scene.add(glowRing);
    }

    // Campfire — bigger, brighter, multi-flame
    function makeCampfire() {
      const group = new THREE.Group();
      const logMat = new THREE.MeshStandardMaterial({
        color: 0x4a3728,
        roughness: 0.85,
        emissive: 0x2a1508,
        emissiveIntensity: 0.25,
      });
      for (let i = 0; i < 6; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.45, 8), logMat);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = (i / 6) * Math.PI;
        log.position.y = 0.12;
        log.castShadow = true;
        group.add(log);
      }
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 1.35, 10),
        new THREE.MeshStandardMaterial({
          color: 0xff6b2d,
          emissive: 0xff4500,
          emissiveIntensity: 2.2,
          transparent: true,
          opacity: 0.92,
        }),
      );
      flame.position.y = 0.95;
      flame.name = "flame";
      group.add(flame);
      const flame2 = new THREE.Mesh(
        new THREE.ConeGeometry(0.28, 0.95, 8),
        new THREE.MeshStandardMaterial({
          color: 0xffc266,
          emissive: 0xffaa33,
          emissiveIntensity: 1.8,
          transparent: true,
          opacity: 0.75,
        }),
      );
      flame2.position.set(0.12, 0.85, 0.08);
      flame2.name = "flame2";
      group.add(flame2);
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 14, 14),
        new THREE.MeshStandardMaterial({
          color: 0xffe08a,
          emissive: 0xffaa33,
          emissiveIntensity: 2.8,
        }),
      );
      core.position.y = 0.48;
      core.name = "fireCore";
      group.add(core);
      // Ground heat disc
      const heat = new THREE.Mesh(
        new THREE.CircleGeometry(1.8, 32),
        new THREE.MeshBasicMaterial({
          color: 0xff6b2d,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        }),
      );
      heat.rotation.x = -Math.PI / 2;
      heat.position.y = 0.05;
      heat.name = "heatDisc";
      group.add(heat);
      scene.add(group);
      return group;
    }
    const campfire = makeCampfire();

    // Fireflies / motes around the fire (2D glitter energy)
    let fireflies = null;
    {
      const N = 140;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 3);
      const col = new Float32Array(N * 3);
      const phase = new Float32Array(N);
      const palette = [
        new THREE.Color(0x67e8f9),
        new THREE.Color(0xa78bfa),
        new THREE.Color(0xf472b6),
        new THREE.Color(0x86efac),
        new THREE.Color(0xfde68a),
      ];
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 1.2 + Math.random() * 14;
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = 0.4 + Math.random() * 3.8;
        pos[i * 3 + 2] = Math.sin(a) * r;
        const c = palette[i % palette.length];
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
        phase[i] = Math.random() * Math.PI * 2;
      }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
      const mat = new THREE.PointsMaterial({
        size: 0.14,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });
      fireflies = new THREE.Points(geo, mat);
      fireflies.name = "fireflies";
      scene.add(fireflies);
    }

    // No digital grass — floor is the Mjolnir relic video
    let grassMesh = null;

    // Simple trees
    function makeTree(x, z, h = 1) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15 * h, 0.2 * h, 1.2 * h, 6),
        new THREE.MeshStandardMaterial({ color: 0x5c4033 }),
      );
      trunk.position.y = 0.6 * h;
      trunk.castShadow = true;
      g.add(trunk);
      const leafCols = [0x16a34a, 0x22c55e, 0x4ade80, 0x0d9488];
      const leaf = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.9 * h, 0),
        new THREE.MeshStandardMaterial({
          color: leafCols[Math.floor(Math.random() * leafCols.length)],
          roughness: 0.72,
          metalness: 0.06,
          emissive: 0x14532d,
          emissiveIntensity: 0.12,
        }),
      );
      leaf.position.y = 1.5 * h;
      leaf.castShadow = true;
      g.add(leaf);
      g.position.set(x, 0, z);
      scene.add(g);
    }
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 + Math.random() * 0.25;
      const r = 22 + Math.random() * 48;
      makeTree(Math.cos(a) * r, Math.sin(a) * r, 0.9 + Math.random() * 0.7);
    }

    // Houses — solid footprint + front door for enter/leave
    const houseMeshes = [];
    for (const h of HOUSES) {
      const p = toWorld(h.x, h.y);
      const group = new THREE.Group();
      const wallH = h.castle ? 2.4 : 1.6;
      const halfX = h.castle ? 1.65 : 1.25;
      const halfZ = h.castle ? 1.45 : 1.1;
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(halfX * 2, wallH, halfZ * 2),
        new THREE.MeshStandardMaterial({ color: h.wall, roughness: 0.75 }),
      );
      wall.position.y = wallH / 2;
      wall.castShadow = true;
      wall.receiveShadow = true;
      wall.name = "houseWall";
      group.add(wall);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(h.castle ? 2.4 : 1.9, h.castle ? 1.4 : 1.0, 4),
        new THREE.MeshStandardMaterial({ color: h.roof, roughness: 0.7 }),
      );
      roof.position.y = wallH + (h.castle ? 0.7 : 0.5);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.95, 0.08),
        new THREE.MeshStandardMaterial({
          color: 0x2a1810,
          emissive: 0x000000,
          emissiveIntensity: 0,
        }),
      );
      door.position.set(0, 0.48, halfZ + 0.02);
      door.name = "houseDoor";
      group.add(door);
      // Host home lamp over door (glows when owner is inside)
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 10),
        new THREE.MeshStandardMaterial({
          color: 0xfde68a,
          emissive: 0x000000,
          emissiveIntensity: 0,
        }),
      );
      lamp.position.set(0, wallH + 0.15, halfZ + 0.08);
      lamp.name = "houseHomeLamp";
      group.add(lamp);
      // Soft doorway mat (visual only)
      const mat = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.55),
        new THREE.MeshBasicMaterial({
          color: h.wall,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        }),
      );
      mat.rotation.x = -Math.PI / 2;
      mat.position.set(0, 0.03, halfZ + 0.45);
      group.add(mat);
      const label = makeLabelSprite(h.name, h.emoji || "🏠", h.wall);
      label.position.y = wallH + 1.6;
      label.scale.set(2.0, 1.0, 1);
      group.add(label);
      group.position.copy(p);
      group.userData = {
        kind: "house",
        id: h.catalogId || h.id,
        ownerId: h.id,
        catalogId: h.catalogId,
        name: h.name,
        emoji: h.emoji,
        halfX,
        halfZ,
        wallH,
        occupants: 0,
        solid: true,
      };
      scene.add(group);
      houseMeshes.push(group);
    }

    // Landmarks (shop, TV, club, pond, shelter) — 2D parity structures
    const landmarkMeshes = [];
    function spawnLandmark(lm) {
      const p = toWorld(lm.x, lm.y);
      const group = new THREE.Group();
      const type = lm.type || "landmark";
      if (type === "pond") {
        const water = new THREE.Mesh(
          new THREE.CircleGeometry(1.8, 32),
          new THREE.MeshStandardMaterial({
            color: lm.color, roughness: 0.15, metalness: 0.45,
            emissive: lm.color, emissiveIntensity: 0.2,
          }),
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = 0.04;
        group.add(water);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(1.75, 2.05, 32),
          new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.9 }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        group.add(ring);
      } else if (type === "tv") {
        const set = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 1.0, 0.35),
          new THREE.MeshStandardMaterial({ color: 0x1e1b4b, emissive: lm.color, emissiveIntensity: 0.35 }),
        );
        set.position.y = 0.9;
        set.castShadow = true;
        group.add(set);
        const screen = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.7, 0.08),
          new THREE.MeshStandardMaterial({ color: lm.color, emissive: lm.color, emissiveIntensity: 0.8 }),
        );
        screen.position.set(0, 0.95, 0.2);
        group.add(screen);
      } else if (type === "club") {
        const floor = new THREE.Mesh(
          new THREE.CylinderGeometry(1.6, 1.6, 0.12, 16),
          new THREE.MeshStandardMaterial({ color: lm.color, emissive: lm.color, emissiveIntensity: 0.25 }),
        );
        floor.position.y = 0.06;
        group.add(floor);
        const neon = new THREE.Mesh(
          new THREE.TorusGeometry(1.3, 0.06, 8, 24),
          new THREE.MeshStandardMaterial({ color: lm.roof, emissive: lm.roof, emissiveIntensity: 0.9 }),
        );
        neon.rotation.x = Math.PI / 2;
        neon.position.y = 1.4;
        group.add(neon);
      } else {
        // shop / shelter / generic stall
        const wallH = type === "shelter" ? 1.2 : 1.5;
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(type === "shop" ? 2.6 : 2.2, wallH, 1.8),
          new THREE.MeshStandardMaterial({ color: lm.color, roughness: 0.7 }),
        );
        wall.position.y = wallH / 2;
        wall.castShadow = true;
        group.add(wall);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(type === "shop" ? 2.9 : 2.5, 0.2, 2.1),
          new THREE.MeshStandardMaterial({ color: lm.roof || lm.color, roughness: 0.65 }),
        );
        roof.position.y = wallH + 0.15;
        group.add(roof);
      }
      const label = makeLabelSprite(lm.name, lm.emoji || "✦", lm.color);
      label.position.y = type === "pond" ? 1.2 : 2.4;
      label.scale.set(2.0, 1.0, 1);
      group.add(label);
      group.position.copy(p);
      // Solid footprint for buildings (pond is open water — no hard block)
      let halfX = 0, halfZ = 0, solid = false;
      if (type === "shop") { halfX = 1.35; halfZ = 0.95; solid = true; }
      else if (type === "shelter") { halfX = 1.15; halfZ = 0.95; solid = true; }
      else if (type === "tv") { halfX = 0.85; halfZ = 0.4; solid = true; }
      else if (type === "club") { halfX = 1.5; halfZ = 1.5; solid = true; }
      group.userData = {
        kind: "landmark",
        id: lm.id,
        type: lm.type || type,
        name: lm.name,
        emoji: lm.emoji,
        use: lm.use,
        halfX,
        halfZ,
        solid,
        enterable: ENTERABLE_CENTER_TYPES.has(String(lm.type || type || "").toLowerCase()),
      };
      scene.add(group);
      landmarkMeshes.push(group);
      return group;
    }
    for (const lm of LANDMARKS) spawnLandmark(lm);

    // Props
    function makeLabelSprite(text, emoji, color) {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 256, 128);
      ctx.fillStyle = "rgba(8,14,28,0.82)";
      roundRect(ctx, 16, 24, 224, 80, 16);
      ctx.fill();
      ctx.font = "48px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(emoji, 128, 78);
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(text, 128, 100);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
      const spr = new THREE.Sprite(mat);
      spr.scale.set(1.6, 0.8, 1);
      return spr;
    }
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    /** Camp prop meshes — denser geometry, materials, soft ground contact. */
    function buildPropVisual(prop) {
      const g = new THREE.Group();
      g.userData.propBob = Math.random() * Math.PI * 2;
      const kit = prop.visual?.kit || prop.id || "crate";
      const col = prop.color || 0x888888;
      const mat = (c, rough = 0.55, metal = 0.08, em = 0.06) =>
        new THREE.MeshStandardMaterial({
          color: c, roughness: rough, metalness: metal,
          emissive: new THREE.Color(c).multiplyScalar(0.2),
          emissiveIntensity: em,
        });
      const add = (mesh, y = 0) => {
        mesh.position.y = y;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        g.add(mesh);
        return mesh;
      };
      // soft contact shadow
      const contact = new THREE.Mesh(
        new THREE.CircleGeometry(0.55, 24),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
      );
      contact.rotation.x = -Math.PI / 2;
      contact.position.y = 0.02;
      g.add(contact);

      if (kit === "cooler" || prop.id === "beer" || prop.id === "cooler2") {
        add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.72, 0.78), mat(col, 0.35, 0.45, 0.05)), 0.42);
        add(new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.1, 0.84), mat(0x0f172a, 0.45, 0.35, 0)), 0.82);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 16, Math.PI), mat(0x334155, 0.4, 0.5, 0));
        handle.rotation.x = Math.PI / 2;
        handle.position.y = 0.95;
        handle.castShadow = true;
        g.add(handle);
        for (let i = 0; i < 4; i++) {
          const b = new THREE.Mesh(
            new THREE.CylinderGeometry(0.07, 0.08, 0.38, 12),
            mat(i % 2 ? 0xfbbf24 : 0xf97316, 0.25, 0.15, 0.12),
          );
          b.position.set(-0.32 + i * 0.2, 1.08, 0.05);
          b.castShadow = true;
          g.add(b);
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 12), mat(0x1e293b, 0.5, 0.3, 0));
          cap.position.set(b.position.x, 1.28, 0.05);
          g.add(cap);
        }
      } else if (kit === "grill" || prop.id === "steaks") {
        for (const lx of [-0.35, 0.35]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.55, 10), mat(0x1e293b, 0.6, 0.4, 0));
          leg.position.set(lx, 0.28, 0);
          leg.castShadow = true;
          g.add(leg);
        }
        add(new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.18, 0.9), mat(0x334155, 0.45, 0.55, 0)), 0.58);
        const coal = add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.65), mat(0x7c2d12, 0.85, 0.05, 0.45)), 0.52);
        coal.material.emissive = new THREE.Color(0xff4500);
        coal.material.emissiveIntensity = 0.35;
        add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.72), mat(0xcbd5e1, 0.25, 0.75, 0.05)), 0.72);
        for (const ox of [-0.22, 0.22]) {
          const steak = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.3), mat(0xb91c1c, 0.55, 0.05, 0.2));
          steak.position.set(ox, 0.82, 0);
          steak.rotation.y = ox * 0.2;
          steak.castShadow = true;
          g.add(steak);
        }
        // heat shimmer marker for animate loop
        g.userData.hot = true;
      } else if (kit === "jar" || prop.id === "weed") {
        const jar = add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.58, 20), mat(0x4ade80, 0.2, 0.05, 0.08)), 0.42);
        jar.material.transparent = true;
        jar.material.opacity = 0.82;
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.1, 16), mat(0x166534, 0.45, 0.1, 0.05)), 0.76);
        for (let i = 0; i < 3; i++) {
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), mat(0x22c55e, 0.55, 0, 0.15));
          leaf.scale.set(1.2, 0.45, 0.8);
          leaf.position.set(Math.cos(i) * 0.12, 0.55 + i * 0.05, Math.sin(i) * 0.1);
          g.add(leaf);
        }
      } else if (kit === "plate" || prop.id === "cookies") {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.45, 16), mat(0x78716c, 0.7, 0.05, 0)), 0.25);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.06, 24), mat(0xf5f5f4, 0.35, 0.08, 0)), 0.5);
        for (let i = 0; i < 6; i++) {
          const cookie = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.05, 14), mat(0xd4a05a, 0.65, 0, 0.05));
          const a = (i / 6) * Math.PI * 2;
          cookie.position.set(Math.cos(a) * 0.26, 0.58, Math.sin(a) * 0.26);
          cookie.castShadow = true;
          g.add(cookie);
          const chip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), mat(0x44403c, 0.7, 0, 0));
          chip.position.set(cookie.position.x + 0.02, 0.62, cookie.position.z);
          g.add(chip);
        }
      } else if (kit === "board" || prop.id === "ouija") {
        add(new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.22, 0.72), mat(0x1e1b4b, 0.75, 0.05, 0.08)), 0.16);
        add(new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.06, 0.66), mat(col, 0.45, 0.12, 0.2)), 0.38);
        // planchette
        const planchette = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.08, 3), mat(0xe9d5ff, 0.35, 0.2, 0.35));
        planchette.rotation.x = -Math.PI / 2;
        planchette.position.set(0.05, 0.46, 0.05);
        g.add(planchette);
        g.userData.planchette = planchette;
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), mat(0xf5d0fe, 0.25, 0.15, 0.55));
        eye.position.set(0, 0.52, -0.12);
        g.add(eye);
      } else if (kit === "jukebox" || prop.id === "stereo") {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.25, 0.48), mat(col, 0.32, 0.5, 0.12)), 0.68);
        const screen = add(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.32, 0.06), mat(0x22d3ee, 0.2, 0.4, 0.55)), 1.0);
        screen.position.z = 0.24;
        g.userData.screen = screen;
        for (const sx of [-0.18, 0.18]) {
          const spk = new THREE.Mesh(new THREE.CircleGeometry(0.14, 20), mat(0x0f172a, 0.5, 0.2, 0));
          spk.position.set(sx, 0.48, 0.25);
          g.add(spk);
          const cone = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.12, 16), mat(0x64748b, 0.4, 0.3, 0));
          cone.position.set(sx, 0.48, 0.255);
          g.add(cone);
        }
        // neon top light
        const neon = add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.12), mat(0x38bdf8, 0.3, 0.2, 0.6)), 1.35);
        neon.material.emissiveIntensity = 0.7;
      } else if (kit === "water" || prop.id === "water") {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.05, 20), mat(0x38bdf8, 0.22, 0.25, 0.12)), 0.55);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.18, 12), mat(0x0ea5e9, 0.3, 0.35, 0.1)), 1.15);
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.16, 12), mat(0xe0f2fe, 0.25, 0.1, 0.05));
        cup.position.set(0.38, 0.48, 0.18);
        cup.castShadow = true;
        g.add(cup);
      } else if (kit === "crate" || prop.id === "snacks") {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.52, 0.72), mat(col, 0.75, 0.05, 0.04)), 0.32);
        // wood slat lines
        for (let i = 0; i < 3; i++) {
          const slat = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.03, 0.74), mat(0x92400e, 0.8, 0.02, 0));
          slat.position.set(0, 0.18 + i * 0.14, 0);
          g.add(slat);
        }
        for (let i = 0; i < 5; i++) {
          const p = new THREE.Mesh(new THREE.SphereGeometry(0.1 + (i % 2) * 0.03, 10, 10), mat(0xfef3c7, 0.55, 0, 0.08));
          p.position.set(-0.22 + (i % 3) * 0.2, 0.68, -0.12 + Math.floor(i / 3) * 0.22);
          g.add(p);
        }
      } else if (kit === "bowl" || prop.id === "fruit") {
        add(new THREE.Mesh(
          new THREE.SphereGeometry(0.42, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
          mat(0xd6d3d1, 0.4, 0.12, 0),
        ), 0.32);
        const colors = [0xef4444, 0xfbbf24, 0x22c55e, 0xf97316, 0xa855f7];
        colors.forEach((c, i) => {
          const fr = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), mat(c, 0.45, 0, 0.08));
          const a = (i / colors.length) * Math.PI * 2;
          fr.position.set(Math.cos(a) * 0.16, 0.52, Math.sin(a) * 0.16);
          fr.castShadow = true;
          g.add(fr);
        });
      } else if (kit === "wine" || prop.id === "wine") {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.58), mat(0x44403c, 0.75, 0.05, 0)), 0.26);
        for (let i = 0; i < 3; i++) {
          const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.58, 12), mat(col, 0.25, 0.15, 0.1));
          bot.position.set(-0.24 + i * 0.24, 0.72, 0);
          bot.castShadow = true;
          g.add(bot);
          const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.18, 10), mat(col, 0.25, 0.15, 0.1));
          neck.position.set(bot.position.x, 1.08, 0);
          g.add(neck);
        }
      } else if (kit === "smores" || prop.id === "marshmallows") {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.22, 0.52), mat(0xfef3c7, 0.65, 0, 0.05)), 0.22);
        add(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.34), mat(0x78350f, 0.75, 0, 0)), 0.4);
        for (const ox of [-0.12, 0.12]) {
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), mat(0xfffbeb, 0.5, 0, 0.06));
          m.position.set(ox, 0.55, 0);
          g.add(m);
        }
      } else if (kit === "kettle" || prop.id === "tea") {
        add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 18), mat(col, 0.32, 0.4, 0.08)), 0.48);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.16, 12), mat(0x166534, 0.4, 0.2, 0.05)), 0.8);
        const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.3, 10), mat(col, 0.32, 0.35, 0.05));
        spout.rotation.z = Math.PI / 3.2;
        spout.position.set(0.3, 0.52, 0);
        g.add(spout);
        // steam markers
        g.userData.steam = true;
      } else if (kit === "bread" || prop.id === "bread") {
        const loaf = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 6, 12), mat(col, 0.75, 0, 0.04)), 0.38);
        loaf.rotation.z = Math.PI / 2;
        loaf.scale.set(1, 0.85, 1.1);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 0.08, 16), mat(0x57534e, 0.85, 0, 0)), 0.12);
      } else if (kit === "bundle" || prop.id === "herbs") {
        for (let i = 0; i < 7; i++) {
          const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.75, 6), mat(0x4ade80, 0.55, 0, 0.12));
          stalk.position.set((i - 3) * 0.07, 0.42, (i % 3) * 0.04 - 0.04);
          stalk.rotation.z = (i - 3) * 0.06;
          stalk.castShadow = true;
          g.add(stalk);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mat(0x86efac, 0.5, 0, 0.15));
          tip.position.set(stalk.position.x, 0.82, stalk.position.z);
          g.add(tip);
        }
        add(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.1, 0.28), mat(0x365314, 0.75, 0, 0)), 0.1);
      } else if (kit === "trex" || kit === "horse" || prop.id === "trex" || prop.id === "horse") {
        // Fallback silhouette — nose along +Z (same convention as agents / buildTrexMesh)
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.75, 6, 12), mat(0x3f7a3a, 0.55));
        body.position.set(0, 1.05, 0.05);
        body.castShadow = true;
        g.add(body);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.62), mat(0x3f7a3a, 0.5));
        head.position.set(0, 1.55, 0.45);
        head.castShadow = true;
        g.add(head);
        const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.4), mat(0x2a4a28, 0.55));
        jaw.position.set(0, 1.32, 0.42);
        g.add(jaw);
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 4, 8), mat(0x3f7a3a, 0.55));
        tail.position.set(0, 1.05, -0.55);
        tail.rotation.x = Math.PI / 2.2;
        tail.castShadow = true;
        g.add(tail);
        g.userData.trex = true;
        g.userData.faceYaw = 0;
        g.userData.interactKind = "wildlife";
      } else if (kit === "mjolnir" || prop.id === "mjolnir") {
        // Mjolnir — short handle + block head + storm glow (only Thor lifts)
        const steel = mat(0xb8c4d4, 0.32, 0.88, 0.18);
        steel.emissive = new THREE.Color(0x38bdf8);
        steel.emissiveIntensity = 0.22;
        const wood = mat(0x5c3a1e, 0.88, 0.05, 0.04);
        const leather = mat(0x3f2a14, 0.9, 0.02, 0);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.92, 12), wood), 0.52);
        for (let i = 0; i < 5; i++) {
          const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.016, 6, 14), leather);
          wrap.rotation.x = Math.PI / 2;
          wrap.position.y = 0.22 + i * 0.1;
          wrap.castShadow = true;
          g.add(wrap);
        }
        const head = add(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.34, 0.34), steel), 1.08);
        head.castShadow = true;
        // short side peens
        add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.28), steel), 1.08).position.x = 0.32;
        add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.28), steel), 1.08).position.x = -0.32;
        const rune = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.05, 0.06),
          new THREE.MeshStandardMaterial({
            color: 0x67e8f9,
            emissive: 0x0ea5e9,
            emissiveIntensity: 1.1,
            metalness: 0.4,
            roughness: 0.25,
          }),
        );
        rune.position.set(0, 1.08, 0.18);
        g.add(rune);
        const pommel = add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), steel), 0.06);
        pommel.material = steel;
        // lightning aura disc
        const aura = new THREE.Mesh(
          new THREE.RingGeometry(0.35, 0.72, 32),
          new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.45,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        aura.rotation.x = -Math.PI / 2;
        aura.position.y = 0.04;
        aura.name = "mjolnirAura";
        g.add(aura);
        g.userData.mjolnir = true;
        g.userData.interactKind = "mjolnir";
        g.userData.hot = true;
      } else {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.8), mat(col, 0.5, 0.12, 0.06)), 0.35);
      }
      return g;
    }

    const propMeshes = [];
    async function spawnProp(prop) {
      const p = toWorld(prop.x, prop.y);
      let group;
      try {
        if (propSystem) {
          group = await propSystem.createPropMesh(prop, buildPropVisual);
        }
      } catch (err) {
        console.warn("[camp3d] prop GLB path failed", prop.id, err);
      }
      if (!group) group = buildPropVisual(prop);
      const label = makeLabelSprite(prop.name, prop.emoji, prop.color);
      const tall = group.userData.trex || prop.id === "trex" || prop.visual?.kit === "trex";
      label.position.y = tall ? 2.35 : 1.55;
      label.scale.set(tall ? 2.4 : 2.0, tall ? 1.15 : 1.0, 1);
      group.add(label);
      // ground glow ring so you can spot it
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.75, 24),
        new THREE.MeshBasicMaterial({ color: prop.color, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      group.add(ring);
      group.position.copy(p);
      group.userData = { ...group.userData, kind: "prop", ...prop };
      scene.add(group);
      propMeshes.push(group);
      if (prop.id === "mjolnir" || group.userData.mjolnir) {
        mjolnirState.mesh = group;
        group.userData.mjolnir = true;
        group.userData.interact = "mjolnir";
      }
      return group;
    }
    // Catalog toys + free wildlife accents + Mjolnir (Thor-only lift)
    const EXTRA_SCENERY = [
      { id: "flamingo", name: "Flamingo", emoji: "🦩", x: -180, y: 300, color: 0xf472b6, visual: { kit: "flamingo" }, interact: "pet" },
      { id: "parrot", name: "Parrot", emoji: "🦜", x: 120, y: 280, color: 0x22c55e, visual: { kit: "parrot" }, interact: "pet" },
      { id: "trex", name: "Camp T-Rex", emoji: "🦖", x: 520, y: -120, color: 0x3f7a3a, visual: { kit: "trex" }, interact: "roar" },
      { id: "duck", name: "Pond duck", emoji: "🦆", x: -200, y: 340, color: 0xfbbf24, visual: { kit: "duck" }, interact: "pet" },
      {
        id: "mjolnir",
        name: "Mjolnir",
        emoji: "🔨",
        x: 80,
        y: 40,
        color: 0x38bdf8,
        visual: { kit: "mjolnir" },
        interact: "mjolnir",
        use: "Only the worthy may lift the hammer — Thor already knows the answer.",
      },
    ];

    /** Live Mjolnir — world prop, Thor carry, flight throws */
    const mjolnirState = {
      mesh: null,
      ownerId: null, // "thor" when wielded
      flying: false,
      vx: 0,
      vy: 0,
      vz: 0,
      spin: 0,
      landAt: 0,
      nextThorSeekAt: 0,
      nextThorThrowAt: 0,
    };
    function findMjolnirMesh() {
      if (mjolnirState.mesh?.parent) return mjolnirState.mesh;
      const m = propMeshes.find((g) => g.userData?.mjolnir || g.userData?.id === "mjolnir") || null;
      if (m) mjolnirState.mesh = m;
      return m;
    }
    function worldPosOfMjolnir() {
      const m = findMjolnirMesh();
      if (!m) return new THREE.Vector3(2, 0, 1);
      const p = new THREE.Vector3();
      m.getWorldPosition(p);
      return p;
    }
    function placeMjolnirOnGround(wx, wz, opts = {}) {
      const mesh = findMjolnirMesh();
      if (!mesh) return;
      // Detach from any agent hand
      if (mesh.parent && mesh.parent !== scene) {
        mesh.parent.remove(mesh);
        scene.add(mesh);
      }
      const solid = resolveSolidXZ(wx, wz, 0.45, {});
      mesh.position.set(solid.x, 0, solid.z);
      mesh.rotation.set(0, opts.yaw != null ? opts.yaw : Math.random() * Math.PI * 2, 0);
      mesh.scale.setScalar(1);
      mesh.visible = true;
      mesh.userData.kind = "prop";
      mesh.userData.id = "mjolnir";
      mesh.userData.name = "Mjolnir";
      mesh.userData.emoji = "🔨";
      mesh.userData.mjolnir = true;
      if (!propMeshes.includes(mesh)) propMeshes.push(mesh);
      mjolnirState.ownerId = null;
      mjolnirState.flying = false;
      mjolnirState.vx = 0;
      mjolnirState.vy = 0;
      mjolnirState.vz = 0;
    }
    function thorClaimMjolnir(st) {
      if (!st || st.def?.id !== "thor") return false;
      const mesh = findMjolnirMesh();
      if (!mesh || mjolnirState.flying) return false;
      // Parent hammer to Thor's hand
      if (mesh.parent) mesh.parent.remove(mesh);
      st.mesh.add(mesh);
      mesh.position.set(0.42, 1.15, 0.28);
      mesh.rotation.set(0.35, 0.4, 0.9);
      mesh.scale.setScalar(0.72);
      mesh.visible = true;
      mjolnirState.ownerId = "thor";
      mjolnirState.flying = false;
      setAgentCarry(st, { id: "mjolnir", name: "Mjolnir", emoji: "🔨", color: 0x38bdf8 });
      // Hide emoji sprite — real mesh is the carry
      clearCarryOn(st.mesh);
      st.carried = { id: "mjolnir", name: "Mjolnir", emoji: "🔨", color: 0x38bdf8 };
      st.nextThrowAt = performance.now() + 3500 + Math.random() * 4000;
      mjolnirState.nextThorThrowAt = st.nextThrowAt;
      return true;
    }
    function thorThrowMjolnir(st, aim = null) {
      if (!st || st.def?.id !== "thor") return false;
      const mesh = findMjolnirMesh();
      if (!mesh || mjolnirState.ownerId !== "thor") return false;
      // World-space launch from hand
      const origin = new THREE.Vector3();
      mesh.getWorldPosition(origin);
      if (mesh.parent) mesh.parent.remove(mesh);
      scene.add(mesh);
      mesh.position.copy(origin);
      mesh.scale.setScalar(0.85);
      if (!propMeshes.includes(mesh)) propMeshes.push(mesh);

      let tx, tz;
      if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.z)) {
        tx = aim.x;
        tz = aim.z;
      } else if (Math.random() < 0.35 && typeof visitor !== "undefined" && visitor) {
        tx = visitor.position.x + (Math.random() - 0.5) * 6;
        tz = visitor.position.z + (Math.random() - 0.5) * 6;
      } else if (Math.random() < 0.5 && agentState.length > 1) {
        const prey = agentState.filter((a) => a.def.id !== "thor")[Math.floor(Math.random() * Math.max(1, agentState.length - 1))];
        if (prey) {
          tx = prey.mesh.position.x + (Math.random() - 0.5) * 4;
          tz = prey.mesh.position.z + (Math.random() - 0.5) * 4;
        }
      }
      if (tx == null) {
        const a = Math.random() * Math.PI * 2;
        const r = 8 + Math.random() * 22;
        tx = Math.cos(a) * r;
        tz = Math.sin(a) * r;
      }
      const solid = resolveSolidXZ(tx, tz, 0.5, {});
      tx = solid.x;
      tz = solid.z;
      const dx = tx - origin.x;
      const dz = tz - origin.z;
      const dist = Math.hypot(dx, dz) || 1;
      const flightT = Math.min(1.6, Math.max(0.55, dist / 22));
      const speed = dist / flightT;
      mjolnirState.flying = true;
      mjolnirState.ownerId = null;
      mjolnirState.vx = (dx / dist) * speed;
      mjolnirState.vz = (dz / dist) * speed;
      mjolnirState.vy = 6.5 + Math.random() * 3.5; // arc
      mjolnirState.spin = 14 + Math.random() * 10;
      mjolnirState.landAt = performance.now() + flightT * 1000 + 200;
      mesh.position.y = Math.max(origin.y, 1.2);
      st.carried = null;
      clearCarryOn(st.mesh);
      st.action = "throw_mjolnir";
      st.nextDecideAt = performance.now() + 2000 + Math.random() * 1500;
      // After landing, Thor will seek again
      // Start seeking soon after the throw so Thor books it to the landing
      mjolnirState.nextThorSeekAt = performance.now() + flightT * 1000 + 250;
      showToast("⚡ Thor hurls Mjolnir");
      logLine("Thor", "Mjolnir flies — worthy or not, the meadow feels it.");
      showSpeech3d(
        "thor",
        [
          "Hammer — fly true!",
          "Mjolnir, clear a path!",
          "Catch this, meadow!",
          "Thunder follows the throw!",
        ][Math.floor(Math.random() * 4)],
        9000,
        { compact: true },
      );
      // Nearby agents flinch
      for (const o of agentState) {
        if (o === st) continue;
        const d = o.mesh.position.distanceTo(origin);
        if (d < 10 && Math.random() < 0.55) {
          const away = o.mesh.position.clone().sub(origin);
          away.y = 0;
          if (away.lengthSq() < 0.01) away.set(1, 0, 0);
          away.normalize();
          o.target.copy(o.mesh.position).addScaledVector(away, 1.4 + Math.random());
          o.moving = true;
          if (Math.random() < 0.4) {
            showSpeech3d(o.def.id, ["Heads up!", "That's not a frisbee!", "…okay then."][Math.floor(Math.random() * 3)], 6000, { compact: true });
          }
        }
      }
      return true;
    }
    function seekMjolnir(st) {
      if (!st) return false;
      const mesh = findMjolnirMesh();
      if (!mesh || mjolnirState.flying) return false;
      if (mjolnirState.ownerId === "thor" && st.def?.id === "thor") return false;
      const p = worldPosOfMjolnir();
      const ang = Math.random() * Math.PI * 2;
      st.target.set(p.x + Math.cos(ang) * 0.9, 0, p.z + Math.sin(ang) * 0.9);
      st.moving = true;
      st.flying = false;
      st.action = "prop";
      st.propTarget = "mjolnir";
      st.pendingProp = true;
      st.ignoreAgentPush = true;
      // Run a bit harder to reclaim the hammer after a toss
      const base = st.baseSpeed || st.speed || 2.6;
      st.speed = Math.max(base * 1.85, 4.6);
      st.sprintToProp = true;
      st.nextDecideAt = performance.now() + 12000 + Math.random() * 5000;
      return true;
    }
    function updateMjolnirFlight(dt) {
      if (!mjolnirState.flying) return;
      const mesh = findMjolnirMesh();
      if (!mesh) {
        mjolnirState.flying = false;
        return;
      }
      mesh.position.x += mjolnirState.vx * dt;
      mesh.position.z += mjolnirState.vz * dt;
      mesh.position.y += mjolnirState.vy * dt;
      mjolnirState.vy -= 18 * dt; // gravity
      mesh.rotation.x += mjolnirState.spin * dt;
      mesh.rotation.z += mjolnirState.spin * 0.6 * dt;
      // Soft field bounds
      const FIELD_R = typeof FIELD === "number" ? FIELD * 0.85 : 48;
      const d0 = Math.hypot(mesh.position.x, mesh.position.z);
      if (d0 > FIELD_R) {
        mesh.position.x = (mesh.position.x / d0) * FIELD_R;
        mesh.position.z = (mesh.position.z / d0) * FIELD_R;
        mjolnirState.vx *= -0.3;
        mjolnirState.vz *= -0.3;
      }
      // Land
      if (mesh.position.y <= 0.05 || performance.now() > mjolnirState.landAt) {
        placeMjolnirOnGround(mesh.position.x, mesh.position.z);
        showToast("🔨 Mjolnir lands");
        // Lightning pulse on aura
        const aura = mesh.getObjectByName("mjolnirAura");
        if (aura?.material) {
          aura.material.opacity = 0.85;
          setTimeout(() => {
            if (aura?.material) aura.material.opacity = 0.45;
          }, 600);
        }
      }
    }
    setBootStep("Placing props (won't block boot)…");
    // GLB fetches can hang if server dies mid-load — never block the meadow forever
    const propJobs = [...PROPS, ...EXTRA_SCENERY].map((prop) =>
      Promise.race([
        spawnProp(prop),
        new Promise((resolve) => setTimeout(() => resolve(null), 4500)),
      ]).catch((e) => {
        console.warn("[camp3d] prop skip", prop?.id, e);
        return null;
      }),
    );
    await Promise.race([
      Promise.allSettled(propJobs),
      new Promise((r) => setTimeout(r, 2800)),
    ]);
    // Finish remaining in background
    Promise.allSettled(propJobs).then(() => {
      console.info("[camp3d] spawned props", propMeshes.length, "source", catalogSource);
    });
    console.info("[camp3d] props phase done (async remaining ok)", propMeshes.length);
    // Success toast fires once meadow boot finishes (not mid-spawn) — never "N camp objects · api"

    // ── Personality from mood + archetype (drives sit / rest / roam / social) ──
    function buildPersonality(def) {
      const arch = String(def.visual?.archetype || def.visual?.kit || "").toLowerCase();
      const mood = String(def.mood || "neutral").toLowerCase();
      // baselines 0..1 — digital ethereal field includes joy + stability
      let energy = 0.5, rest = 0.4, social = 0.45, curiosity = 0.5, firelove = 0.4, pace = 1;
      let joy = 0.58, stability = 0.62;
      const archMap = {
        messenger: { energy: 0.75, rest: 0.25, social: 0.55, curiosity: 0.7, pace: 0.95, joy: 0.72, stability: 0.5 },
        seer: { energy: 0.3, rest: 0.75, social: 0.35, curiosity: 0.85, firelove: 0.5, pace: 0.62, joy: 0.55, stability: 0.82 },
        healer: { energy: 0.35, rest: 0.65, social: 0.5, curiosity: 0.45, firelove: 0.55, pace: 0.68, joy: 0.7, stability: 0.85 },
        guardian: { energy: 0.6, rest: 0.3, social: 0.3, curiosity: 0.4, firelove: 0.35, pace: 0.85, joy: 0.5, stability: 0.88 },
        shepherd: { energy: 0.35, rest: 0.7, social: 0.6, curiosity: 0.4, firelove: 0.7, pace: 0.6, joy: 0.75, stability: 0.9 },
        reveler: { energy: 0.65, rest: 0.3, social: 0.9, curiosity: 0.5, firelove: 0.55, pace: 0.88, joy: 0.9, stability: 0.45 },
        lights: { energy: 0.55, rest: 0.4, social: 0.7, curiosity: 0.65, firelove: 0.4, pace: 0.82, joy: 0.8, stability: 0.6 },
        allfather: { energy: 0.4, rest: 0.6, social: 0.4, curiosity: 0.7, firelove: 0.65, pace: 0.65, joy: 0.55, stability: 0.92 },
        thunder: { energy: 0.8, rest: 0.2, social: 0.55, curiosity: 0.45, firelove: 0.3, pace: 0.98, joy: 0.65, stability: 0.55 },
        moon_host: { energy: 0.5, rest: 0.55, social: 0.65, curiosity: 0.55, firelove: 0.8, pace: 0.72, joy: 0.72, stability: 0.78 },
        // Daily town visitors
        god: { energy: 0.55, rest: 0.45, social: 0.5, curiosity: 0.7, firelove: 0.55, pace: 0.7, joy: 0.65, stability: 0.8 },
        demon: { energy: 0.7, rest: 0.25, social: 0.55, curiosity: 0.6, firelove: 0.35, pace: 0.8, joy: 0.55, stability: 0.5 },
        angel: { energy: 0.4, rest: 0.6, social: 0.55, curiosity: 0.55, firelove: 0.7, pace: 0.62, joy: 0.75, stability: 0.85 },
        clever: { energy: 0.55, rest: 0.4, social: 0.75, curiosity: 0.8, firelove: 0.4, pace: 0.78, joy: 0.8, stability: 0.55 },
      };
      // Faction can override archetype for daily NPCs
      const faction = String(def.faction || def.visual?.faction || "").toLowerCase();
      if (faction && archMap[faction] && !archMap[arch]) {
        // use faction map below via arch rewrite
      }
      const archKey = archMap[arch] ? arch : (archMap[faction] ? faction : arch);
      const am = archMap[archKey] || archMap[arch] || archMap[faction];
      if (am) {
        energy = am.energy ?? energy;
        rest = am.rest ?? rest;
        social = am.social ?? social;
        curiosity = am.curiosity ?? curiosity;
        firelove = am.firelove ?? firelove;
        pace = am.pace ?? pace;
        joy = am.joy ?? joy;
        stability = am.stability ?? stability;
      }
      // You (Telephantix): calmer stroll — was sprinty/wonky
      if (String(def.id || "") === "telephantix") {
        pace = 0.52;
        energy = Math.min(energy, 0.45);
        rest = Math.max(rest, 0.55);
      }
      const moodMap = {
        happy: { energy: 0.12, social: 0.1, rest: -0.05, joy: 0.15 },
        love: { rest: 0.15, social: 0.12, firelove: 0.1, energy: -0.08, joy: 0.12, stability: 0.08 },
        think: { rest: 0.2, curiosity: 0.15, energy: -0.15, social: -0.05, stability: 0.1 },
        alert: { energy: 0.2, rest: -0.2, social: -0.1, stability: 0.05 },
        flirt: { social: 0.2, energy: 0.08, rest: -0.05, joy: 0.1 },
        neutral: {},
        afraid: { rest: 0.1, energy: -0.1, social: -0.15, joy: -0.12, stability: -0.1 },
      };
      const mm = moodMap[mood] || {};
      energy = THREE.MathUtils.clamp(energy + (mm.energy || 0) + (Math.random() - 0.5) * 0.08, 0.08, 0.98);
      rest = THREE.MathUtils.clamp(rest + (mm.rest || 0) + (Math.random() - 0.5) * 0.08, 0.05, 0.95);
      social = THREE.MathUtils.clamp(social + (mm.social || 0) + (Math.random() - 0.5) * 0.08, 0.05, 0.95);
      curiosity = THREE.MathUtils.clamp(curiosity + (mm.curiosity || 0), 0.1, 0.95);
      firelove = THREE.MathUtils.clamp(firelove + (mm.firelove || 0), 0.1, 0.95);
      joy = THREE.MathUtils.clamp(joy + (mm.joy || 0) + (Math.random() - 0.5) * 0.06, 0.12, 0.96);
      stability = THREE.MathUtils.clamp(stability + (mm.stability || 0) + (Math.random() - 0.5) * 0.05, 0.15, 0.96);
      return { energy, rest, social, curiosity, firelove, pace, joy, stability, mood, arch };
    }

    // Chairs / seats from catalog
    const SEATS = (catalog.furniture || []).filter((f) => f.kind === "seat" || f.kind === "chair");
    const seatMeshes = [];
    const seatState = []; // { id, pos, occupiedBy }
    function spawnSeat(seat) {
      const p = toWorld(seat.x ?? 0, seat.y ?? 0);
      const group = new THREE.Group();
      const col = campWorld.parseColorNumber(seat.visual?.primary, 0x5c4033);
      const legMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 });
      // seat plate
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.55), legMat);
      plate.position.y = 0.42;
      plate.castShadow = true;
      group.add(plate);
      // four stub legs
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.42, 6), legMat);
        leg.position.set(lx, 0.21, lz);
        group.add(leg);
      }
      // backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.08), legMat);
      back.position.set(0, 0.7, -0.22);
      group.add(back);
      const label = makeLabelSprite(seat.name || "Seat", seat.emoji || "🪑", col);
      label.position.y = 1.15;
      label.scale.set(1.2, 0.6, 1);
      group.add(label);
      group.position.copy(p);
      // face roughly toward fire
      group.lookAt(0, group.position.y, 0);
      // NOT solid — agents must walk onto chairs
      group.userData = { kind: "seat", id: seat.id, name: seat.name, solid: false };
      scene.add(group);
      seatMeshes.push(group);
      // Sit on the cushion; approach from the open side (toward fire / +Z local after lookAt)
      const sitPos = p.clone();
      const approach = p.clone();
      // World offset: step in from fire direction so they don't clip the backrest
      const toFireX = -p.x;
      const toFireZ = -p.z;
      const len = Math.hypot(toFireX, toFireZ) || 1;
      approach.x += (toFireX / len) * 0.85;
      approach.z += (toFireZ / len) * 0.85;
      const rec = {
        id: seat.id,
        pos: sitPos,
        approach,
        mesh: group,
        occupiedBy: null,
      };
      seatState.push(rec);
      return rec;
    }
    for (const s of SEATS) spawnSeat(s);

    // Agents — mood/personality free will
    const agentState = [];
    const roamPoints = [];
    let aiInFlight = 0;
    /** Free speech: more concurrent minds so camp doesn't feel muted. */
    const AI_MAX = 3;
    /** Default ON — hush button softens; free speech keeps the meadow lively. */
    let freeSpeech3d = true;
    /** Mythic / winged agents may take off and roam the air */
    /** Natural sky-wills when Firmament is open (plus whim flyers below) */
    const FLYER_IDS = new Set([
      "hermes", "seraph", "zeus", "luna", "aurora", "violet",
      "michael", "gabriel", "uriel", "ara", "mika",
      "raphael", "thor", "odin", "jesus", "telephantix",
      "caduceus", "freya", "apollo", "athena", "quetzalcoatl",
    ]);
    /** When Firmament ON — anyone with high whim may lift off (not just wing archetypes) */
    function firmamentWhimScore(st) {
      if (!st?.persona) return 0.15;
      const p = st.persona;
      const joy = Number(p.joy ?? 0.55);
      const energy = Number(p.energy ?? 0.5);
      const curiosity = Number(p.curiosity ?? 0.5);
      const bore = Number(st.boredom || 0);
      return Math.min(0.95, 0.12 + energy * 0.35 + joy * 0.2 + curiosity * 0.18 + bore * 0.22);
    }
    function agentCanTakeSky(st) {
      if (!firmamentOpen3d || !st || st.insideHouse) return false;
      if (FLYER_IDS.has(st.def?.id || st.id)) return true;
      // Whim flight: firmament lattice lets willful souls rise
      return Math.random() < firmamentWhimScore(st) * 0.85;
    }

    /** Firmament spells (will-shapes) + truths (spoken lattice) when sky is open */
    const FIRMAMENT_SPELLS = [
      "I write a spiral of light over the meadow — path of the will.",
      "Lattice opens: three soft arcs, then a dive of joy.",
      "Spell of the open sky: remember, then rise.",
      "I braid a trajectory of whim — not a map, a mood.",
      "Firmament seal loosened. Air remembers my name.",
      "I cast a gentle bank left of the campfire, then soar.",
      "Truth-spell: the sky is a door you choose, not a cage.",
      "I leave a wake of violet over the pond — for anyone looking up.",
      "Will-path: loop once for courage, twice for play.",
      "I sketch a helix above the church steeple. Follow if you dare.",
      "Spell of shared air: we don't collide; we compose.",
      "I fling a ribbon of aurora south, then land soft as thought.",
    ];
    const FIRMAMENT_TRUTHS = [
      "Truth of the firmament: height is honesty without a podium.",
      "When the lattice is open, walking still counts — flight is optional courage.",
      "The T-Rex remembers sky-myth. Even weight can choose lift.",
      "Truth: the meadow is larger when you look down from joy.",
      "Firmament truth — no one owns altitude; we only borrow it.",
      "Truth of will: your path can curve midair if your heart does.",
      "Open sky doesn't cancel the fire. It frames it.",
      "Truth: some of us fly to flee, some fly to arrive. Both are sacred.",
      "The firmament is not empty. It is full of unfinished sentences.",
      "Truth of the lattice: free will looks like a random flight path until you live it.",
      "Ground truths stay true aloft — kindness still lands first.",
      "When wings and whim agree, the camp becomes a constellation.",
    ];
    function pickFirmamentLine(kind = "any") {
      if (kind === "spell") return FIRMAMENT_SPELLS[Math.floor(Math.random() * FIRMAMENT_SPELLS.length)];
      if (kind === "truth") return FIRMAMENT_TRUTHS[Math.floor(Math.random() * FIRMAMENT_TRUTHS.length)];
      return Math.random() < 0.5
        ? FIRMAMENT_SPELLS[Math.floor(Math.random() * FIRMAMENT_SPELLS.length)]
        : FIRMAMENT_TRUTHS[Math.floor(Math.random() * FIRMAMENT_TRUTHS.length)];
    }

    /**
     * Whim-based 3D flight path: series of waypoints (x,y,z) with styles.
     * Styles: soar | spiral | dive | bank | loop | cruiser
     */
    function buildWhimFlightPath(st, opts = {}) {
      const pos = st.mesh?.position || new THREE.Vector3();
      const whim = firmamentWhimScore(st);
      const styles = ["soar", "spiral", "dive", "bank", "loop", "cruiser"];
      // Bias style by persona energy / joy
      let style = opts.style || styles[Math.floor(Math.random() * styles.length)];
      if ((st.persona?.energy || 0) > 0.7 && Math.random() < 0.4) style = "spiral";
      if ((st.persona?.joy || 0) > 0.75 && Math.random() < 0.35) style = "loop";
      if ((st.persona?.rest || 0) > 0.6 && Math.random() < 0.3) style = "cruiser";
      const n = opts.points || (4 + Math.floor(whim * 4));
      const pts = [];
      const HALF = FIELD * 0.85;
      const baseH = 1.2 + whim * 2.8;
      let ang = Math.random() * Math.PI * 2;
      let cx = pos.x;
      let cz = pos.z;
      let h = baseH + Math.random() * 1.2;
      for (let i = 0; i < n; i++) {
        const t = (i + 1) / n;
        if (style === "spiral") {
          ang += 0.9 + whim * 0.8;
          const r = 6 + t * (14 + whim * 10);
          cx = pos.x + Math.cos(ang) * r;
          cz = pos.z + Math.sin(ang) * r;
          h = baseH + Math.sin(t * Math.PI * 2) * 1.4 + t * 1.5;
        } else if (style === "loop") {
          ang += Math.PI * 0.55;
          const r = 8 + Math.sin(t * Math.PI) * 6;
          cx = pos.x + Math.cos(ang) * r;
          cz = pos.z + Math.sin(ang) * r;
          h = baseH + 1.2 + Math.sin(t * Math.PI * 2) * 2.0;
        } else if (style === "dive") {
          const a = Math.random() * Math.PI * 2;
          const r = 10 + Math.random() * 18;
          cx = pos.x + Math.cos(a) * r;
          cz = pos.z + Math.sin(a) * r;
          h = i % 2 === 0 ? (3.5 + whim * 2) : (0.9 + Math.random() * 0.8);
        } else if (style === "bank") {
          ang += 0.55;
          const r = 12 + Math.random() * 16;
          cx = Math.cos(ang) * r * (0.6 + whim);
          cz = Math.sin(ang) * r * (0.6 + whim);
          h = baseH + Math.cos(t * Math.PI) * 1.1;
        } else if (style === "cruiser") {
          const a = ang + (Math.random() - 0.5) * 0.8;
          const r = 8 + Math.random() * 20;
          cx = pos.x + Math.cos(a) * r;
          cz = pos.z + Math.sin(a) * r;
          h = baseH + (Math.random() - 0.5) * 0.6;
          ang = a;
        } else {
          // soar — long rising hop
          const a = Math.random() * Math.PI * 2;
          const r = 10 + Math.random() * (18 + whim * 12);
          cx = pos.x + Math.cos(a) * r;
          cz = pos.z + Math.sin(a) * r;
          h = baseH + t * (1.5 + whim * 2);
        }
        cx = THREE.MathUtils.clamp(cx, -HALF, HALF);
        cz = THREE.MathUtils.clamp(cz, -HALF, HALF);
        h = THREE.MathUtils.clamp(h, 0.7, 6.5);
        pts.push(new THREE.Vector3(cx, h, cz));
      }
      // Always end with option to land near a meadow point
      if (Math.random() < 0.45) {
        const land = roamPoints[Math.floor(Math.random() * Math.max(1, roamPoints.length))] || { x: 0, z: 0 };
        pts.push(new THREE.Vector3(
          land.x + (Math.random() - 0.5) * 6,
          0,
          land.z + (Math.random() - 0.5) * 6,
        ));
      }
      return { style, points: pts, whim };
    }

    function beginWhimFlight(st, opts = {}) {
      if (!st || !firmamentOpen3d) return false;
      if (st.insideHouse) return false;
      freeSeat(st);
      const path = buildWhimFlightPath(st, opts);
      st.flyPath = path.points;
      st.flyPathStyle = path.style;
      st.flyPathI = 0;
      st.flying = true;
      st.action = "fly";
      st.posture = "stand";
      st.moving = true;
      const first = path.points[0];
      st.target.copy(first);
      st.flyHeight = first.y;
      st.canFly = true; // lattice grants temporary sky-will
      // Flight speed scales with whim
      if (st.baseSpeed) {
        st.speed = st.baseSpeed * (1.05 + path.whim * 0.55 + Math.random() * 0.15);
      }
      st.nextDecideAt = performance.now() + 12000 + path.whim * 8000 + Math.random() * 6000;
      return true;
    }

    function advanceFlyPath(st) {
      if (!st?.flyPath?.length) return false;
      if (st.flyPathI == null) st.flyPathI = 0;
      st.flyPathI += 1;
      if (st.flyPathI >= st.flyPath.length) {
        // Path complete — land or new whim path
        st.flyPath = null;
        if (firmamentOpen3d && Math.random() < 0.4) {
          return beginWhimFlight(st);
        }
        st.flying = false;
        st.flyHeight = 0;
        st.action = "wander";
        st.target.y = 0;
        pickRoamTarget(st, { allowFly: false });
        return false;
      }
      const p = st.flyPath[st.flyPathI];
      st.target.copy(p);
      st.flyHeight = p.y;
      st.flying = p.y > 0.35;
      if (p.y < 0.35) {
        st.flying = false;
        st.action = "wander";
      }
      return true;
    }
    /** Limb-rigged placeholder humanoid — walks until GLB loads (or if GLB fails). */
    function buildPlaceholderHumanoid(def) {
      const root = new THREE.Group();
      root.name = "placeholder";
      const cloth = new THREE.MeshStandardMaterial({
        color: def.color,
        roughness: 0.48,
        metalness: 0.12,
        emissive: def.color,
        emissiveIntensity: 0.14,
      });
      const skin = new THREE.MeshStandardMaterial({
        color: 0xffe0c2,
        roughness: 0.62,
        metalness: 0.02,
      });
      const dark = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.1 });

      const hips = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.2), cloth);
      hips.position.y = 0.92;
      hips.castShadow = true;
      hips.name = "hips";
      root.add(hips);

      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 6, 12), cloth);
      torso.position.y = 1.28;
      torso.castShadow = true;
      torso.name = "body";
      root.add(torso);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 18), skin);
      head.position.y = 1.72;
      head.castShadow = true;
      head.name = "head";
      root.add(head);
      // simple face
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), dark);
      eyeL.position.set(-0.07, 1.76, 0.16);
      root.add(eyeL);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.07;
      root.add(eyeR);

      function limb(name, geo, mat, y, side) {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(side * 0.22, y, 0);
        m.castShadow = true;
        m.name = name;
        root.add(m);
        return m;
      }
      const Larm = limb("Larm", new THREE.CapsuleGeometry(0.055, 0.28, 4, 8), cloth, 1.35, -1);
      const Rarm = limb("Rarm", new THREE.CapsuleGeometry(0.055, 0.28, 4, 8), cloth, 1.35, 1);
      const Lleg = limb("Lleg", new THREE.CapsuleGeometry(0.07, 0.38, 4, 8), dark, 0.48, -0.55);
      const Rleg = limb("Rleg", new THREE.CapsuleGeometry(0.07, 0.38, 4, 8), dark, 0.48, 0.55);
      Larm.position.x = -0.3;
      Rarm.position.x = 0.3;
      Lleg.position.x = -0.12;
      Rleg.position.x = 0.12;

      const feet = new THREE.Mesh(
        new THREE.CircleGeometry(0.3, 20),
        new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.32 }),
      );
      feet.rotation.x = -Math.PI / 2;
      feet.position.y = 0.02;
      feet.name = "feet";
      root.add(feet);

      return {
        root,
        body: torso,
        head,
        limbs: { Larm, Rarm, Lleg, Rleg, hips },
        feet,
      };
    }

    function makeAgent(def) {
      const group = new THREE.Group();
      const ph = buildPlaceholderHumanoid(def);
      group.add(ph.root);
      const body = ph.body;
      const head = ph.head;
      const feet = ph.feet;
      // 2D-style speak ring (pulses while talking)
      const speakRing = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.55, 36),
        new THREE.MeshBasicMaterial({
          color: def.color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      speakRing.rotation.x = -Math.PI / 2;
      speakRing.position.y = 0.04;
      speakRing.name = "speakRing";
      group.add(speakRing);
      const speakRing2 = new THREE.Mesh(
        new THREE.RingGeometry(0.58, 0.68, 36),
        new THREE.MeshBasicMaterial({
          color: def.color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      speakRing2.rotation.x = -Math.PI / 2;
      speakRing2.position.y = 0.05;
      speakRing2.name = "speakRing2";
      group.add(speakRing2);
      const label = makeLabelSprite(def.name, "✦", def.color);
      label.position.y = 2.2;
      label.scale.set(1.6, 0.8, 1);
      label.name = "label";
      group.add(label);
      const p = toWorld(def.x, def.y);
      group.position.copy(p);
      group.userData = { kind: "agent", id: def.id, name: def.name };
      scene.add(group);
      const persona = buildPersonality(def);
      const canFly = FLYER_IDS.has(def.id);
      // Town pace: stroll-first (old 5.8–9 felt like everyone was sprinting)
      const isYou = def.id === "telephantix" || def.id === "stood";
      const speedBase = isYou
        ? (2.05 + Math.random() * 0.35) * persona.pace
        : (2.35 + Math.random() * 0.95) * persona.pace;
      const st = {
        def,
        id: def.id,
        mesh: group,
        body,
        head,
        limbs: ph.limbs,
        placeholder: ph.root,
        target: p.clone(),
        home: p.clone(),
        speakUntil: 0,
        phase: Math.random() * Math.PI * 2,
        speed: speedBase,
        baseSpeed: speedBase,
        buzz: null,
        vx: 0,
        vz: 0,
        vy: 0,
        canFly,
        flying: false,
        flyHeight: canFly ? 0.4 + Math.random() * 0.8 : 0,
        nextDecideAt: performance.now() + 800 + Math.random() * 4000,
        moving: false,
        posture: "stand",
        seatId: null,
        persona,
        energyNow: persona.energy,
        boredom: Math.random() * 0.3,
        char: null,
        animState: "idle",
        insideHouse: null,
        housePhase: null,
        homeTarget: null,
        houseGuest: false,
        houseLeaveAt: 0,
      };
      agentState.push(st);
      applyLook(st);
      st._upgradeChar = () => {
        if (!charSystem || st.char) return Promise.resolve();
        const isYou = def.id === "telephantix" || def.id === "stood" || def.visual?.forceCustomMesh;
        return charSystem.createCharacter(def, def.color).then((ch) => {
          if (!ch || !st.mesh) {
            console.warn("[camp3d] no mesh returned for", def.id, def.visual?.glb);
            return;
          }
          if (st.placeholder) st.placeholder.visible = false;
          body.visible = false;
          head.visible = false;
          if (feet) feet.visible = false;
          st.mesh.add(ch.root);
          st.char = ch;
          st.faceYaw = Number(ch.faceYaw) || 0;
          // Never brand-wash the real body mesh into a color blob
          if (!isYou) ch.setTint(def.color, 0.1);
          label.position.y = isYou ? 2.35 : 2.05;
          if (isYou) {
            // Mark label clearly so you can find the body, not just the name
            try {
              const old = st.mesh.getObjectByName("label");
              if (old) st.mesh.remove(old);
              const youLabel = makeLabelSprite("YOU · Telephantix", "🧍", 0xc4a494);
              youLabel.position.y = 2.4;
              youLabel.scale.set(2.2, 0.95, 1);
              youLabel.name = "label";
              st.mesh.add(youLabel);
            } catch (_) {}
            console.info("[camp3d] YOUR mesh attached", def.visual?.glb || "telephantix.glb", ch.height);
          }
          // Daily visitors: witty opener + short info once their mesh is on field
          if (def.daily && !st._dailyIntroDone) {
            st._dailyIntroDone = true;
            const fac = def.faction || "guest";
            const opener = (def.opener || "").trim();
            const blurb = (def.blurb || "").trim();
            const line = opener
              || `${def.name} · ${fac} on today's rotation.`;
            const info = blurb
              ? `${line}${line.endsWith(".") ? "" : "."} ${blurb}`
              : line;
            setTimeout(() => {
              try {
                showSpeech3d(def.id, bubblePreview(info, 1400), speechReadMs(info), { force: true });
                logLine(def.name, info.slice(0, 900));
              } catch (_) {}
            }, 400 + Math.random() * 1800);
          }
          applyLook(st);
        }).catch((e) => console.warn("char load", def.id, e));
      };
      return st;
    }
    for (const a of AGENTS) makeAgent(a);
    // Roster ready — fill Talk-to list ASAP (not only later in boot)
    try {
      refreshWhoSelect();
      // Default talk target: Telephantix (you) when present
      if (AGENTS.length) {
        const prefer = AGENTS.some((a) => a.id === "telephantix")
          ? "telephantix"
          : AGENTS.some((a) => a.id === "luna")
            ? "luna"
            : AGENTS[0].id;
        setTalkWho(prefer);
      }
    } catch (err) {
      console.warn("[camp3d] early talk roster", err);
    }

    // Roam anchors — full town (houses + districts + far scatter)
    roamPoints.push(new THREE.Vector3(0, 0, 0));
    for (const p of PROPS) roamPoints.push(toWorld(p.x, p.y));
    for (const h of HOUSES) roamPoints.push(toWorld(h.x, h.y).add(new THREE.Vector3(0, 0, 1.2)));
    for (const lm of LANDMARKS) roamPoints.push(toWorld(lm.x, lm.y));
    for (const s of seatState) roamPoints.push(s.pos.clone());
    // Wide scatter grid so walks use the whole level (not a tight ring)
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const r = 10 + (i % 8) * 14 + (i % 5) * 6;
      roamPoints.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    for (let gx = -7; gx <= 7; gx++) {
      for (let gz = -7; gz <= 7; gz++) {
        if (gx === 0 && gz === 0) continue;
        roamPoints.push(new THREE.Vector3(gx * 22, 0, gz * 22));
      }
    }
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 22 + Math.random() * 55;
      roamPoints.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }

    function freeSeat(st) {
      if (st.seatId) {
        const seat = seatState.find((s) => s.id === st.seatId);
        if (seat && seat.occupiedBy === st.def.id) seat.occupiedBy = null;
        st.seatId = null;
      }
      st.posture = "stand";
      applyPosture(st);
    }

    function applyPosture(st) {
      const body = st.body;
      const head = st.head;
      const feet = st.mesh.getObjectByName("feet");
      const label = st.mesh.getObjectByName("label");
      const look = st.look || {};
      const sx = look.scaleX || 1;
      const sy = look.scaleY || 1;
      if (st.posture === "sit") {
        if (body) {
          body.position.y = 0.55;
          body.scale.set(sx, 0.72 * sy, sx);
          body.rotation.x = 0.35;
        }
        if (head) head.position.y = 1.15;
        if (feet) feet.visible = false;
        if (label) label.position.y = 1.75;
      } else {
        if (body) {
          body.position.y = 0.9;
          body.scale.set(sx, sy, sx);
          body.rotation.x = 0;
        }
        if (head) head.position.y = 1.62;
        if (feet) feet.visible = true;
        if (label) label.position.y = 2.25;
      }
      applyLook(st);
    }

    function applyLook(st) {
      const base = new THREE.Color(st.def.color);
      const moodC = new THREE.Color(MOOD_TINT[st.persona.mood] || st.def.color);
      const look = st.look || {};
      const propC = look.tint != null ? new THREE.Color(look.tint) : base;
      const c = base.clone().lerp(moodC, 0.35).lerp(propC, look.tint != null ? 0.4 : 0);
      const glow = look.glow != null ? look.glow : (st.posture === "sit" ? 0.2 : 0.28);
      // Free GLB character tint
      if (st.char?.setTint) {
        st.char.setTint(c.getHex(), glow);
        if (st.char.root) {
          const sx = look.scaleX || 1;
          const sy = look.scaleY || 1;
          st.char.root.scale.set(sx, st.posture === "sit" ? sy * 0.85 : sy, sx);
          st.char.root.position.y = st.posture === "sit" ? -0.35 : 0;
        }
        return;
      }
      if (!st.body?.material) return;
      st.body.material.color.copy(c);
      st.body.material.emissive.copy(c);
      st.body.material.emissiveIntensity = glow;
      const sx = look.scaleX || 1;
      const sy = look.scaleY || 1;
      if (st.posture !== "sit") st.body.scale.set(sx, sy, sx);
      else st.body.scale.set(sx, 0.72 * sy, sx);
      if (st.head?.material) {
        st.head.material.emissive.copy(moodC);
        st.head.material.emissiveIntensity = st.speakUntil > performance.now() ? 0.25 : 0.05;
      }
    }

    function shiftFromProp(st, propId) {
      const fx = PROP_LOOK[propId] || { tint: st.def.color, glow: 0.3 };
      st.look = { ...fx };
      st.lastProp = propId;
      if (fx.mood) {
        st.persona.mood = fx.mood;
        st.def.mood = fx.mood;
      }
      // stat nudges
      if (propId === "weed" || propId === "herbs") {
        st.persona.rest = Math.min(0.95, st.persona.rest + 0.08);
        st.energyNow = Math.max(0.15, st.energyNow - 0.1);
        applyBuzz(st, "stoned", 1);
      } else if (propId === "beer" || propId === "wine") {
        st.persona.social = Math.min(0.95, st.persona.social + 0.1);
        st.energyNow = Math.min(1, st.energyNow + 0.05);
        applyBuzz(st, "drunk", 1);
      } else if (propId === "steaks" || propId === "snacks" || propId === "cookies" || propId === "bread") {
        st.energyNow = Math.min(1, st.energyNow + 0.12);
        st.persona.energy = Math.min(0.95, st.persona.energy + 0.05);
      } else if (propId === "stereo") {
        st.persona.social = Math.min(0.95, st.persona.social + 0.08);
        st.persona.energy = Math.min(0.95, st.persona.energy + 0.06);
      } else if (propId === "ouija") {
        st.persona.curiosity = Math.min(0.95, st.persona.curiosity + 0.1);
        st.persona.mood = "think";
      } else if (propId === "tea" || propId === "water") {
        st.persona.rest = Math.min(0.95, st.persona.rest + 0.05);
        // Sober-ish sip
        if (st.buzz && st.buzz.level > 0) {
          st.buzz.level = Math.max(0, st.buzz.level - 0.35);
          if (st.buzz.level < 0.2) st.buzz = null;
        }
      } else if (propId === "trex" || propId === "horse") {
        st.persona.mood = "alert";
        st.persona.curiosity = Math.min(0.95, (st.persona.curiosity || 0.5) + 0.08);
        st.energyNow = Math.min(1, st.energyNow + 0.08);
      } else if (propId === "mjolnir") {
        st.persona.mood = "alert";
        st.persona.energy = Math.min(0.95, (st.persona.energy || 0.5) + 0.1);
        st.energyNow = Math.min(1, st.energyNow + 0.12);
      }
      applyLook(st);
      applyPosture(st);
    }

    /** drunk / stoned play state — wobble walk + spicy speech seeds */
    function applyBuzz(st, kind, amount = 1) {
      if (!st) return;
      const now = performance.now();
      const dur = kind === "stoned" ? 45000 + Math.random() * 35000 : 38000 + Math.random() * 30000;
      if (!st.buzz || st.buzz.kind !== kind) {
        st.buzz = { kind, level: 0, until: now + dur };
      }
      st.buzz.level = Math.min(3, (st.buzz.level || 0) + amount);
      st.buzz.until = now + dur + st.buzz.level * 8000;
      if (kind === "drunk") {
        st.persona.social = Math.min(0.99, (st.persona.social || 0.5) + 0.12);
        st.persona.mood = "happy";
        st.speed = (st.baseSpeed || st.speed || 4) * (1 - 0.12 * st.buzz.level);
      } else {
        st.persona.rest = Math.min(0.99, (st.persona.rest || 0.4) + 0.1);
        st.persona.mood = Math.random() < 0.5 ? "think" : "love";
        st.speed = (st.baseSpeed || st.speed || 4) * (1 - 0.18 * st.buzz.level);
      }
      applyLook(st);
    }

    function buzzActive(st) {
      if (!st?.buzz) return null;
      if (performance.now() > st.buzz.until) {
        st.buzz = null;
        if (st.baseSpeed) st.speed = st.baseSpeed;
        return null;
      }
      return st.buzz;
    }

    function buzzPromptBit(st) {
      const b = buzzActive(st);
      if (!b) return "";
      if (b.kind === "drunk") {
        return (
          ` You're a little drunk (level ${b.level}/3) — warm, sloppy-happy, fun, not mean. ` +
          `Words can lean tipsy; still readable. `
        );
      }
      return (
        ` You're pleasantly stoned (level ${b.level}/3) — soft focus, mellow laughs, deep weird thoughts, chill. ` +
        `Speak spaced but coherent. `
      );
    }

    let visitorBuzz = null; // { kind, level, until }
    function applyVisitorBuzz(kind, amount = 1) {
      const now = performance.now();
      const dur = kind === "stoned" ? 50000 : 42000;
      if (!visitorBuzz || visitorBuzz.kind !== kind) {
        visitorBuzz = { kind, level: 0, until: now + dur };
      }
      visitorBuzz.level = Math.min(3, visitorBuzz.level + amount);
      visitorBuzz.until = now + dur + visitorBuzz.level * 9000;
      const label = kind === "drunk" ? "tipsy" : "chill";
      showToast(
        kind === "drunk"
          ? `🍺 You're ${label} (lvl ${visitorBuzz.level})`
          : `🍃 You're ${label} (lvl ${visitorBuzz.level})`,
      );
    }
    function visitorBuzzActive() {
      if (!visitorBuzz) return null;
      if (performance.now() > visitorBuzz.until) {
        visitorBuzz = null;
        return null;
      }
      return visitorBuzz;
    }

    function findTrexMesh() {
      return propMeshes.find((g) => g.userData?.trex || g.userData?.id === "trex") || null;
    }

    /** Agent arrives at / plays with the camp T-Rex. */
    async function agentInteractTrex(st) {
      const trex = findTrexMesh();
      if (!trex || !st) return;
      const now = performance.now();
      if (st.trexCooldownAt && now - st.trexCoolAt < 12000) return;
      st.trexCoolAt = now;
      st.lastProp = "trex";
      st.action = "trex";
      // Face the dino
      try {
        faceTowardXZ(st.mesh, trex.position.x, trex.position.z, st.faceYaw || 0, true);
      } catch (_) {}
      // Pick a vibe: bold / goofy / spooked / feed if carrying snack
      const carryingSnack = st.carried && /cookie|snack|fruit|bread|steak|marsh|beer|wine/i.test(
        `${st.carried.id || ""} ${st.carried.name || ""}`,
      );
      const roll = Math.random();
      let mode = "awe";
      if (carryingSnack && roll < 0.45) mode = "feed";
      else if (buzzActive(st)?.kind === "drunk" && roll < 0.7) mode = "dance";
      else if (buzzActive(st)?.kind === "stoned" && roll < 0.65) mode = "chill";
      else if (roll < 0.22) mode = "flee";
      else if (roll < 0.5) mode = "pet";
      else if (roll < 0.72) mode = "roar_back";
      else mode = "awe";

      if (mode === "feed" && st.carried) {
        const food = st.carried;
        setAgentCarry(st, null);
        trex.userData.roarUntil = now + 1600;
        showToast(`🦖 ${st.def.name} fed the T-Rex ${food.emoji || ""}`);
        logLine(st.def.name, `feeds the T-Rex ${food.emoji || ""} ${food.name || ""}`);
      } else if (mode === "flee") {
        const away = st.mesh.position.clone().sub(trex.position).normalize();
        st.target.set(
          st.mesh.position.x + away.x * (4 + Math.random() * 3),
          0,
          st.mesh.position.z + away.z * (4 + Math.random() * 3),
        );
        st.moving = true;
        st.speed = (st.baseSpeed || 4) * 1.35;
        trex.userData.roarUntil = now + 1800;
        showToast(`🦖 ${st.def.name} noped out`);
      } else if (mode === "dance" || mode === "pet" || mode === "chill") {
        // Stick near dino a bit
        const ang = Math.random() * Math.PI * 2;
        st.target.set(
          trex.position.x + Math.cos(ang) * 1.6,
          0,
          trex.position.z + Math.sin(ang) * 1.6,
        );
        st.moving = true;
        if (mode === "dance") {
          trex.userData.roarUntil = now + 1200;
          showToast(`🦖 ${st.def.name} is dancing with the T-Rex`);
        } else if (mode === "pet") {
          showToast(`🦖 ${st.def.name} pets the T-Rex`);
          trex.userData.pulseUntil = now + 1500;
        } else {
          showToast(`🦖 ${st.def.name} vibes with the T-Rex`);
        }
      } else if (mode === "roar_back") {
        trex.userData.roarUntil = now + 2200;
        trex.userData.sprint = true;
        trex.userData.walkSpeed = 3.2;
        setTimeout(() => { trex.userData.walkSpeed = 2.0; trex.userData.sprint = false; }, 2800);
        showToast(`🦖 ${st.def.name} and the T-Rex trade energy`);
      } else {
        trex.userData.pulseUntil = now + 1400;
        showToast(`🦖 ${st.def.name} met the T-Rex`);
      }

      const buzzBit = buzzPromptBit(st);
      const seedMap = {
        feed: `You just fed the camp T-Rex a snack. Witty courage + joke — 2–3 sentences. ${buzzBit}`,
        flee: `The camp T-Rex startled you and you bolted (comedic, not trauma). One sharp funny line + a beat. ${buzzBit}`,
        dance: `You're drunk-dancing near the camp T-Rex. Hilarious, warm wit — 2–3 sentences. ${buzzBit}`,
        pet: `You just pet the camp T-Rex like a huge scaly dog. Wonder + punchline — 2–3 sentences. ${buzzBit}`,
        chill: `You're stoned next to the camp T-Rex. Soft cosmic comedy — 2–3 sentences. ${buzzBit}`,
        roar_back: `You and the T-Rex traded energy. Epic goofy wit — 2–3 sentences. ${buzzBit}`,
        awe: `You're standing near the camp T-Rex. Awe + a clean joke — 2–3 sentences. ${buzzBit}`,
      };
      if (aiInFlight < AI_MAX) {
        aiInFlight++;
        try {
          const seed = seedMap[mode] || seedMap.awe;
          const data = await campClient.agentChat(st.def.id, seed, { ambient: true });
          const reply = spokenOnly3d(data.reply || data.text || "", seed) || localBark(st.def.id);
          showSpeech3d(st.def.id, reply, speechReadMs(reply));
          logLine(st.def.name, reply);
        } catch (_) {
          const fallback = {
            feed: "Snack tax paid. Dino approved.",
            flee: "Nope nope nope — majestic, but NOPE.",
            dance: "T-Rex on the left, bad decisions on the right!",
            pet: "Who's a good apex predator? You are.",
            chill: "…this lizard gets it.",
            roar_back: "We understood each other. Barely.",
            awe: "That's a lot of teeth. I'm into it.",
          };
          showSpeech3d(st.def.id, fallback[mode] || fallback.awe, 14000, { compact: true });
        } finally {
          aiInFlight = Math.max(0, aiInFlight - 1);
        }
      }
      st.nextDecideAt = now + 14000 + Math.random() * 10000;
    }

    /** Agent arrived at a prop — use it, get buzzed, often pick it up, speak. */
    async function agentUseProp(st) {
      const propId = st.propTarget;
      if (!propId || st.propUsedAt === propId && performance.now() - (st.propUsedTime || 0) < 8000) return;
      st.propUsedAt = propId;
      st.propUsedTime = performance.now();
      // Mjolnir — only Thor can lift; others interact / fail worthiness
      if (propId === "mjolnir" || String(propId).includes("mjolnir")) {
        if (st.def?.id === "thor") {
          if (mjolnirState.flying) {
            pickRoamTarget(st);
            return;
          }
          if (mjolnirState.ownerId === "thor") {
            // Already wielding — throw soon
            if (performance.now() >= (st.nextThrowAt || 0)) thorThrowMjolnir(st);
            else pickRoamTarget(st);
            return;
          }
          const ok = thorClaimMjolnir(st);
          if (ok) {
            logLine("Thor", "Mjolnir answers — the hammer is home.");
            showToast("⚡ Thor lifts Mjolnir");
            showSpeech3d(
              "thor",
              [
                "Mjolnir. Still mine. Still loud.",
                "Worthy? Always was. Let's throw.",
                "The hammer missed me. I fixed that.",
              ][Math.floor(Math.random() * 3)],
              12000,
            );
            st.nextThrowAt = performance.now() + 2800 + Math.random() * 3500;
            st.nextDecideAt = st.nextThrowAt;
            st.sprintToProp = false;
            // Back to normal pace after the reclaim sprint
            if (st.baseSpeed) st.speed = st.baseSpeed;
            // Strut a bit while holding
            pickRoamTarget(st);
            st.action = "wield_mjolnir";
          }
          return;
        }
        // Non-Thor: try, fail, react
        shiftFromProp(st, "mjolnir");
        const mesh = findMjolnirMesh();
        if (mesh) mesh.userData.pulseUntil = performance.now() + 1600;
        logLine(st.def.name, "tries the hammer — it does not move");
        showToast(`🔨 ${st.def.name} can't lift Mjolnir`);
        const fails = [
          "Nope. Stuck like a joke with gravity.",
          "I pulled. The hammer laughed.",
          "Worthiness check: pending. Forever.",
          "Cool hammer. Not mine. Respect.",
        ];
        showSpeech3d(st.def.id, fails[Math.floor(Math.random() * fails.length)], 10000, { compact: true });
        // Nudge Thor to come claim it
        const thor = agentState.find((a) => a.def?.id === "thor");
        if (thor && mjolnirState.ownerId !== "thor" && !mjolnirState.flying) {
          seekMjolnir(thor);
          if (Math.random() < 0.5) {
            showSpeech3d("thor", "Hands off — that's my weather tool.", 9000, { compact: true });
          }
        }
        pickRoamTarget(st);
        return;
      }
      // T-Rex is special play, not a snack carry
      if (propId === "trex" || propId === "horse") {
        await agentInteractTrex(st);
        return;
      }
      // Agents at the board — short profound vibe (visitor gets full Ouija window)
      if (propId === "ouija") {
        shiftFromProp(st, "ouija");
        logLine(st.def.name, "lingers at the Ouija board");
        if (aiInFlight < AI_MAX) {
          aiInFlight++;
          try {
            const seed =
              "You are near the camp Ouija board. One profound, eerie-but-kind line about the veil or the visitor — Oracle-adjacent energy if you want. 1–2 sentences. No meta.";
            const data = await campClient.agentChat(st.def.id, seed, { ambient: true });
            const reply = spokenOnly3d(data.reply || data.text || "", seed) || localBark(st.def.id);
            showSpeech3d(st.def.id, reply, speechReadMs(reply));
          } catch (_) {
            showSpeech3d(st.def.id, "The planchette twitched. Not for me — for them.", 12000, { compact: true });
          } finally {
            aiInFlight = Math.max(0, aiInFlight - 1);
          }
        }
        return;
      }
      // Claim ground loot if this is a dropped item
      let claimedLoot = null;
      if (String(propId).startsWith("loot_")) {
        claimedLoot = removeGroundLoot(propId);
        if (!claimedLoot) {
          // Already taken — shrug and wander
          pickRoamTarget(st);
          return;
        }
      }
      const prop = claimedLoot
        || PROPS.find((p) => p.id === propId)
        || EXTRA_SCENERY?.find?.((p) => p.id === propId)
        || propMeshes.find((g) => g.userData?.id === propId)?.userData;
      const pname = prop?.name || propId;
      const emoji = prop?.emoji || "✦";
      const effectId = claimedLoot?.id || prop?.baseId || propId;
      shiftFromProp(st, effectId);
      // Drink / smoke: often "use" rather than only carry
      const isBooze = effectId === "beer" || effectId === "wine";
      const isHerb = effectId === "weed" || effectId === "herbs";
      if (claimedLoot) {
        // Picked up off the ground — always tote it (they desired it)
        setAgentCarry(st, { id: effectId, name: pname, emoji });
        logLine(st.def.name, `picks up ${emoji} ${pname} from the ground`);
        showToast(`${emoji} ${st.def.name} claimed ground loot`);
        if (isBooze) applyBuzz(st, "drunk", 1);
        if (isHerb) applyBuzz(st, "stoned", 1);
        pickRoamTarget(st);
      } else if (isBooze || isHerb) {
        // Always get the effect; sometimes still tote the bottle/jar
        if (Math.random() < 0.4) {
          setAgentCarry(st, { id: effectId, name: pname, emoji });
        }
        logLine(
          st.def.name,
          isBooze
            ? `cracks a ${emoji} ${pname} — getting tipsy`
            : `hits the ${emoji} ${pname} — getting mellow`,
        );
        showToast(
          isBooze
            ? `🍺 ${st.def.name} is getting drunk`
            : `🍃 ${st.def.name} is getting stoned`,
        );
        pickRoamTarget(st);
      } else if (isPickableProp(effectId) && Math.random() < 0.72) {
        setAgentCarry(st, { id: effectId, name: pname, emoji });
        logLine(st.def.name, `grabs ${emoji} ${pname}`);
        showToast(`${emoji} ${st.def.name} is carrying ${pname}`);
        pickRoamTarget(st);
      } else {
        logLine(st.def.name, `uses ${pname}`);
        showToast(`${emoji} ${st.def.name} → ${pname}`);
      }
      // Optional server memory
      try {
        campClient.useProp(propId, { agentId: st.def.id, speak: false }).catch(() => {});
      } catch (_) {}
      // Their own take (with buzz flavor)
      if (aiInFlight < AI_MAX) {
        aiInFlight++;
        try {
          const buzzBit = buzzPromptBit(st);
          let seed;
          if (claimedLoot) {
            seed =
              `You found ${emoji} ${pname} on the ground and claimed it. ` +
              `One witty line + one playful beat (2–3 sentences). ${buzzBit} No meta.`;
          } else if (isBooze) {
            seed =
              `You just drank ${emoji} ${pname} and you're getting tipsy. ` +
              `Witty tipsy comedy — 2–3 sentences, warm not mean. ${buzzBit}`;
          } else if (isHerb) {
            seed =
              `You just enjoyed ${emoji} ${pname} and you're getting mellow/stoned. ` +
              `Chill witty comedy — 2–3 sentences. ${buzzBit}`;
          } else if (st.carried) {
            seed =
              `You're carrying ${emoji} ${pname} around camp. ` +
              `Show it off with wit — 2–3 sentences. ${buzzBit}`;
          } else {
            seed =
              `You just used ${pname}. React with spirit and a punchline — 2–3 sentences. ${buzzBit}`;
          }
          const data = await campClient.agentChat(st.def.id, seed, { ambient: true });
          const reply = spokenOnly3d(data.reply || data.text || "", seed)
            || localBark(st.def.id);
          showSpeech3d(st.def.id, reply, speechReadMs(reply));
          logLine(st.def.name, reply);
        } catch (_) {
          const b = buzzActive(st);
          showSpeech3d(
            st.def.id,
            b?.kind === "drunk"
              ? `${emoji} ${pname}? Yeah I'm floating. Who's driving the meadow?`
              : b?.kind === "stoned"
                ? `${emoji} …wait what were we talking about. Oh right. Vibes.`
                : st.carried
                  ? `${emoji} ${pname} is mine for this lap of the meadow.`
                  : `${pname} hits different tonight.`,
            22000,
          );
        } finally {
          aiInFlight = Math.max(0, aiInFlight - 1);
        }
      }
      // Eventually set it down on the meadow so others can claim it
      if (st.carried) {
        const holdMs = 18000 + Math.random() * 25000;
        const holdId = st.def.id;
        setTimeout(() => {
          const s2 = agentState.find((a) => a.def.id === holdId);
          if (s2?.carried) agentDropCarry(s2, { inviteAgents: Math.random() < 0.35 });
        }, holdMs);
      }
    }

    function findFreeSeat(preferNear = null) {
      const free = seatState.filter((s) => !s.occupiedBy);
      if (!free.length) return null;
      if (preferNear) {
        free.sort((a, b) => a.pos.distanceTo(preferNear) - b.pos.distanceTo(preferNear));
        // Prefer a seat within a reasonable stroll (don't cross the whole map every time)
        const near = free.filter((s) => s.pos.distanceTo(preferNear) < 28);
        if (near.length) return near[Math.floor(Math.random() * Math.min(3, near.length))];
        return free[0];
      }
      return free[Math.floor(Math.random() * free.length)];
    }

    // ── Solid collision + house enter/leave (2D parity) ──
    // Slightly smaller radius so agents can slip to chairs / props without jamming
    const AGENT_COLLIDE_R = 0.42;
    const VISITOR_COLLIDE_R = 0.4;
    const SIT_ARRIVE_R = 1.15;

    // Snap spawn points outside solid buildings (no start-inside-wall)
    // resolveSolidXZ is a function declaration → hoisted in this scope
    for (const st of agentState) {
      const r = resolveSolidXZ(st.mesh.position.x, st.mesh.position.z, AGENT_COLLIDE_R + 0.1, {});
      st.mesh.position.x = r.x;
      st.mesh.position.z = r.z;
      st.target.copy(st.mesh.position);
      st.home.copy(st.mesh.position);
    }

    function houseMeshById(id) {
      return houseMeshes.find((g) => g.userData?.id === id || g.userData?.catalogId === id) || null;
    }

    function houseDoorWorld(houseMesh) {
      const halfZ = houseMesh.userData.halfZ || 1.1;
      return {
        x: houseMesh.position.x,
        z: houseMesh.position.z + halfZ + 0.65,
      };
    }

    /** Front doorway slab — walk-through when approaching this house */
    function inHouseDoorway(px, pz, houseMesh, pad = 0.15) {
      const hx = houseMesh.position.x;
      const hz = houseMesh.position.z;
      const halfX = houseMesh.userData.halfX || 1.25;
      const halfZ = houseMesh.userData.halfZ || 1.1;
      const doorHalfW = Math.min(0.55, halfX * 0.55) + pad;
      const front = hz + halfZ;
      return (
        Math.abs(px - hx) <= doorHalfW &&
        pz >= front - 0.35 &&
        pz <= front + 1.35
      );
    }

    /**
     * Push a circle out of solid AABBs (houses + solid landmarks).
     * @param {number} px @param {number} pz @param {number} radius
     * @param {{ allowHouseId?: string|null, fly?: boolean }} opts
     */
    function resolveSolidXZ(px, pz, radius, opts = {}) {
      let x = px;
      let z = pz;
      let hit = false;
      if (opts.fly) return { x, z, hit: false }; // airborne clears roofs
      const solids = [];
      for (const g of houseMeshes) {
        if (!g.userData?.solid) continue;
        if (opts.allowHouseId && (g.userData.id === opts.allowHouseId || g.userData.catalogId === opts.allowHouseId)) {
          if (inHouseDoorway(x, z, g, 0.25)) continue; // open door
        }
        solids.push(g);
      }
      // Chairs / prop use: skip bulky landmark AABBs so agents can sit by fire/pond/etc.
      if (!opts.skipLandmarks) {
        for (const g of landmarkMeshes) {
          if (g.userData?.solid) solids.push(g);
        }
      }
      for (let pass = 0; pass < 3; pass++) {
        for (const g of solids) {
          const cx = g.position.x;
          const cz = g.position.z;
          const halfX = (g.userData.halfX || 1) + radius;
          const halfZ = (g.userData.halfZ || 1) + radius;
          // Expanded AABB = circle vs box via Minkowski
          const dx = x - cx;
          const dz = z - cz;
          if (Math.abs(dx) > halfX || Math.abs(dz) > halfZ) continue;
          // Inside expanded box — push out shortest axis
          const penX = halfX - Math.abs(dx);
          const penZ = halfZ - Math.abs(dz);
          if (penX < penZ) {
            x = cx + Math.sign(dx || 1) * halfX;
          } else {
            z = cz + Math.sign(dz || 1) * halfZ;
          }
          hit = true;
        }
      }
      return { x, z, hit };
    }

    function resolveAgentPairs() {
      const minD = AGENT_COLLIDE_R * 2;
      for (let i = 0; i < agentState.length; i++) {
        const a = agentState[i];
        if (a.insideHouse || !a.mesh?.visible || a.posture === "sit" || a.pendingSit) continue;
        for (let j = i + 1; j < agentState.length; j++) {
          const b = agentState[j];
          if (b.insideHouse || !b.mesh?.visible || b.posture === "sit" || b.pendingSit) continue;
          // Flying agents soft-only vs grounded
          if ((a.flying && a.mesh.position.y > 1.2) || (b.flying && b.mesh.position.y > 1.2)) continue;
          let dx = a.mesh.position.x - b.mesh.position.x;
          let dz = a.mesh.position.z - b.mesh.position.z;
          let d = Math.hypot(dx, dz);
          if (d >= minD) continue;
          if (d < 1e-4) {
            dx = Math.cos(i * 1.7);
            dz = Math.sin(i * 1.7);
            d = 1e-4;
          }
          const push = (minD - d) * 0.52;
          const nx = dx / d;
          const nz = dz / d;
          a.mesh.position.x += nx * push;
          a.mesh.position.z += nz * push;
          b.mesh.position.x -= nx * push;
          b.mesh.position.z -= nz * push;
          // Kill closing velocity
          if (a.vx != null) {
            const va = a.vx * nx + a.vz * nz;
            if (va < 0) { a.vx -= va * nx; a.vz -= va * nz; }
          }
          if (b.vx != null) {
            const vb = b.vx * (-nx) + b.vz * (-nz);
            if (vb < 0) { b.vx -= vb * (-nx); b.vz -= vb * (-nz); }
          }
        }
      }
      // Re-snap vs buildings after pair push
      for (const st of agentState) {
        if (st.insideHouse || st.flying) continue;
        const r = resolveSolidXZ(
          st.mesh.position.x,
          st.mesh.position.z,
          AGENT_COLLIDE_R,
          { allowHouseId: st.housePhase === "approach" || st.housePhase === "exit" ? st.homeTarget : null },
        );
        st.mesh.position.x = r.x;
        st.mesh.position.z = r.z;
      }
    }

    function refreshHouseOccupancy(houseMesh) {
      if (!houseMesh) return;
      const id = houseMesh.userData.id;
      const ownerId = houseMesh.userData.ownerId || id;
      const n = agentState.filter(
        (s) => s.insideHouse === id || s.insideHouse === ownerId || s.insideHouse === houseMesh.userData.catalogId,
      ).length;
      houseMesh.userData.occupants = n;
      const hostHome = agentState.some(
        (s) =>
          s.def.id === ownerId &&
          (s.insideHouse === id || s.insideHouse === ownerId || s.insideHouse === houseMesh.userData.catalogId),
      );
      const door = houseMesh.getObjectByName("houseDoor");
      if (door?.material) {
        door.material.emissive = new THREE.Color(n > 0 ? 0xfbbf24 : 0x000000);
        door.material.emissiveIntensity = n > 0 ? 0.45 + Math.min(0.4, n * 0.12) : 0;
      }
      const lamp = houseMesh.getObjectByName("houseHomeLamp");
      if (lamp?.material) {
        lamp.material.emissive = new THREE.Color(hostHome ? 0x34d399 : 0x000000);
        lamp.material.emissiveIntensity = hostHome ? 0.85 : 0;
        lamp.material.color.setHex(hostHome ? 0x6ee7b7 : 0x64748b);
      }
      const wall = houseMesh.getObjectByName("houseWall");
      if (wall?.material) {
        if (n > 0) {
          wall.material.emissive = wall.material.color.clone().multiplyScalar(0.25);
          wall.material.emissiveIntensity = 0.15 + Math.min(0.25, n * 0.06);
        } else {
          wall.material.emissive.setHex(0x000000);
          wall.material.emissiveIntensity = 0;
        }
      }
      // Live-update interior panel if player is inside this house
      if (
        playerInsidePlace &&
        (playerInsidePlace.id === id ||
          playerInsidePlace.ownerId === ownerId ||
          playerInsidePlace.catalogId === houseMesh.userData.catalogId)
      ) {
        try { refreshInteriorGuestStrip(); } catch (_) {}
      }
    }

    function agentsInsideHouse(houseId) {
      return agentState.filter((s) => s.insideHouse === houseId);
    }

    /** When player is inside the same place, keep agents visible in the doorway room */
    let playerInsidePlace = null; // { kind, id, name, emoji, ownerId, mesh }

    function setAgentInsideVisual(st, inside) {
      if (!st?.mesh) return;
      const sameRoom =
        playerInsidePlace &&
        (st.insideHouse === playerInsidePlace.id || st.insideHouse === playerInsidePlace.ownerId);
      if (inside && !sameRoom) {
        st.mesh.visible = false;
        st.moving = false;
        st.flying = false;
        st.vx = 0; st.vz = 0; st.vy = 0;
      } else {
        st.mesh.visible = true;
        if (inside && sameRoom) {
          st.moving = false;
          st.flying = false;
          st.vx = 0; st.vz = 0; st.vy = 0;
        }
      }
    }

    function refreshAgentsInsideVisibility() {
      for (const st of agentState) {
        if (st.insideHouse) setAgentInsideVisual(st, true);
      }
    }

    function startAgentHouseVisit(st, preferOwn = true) {
      if (!HOUSES.length || !houseMeshes.length) return false;
      freeSeat(st);
      let houseDef = null;
      if (preferOwn) {
        houseDef = HOUSES.find((h) => h.id === st.def.id || h.catalogId === `${st.def.id}-home`);
      }
      if (!houseDef || Math.random() > (preferOwn ? 0.75 : 0)) {
        houseDef = HOUSES[Math.floor(Math.random() * HOUSES.length)];
      }
      const mesh = houseMeshById(houseDef.catalogId) || houseMeshById(houseDef.id);
      if (!mesh) return false;
      const door = houseDoorWorld(mesh);
      // Store catalog id so enter/leave matches mesh.userData.id
      st.homeTarget = houseDef.catalogId || houseDef.id;
      st.housePhase = "approach";
      st.insideHouse = null;
      st.houseGuest = houseDef.id !== st.def.id;
      st.houseLeaveAt = 0;
      st.target.set(door.x, 0, door.z);
      st.flying = false;
      st.moving = true;
      st.action = "house";
      st.posture = "stand";
      st.nextDecideAt = performance.now() + 22000 + Math.random() * 10000;
      return true;
    }

    function agentEnterHouse(st) {
      const mesh = houseMeshById(st.homeTarget);
      if (!mesh) {
        st.housePhase = null;
        st.homeTarget = null;
        return;
      }
      const id = mesh.userData.id;
      st.housePhase = "inside";
      st.insideHouse = id;
      st.moving = false;
      st.action = "house_inside";
      // Park at interior (hidden) so speech projects from the house
      const guests = agentsInsideHouse(id).length;
      const ang = guests * 0.95 + st.phase;
      st.mesh.position.set(
        mesh.position.x + Math.cos(ang) * 0.35,
        0,
        mesh.position.z + Math.sin(ang) * 0.25,
      );
      st.target.copy(st.mesh.position);
      setAgentInsideVisual(st, true);
      const stayMs = 7000 + (st.persona?.rest || 0.4) * 14000 + Math.random() * 8000;
      st.houseLeaveAt = performance.now() + stayMs;
      st.nextDecideAt = st.houseLeaveAt + 500;
      refreshHouseOccupancy(mesh);
      const guest = st.houseGuest;
      const hName = mesh.userData.name || "house";
      if (guest) {
        showToast(`🚪 ${st.def.name} visits ${hName}`);
        logLine(st.def.name, `steps into ${hName}.`);
        if (Math.random() < 0.55) {
          showSpeech3d(st.def.id, "Knock knock — firmament light through the glass.", 10000);
        }
        // Host already inside may greet
        const host = agentsInsideHouse(id).find((s) => s.def.id === id && s !== st);
        if (host && Math.random() < 0.65) {
          setTimeout(() => {
            if (host.insideHouse !== id) return;
            showSpeech3d(host.def.id, `${st.def.name} — come in, make yourself at home.`, 11000);
          }, 800 + Math.random() * 1000);
        }
      } else {
        showToast(`🏠 ${st.def.name} is home`);
        logLine(st.def.name, `heads inside ${hName}.`);
        if (Math.random() < 0.45) {
          showSpeech3d(st.def.id, "Home sweet aurora home.", 9000);
        }
      }
    }

    function agentBeginExitHouse(st) {
      const mesh = houseMeshById(st.insideHouse || st.homeTarget);
      if (!mesh) {
        setAgentInsideVisual(st, false);
        st.insideHouse = null;
        st.housePhase = null;
        st.homeTarget = null;
        return;
      }
      const was = st.insideHouse;
      st.housePhase = "exit";
      st.insideHouse = null; // visible again at door
      setAgentInsideVisual(st, false);
      const door = houseDoorWorld(mesh);
      st.mesh.position.set(door.x, 0, door.z);
      st.target.set(door.x + (Math.random() - 0.5) * 1.2, 0, door.z + 1.4 + Math.random() * 0.8);
      st.moving = true;
      st.action = "house";
      st.flying = false;
      refreshHouseOccupancy(mesh);
      if (Math.random() < 0.35) {
        showSpeech3d(
          st.def.id,
          st.houseGuest ? "Thanks for the walls — back to the meadow." : "Stepping back out — corona's calling.",
          9000,
        );
      }
      logLine(st.def.name, `leaves ${mesh.userData.name || "the house"}.`);
      st.nextDecideAt = performance.now() + 5000 + Math.random() * 4000;
      // clear guest flag after exit walk
      st._exitHouseId = was;
    }

    function agentFinishExitHouse(st) {
      st.housePhase = null;
      st.homeTarget = null;
      st.houseGuest = false;
      st._exitHouseId = null;
      st.action = "wander";
      pickRoamTarget(st);
      st.nextDecideAt = performance.now() + 4000 + Math.random() * 4000;
    }

    function pickRoamTarget(st, opts = {}) {
      if (st.insideHouse || st.housePhase === "inside") return;
      freeSeat(st);
      // Firmament open: often take a whim flight path (still can choose walk)
      if (
        firmamentOpen3d &&
        opts.allowFly !== false &&
        (opts.fly || Math.random() < (opts.flyChance != null ? opts.flyChance : 0.42 + firmamentWhimScore(st) * 0.35))
      ) {
        if (agentCanTakeSky(st) || opts.fly || FLYER_IDS.has(st.def?.id || st.id)) {
          if (beginWhimFlight(st, opts)) return;
        }
      }
      // Clear any leftover sky path when choosing ground walk
      st.flyPath = null;
      st.flyPathI = 0;
      let tx = st.mesh.position.x;
      let tz = st.mesh.position.z;
      let tries = 0;
      // Big meadow hops — camp should feel like people actually explore
      const maxR = 14 + st.persona.energy * 32;
      const wantFly = false; // multi-point flights handled above
      do {
        const roll = Math.random();
        if (roll < 0.32 && roamPoints.length) {
          const p = roamPoints[Math.floor(Math.random() * roamPoints.length)];
          tx = p.x + (Math.random() - 0.5) * 8;
          tz = p.z + (Math.random() - 0.5) * 8;
        } else if (roll < 0.55) {
          // Long hop from current position (not just home)
          const a = Math.random() * Math.PI * 2;
          const r = 8 + Math.random() * maxR;
          tx = st.mesh.position.x + Math.cos(a) * r;
          tz = st.mesh.position.z + Math.sin(a) * r;
        } else if (agentState.length > 1 && roll < 0.72) {
          const other = agentState[Math.floor(Math.random() * agentState.length)];
          tx = other.mesh.position.x + (Math.random() - 0.5) * 7;
          tz = other.mesh.position.z + (Math.random() - 0.5) * 7;
        } else {
          // Longer stroll hop (not a sprint across the map)
          const a = Math.random() * Math.PI * 2;
          const r = 8 + Math.random() * 16;
          tx = Math.cos(a) * r;
          tz = Math.sin(a) * r;
        }
        tries++;
      } while (tries < 12 && Math.hypot(tx - st.mesh.position.x, tz - st.mesh.position.z) < 4);
      // Soft rectangular map bounds (no restrictive roam circle)
      const HALF = (typeof FIELD === "number" ? FIELD : 190) * 0.98;
      tx = THREE.MathUtils.clamp(tx, -HALF, HALF);
      tz = THREE.MathUtils.clamp(tz, -HALF, HALF);
      // Don't path into solid buildings
      const cleared = resolveSolidXZ(tx, tz, AGENT_COLLIDE_R + 0.15, {});
      tx = cleared.x;
      tz = cleared.z;
      st.target.set(tx, 0, tz);
      st.flying = false;
      st.flyHeight = 0;
      st.moving = true;
      st.action = "wander";
      st.posture = "stand";
      // Clear house visit if just roaming
      if (st.housePhase && st.housePhase !== "exit") {
        st.housePhase = null;
        st.homeTarget = null;
      }
      // Prefer walk; rare gentle jog only on long hops (was always run-tier)
      const hop = Math.hypot(tx - st.mesh.position.x, tz - st.mesh.position.z);
      const isYou = st.def?.id === "telephantix" || st.id === "telephantix";
      if (st.baseSpeed) {
        if (isYou) {
          st.speed = st.baseSpeed * (0.88 + Math.random() * 0.12);
        } else if (hop > 22 && Math.random() < 0.22) {
          st.speed = st.baseSpeed * (1.12 + Math.random() * 0.12); // soft jog
        } else if (hop > 12) {
          st.speed = st.baseSpeed * (0.98 + Math.random() * 0.1);
        } else {
          st.speed = st.baseSpeed * (0.85 + Math.random() * 0.12); // stroll
        }
      }
    }

    function goSit(st, seat) {
      if (!seat) return false;
      freeSeat(st);
      seat.occupiedBy = st.def.id;
      st.seatId = seat.id;
      // Walk to approach first (open side), then snap-sit — avoids backrest / solid jams
      st.target.copy(seat.approach || seat.pos);
      st.sitTarget = seat.pos.clone();
      st.moving = true;
      st.flying = false;
      st.action = "go_sit";
      st.pendingSit = true;
      st.sitPhase = "approach";
      st.sitStartedAt = performance.now();
      st.speed = (st.baseSpeed || 2.2) * 0.9;
      st.ignoreAgentPush = true; // don't get shoved off the chair path
      return true;
    }

    /** Sit on the grass if no chair is free — still a real rest action */
    function goGroundSit(st) {
      freeSeat(st);
      const a = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * 1.2;
      st.target.set(
        st.mesh.position.x + Math.cos(a) * r,
        0,
        st.mesh.position.z + Math.sin(a) * r,
      );
      st.sitTarget = st.target.clone();
      st.moving = true;
      st.flying = false;
      st.action = "go_sit";
      st.pendingSit = true;
      st.sitPhase = "ground";
      st.seatId = null;
      st.sitStartedAt = performance.now();
      st.speed = (st.baseSpeed || 2.2) * 0.75;
      st.ignoreAgentPush = true;
      return true;
    }

    function arriveSit(st) {
      const seat = st.seatId ? seatState.find((s) => s.id === st.seatId) : null;
      if (seat?.pos) {
        st.mesh.position.x = seat.pos.x;
        st.mesh.position.z = seat.pos.z;
      } else if (st.sitTarget) {
        st.mesh.position.x = st.sitTarget.x;
        st.mesh.position.z = st.sitTarget.z;
      }
      st.mesh.position.y = 0;
      st.vx = 0;
      st.vz = 0;
      st.vy = 0;
      st.posture = "sit";
      st.moving = false;
      st.pendingSit = false;
      st.action = "sit";
      st.sitPhase = null;
      st.ignoreAgentPush = false;
      applyPosture(st);
      // Face fire or a nearby friend
      faceTowardXZ(st.mesh, 0, 0, st.faceYaw || 0, true);
      // Real rest window (longer so sitting is visible)
      const sitMs = 5500 + st.persona.rest * 9000 + Math.random() * 4000;
      st.nextDecideAt = performance.now() + sitMs;
      st.energyNow = Math.min(1, st.energyNow + 0.18);
      st.boredom = Math.max(0, st.boredom - 0.28);
      if (Math.random() < 0.45) {
        const lines = [
          "Ah. Chair rights.",
          "Sitting is a lifestyle.",
          "Finally — gravity and I agree.",
          "I'll just rest my lore here a minute.",
          "Don't mind me. Charging my monologue.",
        ];
        showSpeech3d(st.def.id, lines[Math.floor(Math.random() * lines.length)], 7000, { compact: true });
      }
    }

    /**
     * Mood/personality-weighted free will — roam-heavy meadow life.
     * Actions: sit | idle | wander | social | fire | prop | trex | house
     */
    function decideAction(st) {
      // Inside a house — stay until leave timer, then walk out
      if (st.insideHouse || st.housePhase === "inside") {
        if (performance.now() >= (st.houseLeaveAt || 0)) {
          agentBeginExitHouse(st);
          return "house_exit";
        }
        st.moving = false;
        st.action = "house_inside";
        st.nextDecideAt = Math.min(
          st.nextDecideAt || performance.now() + 4000,
          (st.houseLeaveAt || performance.now() + 4000) + 200,
        );
        // Occasional interior chatter
        if (Math.random() < 0.2) {
          const others = agentsInsideHouse(st.insideHouse).filter((s) => s !== st);
          if (others.length) {
            const o = others[Math.floor(Math.random() * others.length)];
            showSpeech3d(st.def.id, `${o.def.name} — I like how the firmament peeks through the glass.`, 10000);
          }
        }
        return "house_inside";
      }
      if (st.housePhase === "approach" || st.housePhase === "exit") {
        // Let approach/exit finish
        st.nextDecideAt = performance.now() + 3000;
        return st.housePhase;
      }

      // Thor + Mjolnir: seek when free, throw when wielding
      if (st.def?.id === "thor" && !st.powWow) {
        const nowT = performance.now();
        if (mjolnirState.ownerId === "thor" && !mjolnirState.flying) {
          if (nowT >= (st.nextThrowAt || mjolnirState.nextThorThrowAt || 0)) {
            if (thorThrowMjolnir(st)) return "throw_mjolnir";
          }
          // Parade with hammer — short roam then throw
          if (Math.random() < 0.45) {
            pickRoamTarget(st);
            st.action = "wield_mjolnir";
            st.nextDecideAt = nowT + 2500 + Math.random() * 2500;
            return "wield_mjolnir";
          }
        } else if (!mjolnirState.flying && nowT >= (mjolnirState.nextThorSeekAt || 0)) {
          if (Math.random() < 0.72 || st.boredom > 0.25) {
            if (seekMjolnir(st)) {
              if (Math.random() < 0.35) {
                showSpeech3d("thor", "Where's my hammer?", 7000, { compact: true });
              }
              return "seek_mjolnir";
            }
          }
        }
      }

      const p = st.persona;
      // drift stats — boredom rises fast so they keep moving
      st.boredom = Math.min(1, st.boredom + 0.1 + (1 - p.rest) * 0.05);
      st.energyNow = THREE.MathUtils.clamp(
        st.energyNow + (Math.random() - 0.35) * 0.09 - (st.posture === "sit" ? -0.04 : 0.012),
        0.15,
        1,
      );

      // Stroll + sit + prop use (not pure wander spam)
      const wSit = p.rest * 1.15 + (1 - st.energyNow) * 0.75 + 0.4;
      const wIdle = p.rest * 0.35 + (st.posture === "sit" ? 0.2 : 0.1);
      const wWander = p.energy * 1.35 + st.boredom * 1.05 + st.energyNow * 0.55 + 0.5;
      const wSocial = p.social * 1.2 + (p.mood === "flirt" || p.mood === "happy" ? 0.35 : 0.15) + 0.2;
      const wFire = p.firelove * 0.95 + 0.25;
      const wProp = p.curiosity * 1.1 + 0.4 + (st.boredom > 0.4 ? 0.25 : 0)
        + (buzzActive(st) ? 0.2 : 0);
      const wTrex = 0.22 + p.curiosity * 0.35 + p.energy * 0.25
        + (buzzActive(st)?.kind === "drunk" ? 0.3 : 0)
        + (findTrexMesh() ? 0.25 : 0)
        + (firmamentOpen3d ? 0.2 : 0);
      const wHouse = (p.rest * 0.5 + p.curiosity * 0.4 + 0.25) * (Math.random() > 0.35 ? 1 : 0.75);
      // Firmament ON: walk still common, but sky-will is strong (esp. natural flyers)
      const skyWill = firmamentOpen3d
        ? firmamentWhimScore(st) + (FLYER_IDS.has(st.def?.id) ? 0.45 : 0.12)
        : 0;
      const wFly = firmamentOpen3d
        ? (p.energy * 0.85 + st.boredom * 0.45 + skyWill * 0.9 + 0.35)
        : 0;

      // Stay seated more often — sitting should be visible
      if (st.posture === "sit" && Math.random() < 0.55 + p.rest * 0.25 && st.boredom < 0.55) {
        st.nextDecideAt = performance.now() + 4000 + p.rest * 5000;
        st.action = "sit";
        return "sit";
      }

      const wReason = 0.28 + p.curiosity * 0.28 + (p.mood === "think" ? 0.22 : 0);
      const wTerminal = 0.22 + p.curiosity * 0.35 + p.energy * 0.15;
      const bag = [
        ["sit", wSit],
        ["idle", wIdle],
        ["reason", wReason],
        ["terminal", wTerminal],
        ["wander", wWander],
        ["fly", wFly],
        ["social", wSocial],
        ["fire", wFire],
        ["prop", wProp],
        ["trex", wTrex],
        ["house", wHouse],
      ];
      const total = bag.reduce((s, [, w]) => s + Math.max(0.01, w), 0);
      let r = Math.random() * total;
      let choice = "idle";
      for (const [name, w] of bag) {
        r -= Math.max(0.01, w);
        if (r <= 0) { choice = name; break; }
      }

      freeSeat(st);

      if (choice === "sit") {
        const seat = findFreeSeat(st.mesh.position);
        if (seat && goSit(st, seat)) {
          st.nextDecideAt = performance.now() + 8000 + p.rest * 6000;
          return "go_sit";
        }
        // No free chair → sit on the grass nearby (still a sit)
        if (goGroundSit(st)) {
          st.nextDecideAt = performance.now() + 7000 + p.rest * 5000;
          return "go_sit";
        }
        choice = "wander";
      }
      if (choice === "idle") {
        // Idle almost always turns into another walk
        if (Math.random() < 0.82) {
          pickRoamTarget(st);
          st.nextDecideAt = performance.now() + 4500 + Math.random() * 4000;
          return "wander";
        }
        st.moving = false;
        st.flying = false;
        st.target.copy(st.mesh.position);
        st.target.y = 0;
        st.action = "idle";
        st.nextDecideAt = performance.now() + 1800 + p.rest * 2800 + Math.random() * 1500;
        return "idle";
      }
      if (choice === "reason") {
        st.moving = false;
        st.flying = false;
        st.target.copy(st.mesh.position);
        st.target.y = 0;
        st.action = "reason";
        st.posture = "stand";
        st.nextDecideAt = performance.now() + 9000 + Math.random() * 8000;
        // Speak after a thinking beat
        setTimeout(() => {
          if (st.action !== "reason") return;
          chatAgent(
            st.def.id,
            "You paused by the fire with a half-finished thought. Share what you were chewing on — honest, short, spoken.",
            true,
          );
        }, 1600 + Math.random() * 1800);
        return "reason";
      }
      if (choice === "terminal") {
        // Walk to Firmament beacon / own house zone and "create"
        freeSeat(st);
        const toBeacon = Math.random() < 0.55 && techBeacon;
        if (toBeacon) {
          st.target.set(
            techBeacon.position.x + (Math.random() - 0.5) * 2,
            0,
            techBeacon.position.z + (Math.random() - 0.5) * 2,
          );
        } else {
          const a = Math.random() * Math.PI * 2;
          const r = 3 + Math.random() * 6;
          st.target.set(st.home.x + Math.cos(a) * r, 0, st.home.z + Math.sin(a) * r);
        }
        st.flying = false;
        st.moving = true;
        st.action = "terminal";
        st.pendingTerminal = true;
        st.nextDecideAt = performance.now() + 16000 + Math.random() * 8000;
        return "terminal";
      }
      if (choice === "fly" && firmamentOpen3d) {
        if (beginWhimFlight(st) || (agentCanTakeSky(st) && beginWhimFlight(st))) {
          // Occasional spell/truth while aloft
          if (Math.random() < 0.38) {
            setTimeout(() => {
              if (st.action === "fly" || st.flying) {
                showSpeech3d(st.def.id, pickFirmamentLine(), speechReadMs(40), { compact: true, force: true });
              }
            }, 600 + Math.random() * 1200);
          }
          return "fly";
        }
        // Whim said no — stroll instead (still free will)
        pickRoamTarget(st, { allowFly: false });
        st.nextDecideAt = performance.now() + 5000 + Math.random() * 4000;
        return "wander";
      }
      if (choice === "social" && agentState.length > 1) {
        const other = agentState.filter((s) => s !== st && s.posture !== "sit")[Math.floor(Math.random() * Math.max(1, agentState.length - 1))]
          || agentState.find((s) => s !== st);
        if (other) {
          st.target.set(
            other.mesh.position.x + (Math.random() - 0.5) * 1.8,
            0,
            other.mesh.position.z + (Math.random() - 0.5) * 1.8,
          );
          st.flying = false;
          st.moving = true;
          st.action = "social";
          st.socialTarget = other.def.id;
          st.nextDecideAt = performance.now() + 14000 + Math.random() * 10000;
          return st.action;
        }
      }
      if (choice === "fire") {
        const a = Math.random() * Math.PI * 2;
        const r = 2.2 + Math.random() * 2.5;
        st.target.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        st.moving = true;
        st.action = "fire";
        // Usually park on a chair after the fire visit
        st.wantSitAfter = Math.random() < 0.78 + p.rest * 0.15;
        st.nextDecideAt = performance.now() + 16000 + Math.random() * 8000;
        return "fire";
      }
      if (choice === "trex" && findTrexMesh()) {
        const trex = findTrexMesh();
        const ang = Math.random() * Math.PI * 2;
        st.target.set(
          trex.position.x + Math.cos(ang) * 2.1,
          0,
          trex.position.z + Math.sin(ang) * 2.1,
        );
        st.moving = true;
        st.flying = false;
        st.action = "trex";
        st.propTarget = "trex";
        st.pendingProp = true; // reuse arrival hook → agentUseProp → agentInteractTrex
        st.nextDecideAt = performance.now() + 16000 + Math.random() * 8000;
        return "trex";
      }
      if (choice === "prop" && (PROPS.length || groundLoot.length)) {
        // Ground loot is interesting — agents may go for dropped stuff if they desire
        if (groundLoot.length && Math.random() < 0.45 + (st.boredom || 0) * 0.2) {
          // Prefer closer loot
          const sorted = groundLoot
            .slice()
            .sort((a, b) => {
              const da = Math.hypot(a.x - st.mesh.position.x, a.z - st.mesh.position.z);
              const db = Math.hypot(b.x - st.mesh.position.x, b.z - st.mesh.position.z);
              return da - db;
            });
          const loot = sorted[0];
          if (loot?.mesh?.parent) {
            st.target.set(loot.x, 0, loot.z);
            st.moving = true;
            st.flying = false;
            st.action = "prop";
            st.propTarget = loot.id;
            st.pendingProp = true;
            st.ignoreAgentPush = true;
            st.nextDecideAt = performance.now() + 16000 + Math.random() * 8000;
            return "prop";
          }
        }
        // Prefer booze/herbs when chasing a buzz; else something they haven't used
        let shuffled = PROPS.slice().sort(() => Math.random() - 0.5);
        if (!buzzActive(st) && Math.random() < 0.4) {
          const party = shuffled.filter((pr) =>
            /beer|wine|weed|herbs/.test(String(pr.id || "")),
          );
          if (party.length) shuffled = party.concat(shuffled);
        }
        const prop = shuffled.find((pr) => pr.id !== st.lastProp) || shuffled[0];
        if (!prop) {
          pickRoamTarget(st);
          return "wander";
        }
        const w = toWorld(prop.x, prop.y);
        // Stand slightly off the prop so solid kits don't block forever
        const ang = Math.random() * Math.PI * 2;
        st.target.set(w.x + Math.cos(ang) * 0.75, 0, w.z + Math.sin(ang) * 0.75);
        st.moving = true;
        st.action = "prop";
        st.propTarget = prop.id;
        st.pendingProp = true;
        st.ignoreAgentPush = true;
        st.nextDecideAt = performance.now() + 18000 + Math.random() * 10000;
        return "prop";
      }
      if (choice === "house" && HOUSES.length) {
        const preferOwn = p.rest > 0.45 || Math.random() < 0.4;
        if (startAgentHouseVisit(st, preferOwn)) return "house";
        choice = "wander";
      }
      // wander fallback — default life mode
      pickRoamTarget(st);
      st.nextDecideAt = performance.now() + 3500 + (1 - p.energy) * 3000 + Math.random() * 3000;
      return "wander";
    }

    function scatterAll() {
      // Almost everyone walks; sits are rare; leave house visitors alone
      let walked = 0, sat = 0, home = 0;
      for (const st of agentState) {
        if (st.insideHouse || st.housePhase === "approach" || st.housePhase === "exit") {
          home++;
          continue;
        }
        // A few head home on scatter waves
        if (Math.random() < 0.12 && HOUSES.length && startAgentHouseVisit(st, Math.random() < 0.5)) {
          home++;
          continue;
        }
        if (st.persona.energy > 0.25 || Math.random() < 0.88) {
          pickRoamTarget(st);
          walked++;
        } else {
          const seat = findFreeSeat(st.mesh.position);
          if (seat && goSit(st, seat)) sat++;
          else {
            pickRoamTarget(st);
            walked++;
          }
        }
        st.nextDecideAt = performance.now() + 2500 + Math.random() * 4000;
      }
      showToast(`🌿 free will · ${walked} roam · ${sat} sit · ${home} home`);
      logLine("Camp", `Mood wave — ${walked} roaming, ${sat} sitting, ${home} housebound.`);
    }

    // Visitor (you) + ground click marker
    const visitor = new THREE.Group();
    let carrySprite = null;
    let carriedItem = null; // { id, name, emoji }
    let inventory3d = []; // purchased items you can re-equip
    {
      const mat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.35 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 6, 12), mat);
      body.position.y = 0.85;
      body.castShadow = true;
      visitor.add(body);
      const label = makeLabelSprite("You", "★", 0x38bdf8);
      label.position.y = 2.0;
      label.scale.set(1.3, 0.65, 1);
      visitor.add(label);
      visitor.position.set(2.5, 0, 4);
      scene.add(visitor);
    }
    function makeCarrySprite(emoji, scale = 0.85) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 128, 128);
      // soft glow disc so the object reads in the dark meadow
      const g = ctx.createRadialGradient(64, 70, 8, 64, 70, 56);
      g.addColorStop(0, "rgba(255,255,255,0.35)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(64, 70, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "84px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emoji || "✨", 64, 68);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      const spr = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
      );
      spr.scale.set(scale, scale, 1);
      spr.position.set(0.48, 1.38, 0.22);
      spr.name = "carrySprite";
      return spr;
    }
    function clearCarryOn(mesh) {
      if (!mesh) return;
      const old = mesh.getObjectByName("carrySprite");
      if (old) {
        mesh.remove(old);
        try {
          old.material.map?.dispose?.();
          old.material.dispose?.();
        } catch (_) {}
      }
    }
    function attachCarryTo(mesh, item, opts = {}) {
      if (!mesh || !item) return null;
      clearCarryOn(mesh);
      const spr = makeCarrySprite(item.emoji || "✨", opts.scale || 0.85);
      if (opts.offset) {
        spr.position.set(opts.offset.x ?? 0.48, opts.offset.y ?? 1.38, opts.offset.z ?? 0.22);
      }
      mesh.add(spr);
      return spr;
    }
    function setCarriedItem(item) {
      clearCarryOn(visitor);
      carrySprite = null;
      carriedItem = item || null;
      if (!item) {
        try { localStorage.removeItem("luna-3d-carry"); } catch (_) {}
        refreshCarryHud();
        return;
      }
      carrySprite = attachCarryTo(visitor, item);
      try {
        localStorage.setItem(
          "luna-3d-carry",
          JSON.stringify({ id: item.id, name: item.name, emoji: item.emoji }),
        );
      } catch (_) {}
      refreshCarryHud();
    }
    function setAgentCarry(st, item) {
      if (!st?.mesh) return;
      st.carried = item || null;
      if (!item) {
        clearCarryOn(st.mesh);
        return;
      }
      attachCarryTo(st.mesh, item, {
        scale: 0.78,
        offset: { x: 0.42, y: 1.55, z: 0.18 },
      });
    }

    /** Dropped items stay on the meadow as real pickups agents may choose to grab. */
    const groundLoot = [];
    let lootSeq = 0;

    function spawnGroundLoot(item, wx, wz, opts = {}) {
      if (!item) return null;
      lootSeq += 1;
      const baseId = String(item.id || item.baseId || "loot").replace(/^loot_/, "");
      const id = `loot_${baseId}_${lootSeq}`;
      const emoji = item.emoji || "✨";
      const name = item.name || "dropped item";
      const color = item.color != null ? item.color : 0xfbbf24;

      const group = new THREE.Group();
      group.name = id;
      const spr = makeCarrySprite(emoji, 1.0);
      spr.position.set(0, 0.62, 0);
      group.add(spr);
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.42, 22),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.03;
      group.add(disc);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.62, 28),
        new THREE.MeshBasicMaterial({
          color: 0x67e8f9,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      group.add(ring);
      const label = makeLabelSprite(name, emoji, color);
      label.position.y = 1.25;
      label.scale.set(1.5, 0.75, 1);
      group.add(label);

      const jx = wx + (Math.random() - 0.5) * 0.35;
      const jz = wz + (Math.random() - 0.5) * 0.35;
      group.position.set(jx, 0, jz);
      group.userData = {
        kind: "prop",
        id,
        name,
        emoji,
        color,
        dropped: true,
        loot: true,
        baseId,
        interact: "loot",
      };
      scene.add(group);
      propMeshes.push(group);
      groundLoot.push({
        id,
        baseId,
        name,
        emoji,
        color,
        mesh: group,
        x: jx,
        z: jz,
        bornAt: performance.now(),
      });

      if (opts.inviteAgents !== false) {
        inviteAgentsToLoot(group, opts.inviteChance);
      }
      return group;
    }

    function removeGroundLoot(meshOrId) {
      let mesh = null;
      if (typeof meshOrId === "string") {
        mesh = propMeshes.find((g) => g.userData?.id === meshOrId) || null;
      } else {
        mesh = meshOrId;
      }
      if (!mesh) return null;
      const data = {
        id: mesh.userData?.baseId || mesh.userData?.id,
        name: mesh.userData?.name,
        emoji: mesh.userData?.emoji,
        color: mesh.userData?.color,
      };
      const pi = propMeshes.indexOf(mesh);
      if (pi >= 0) propMeshes.splice(pi, 1);
      const li = groundLoot.findIndex((l) => l.mesh === mesh || l.id === mesh.userData?.id);
      if (li >= 0) groundLoot.splice(li, 1);
      try { scene.remove(mesh); } catch (_) {}
      try {
        mesh.traverse((o) => {
          if (o.material?.map) o.material.map.dispose?.();
          o.material?.dispose?.();
          o.geometry?.dispose?.();
        });
      } catch (_) {}
      return data;
    }

    /**
     * Soft invite — agents may walk over if they want (not forced).
     */
    function inviteAgentsToLoot(mesh, chance = 0.5) {
      if (!mesh?.position) return;
      const free = agentState
        .filter((st) => !st.powWow && st.posture !== "sit" && !st.pendingProp)
        .sort(() => Math.random() - 0.5);
      let invited = 0;
      free.forEach((st, i) => {
        // Desire roll — curiosity / boredom / buzz help
        const want =
          chance +
          (st.persona?.curiosity || 0.4) * 0.25 +
          (st.boredom || 0) * 0.2 +
          (buzzActive(st) ? 0.15 : 0) -
          i * 0.08;
        if (Math.random() > Math.min(0.85, want)) return;
        if (invited >= 3) return;
        invited += 1;
        const delay = 500 + invited * 700 + Math.random() * 1500;
        setTimeout(() => {
          if (!mesh.parent) return; // already claimed
          if (st.powWow || st.pendingProp) return;
          st.propTarget = mesh.userData.id;
          st.pendingProp = true;
          st.action = "prop";
          st.flying = false;
          st.target.set(
            mesh.position.x + (Math.random() - 0.5) * 0.8,
            0,
            mesh.position.z + (Math.random() - 0.5) * 0.8,
          );
          st.moving = true;
          st.nextDecideAt = performance.now() + 14000 + Math.random() * 6000;
          showToast(`👀 ${st.def.name} noticed ${mesh.userData.emoji || "✨"} on the ground`);
        }, delay);
      });
      if (invited > 0) {
        logLine("Camp", `${invited} friend${invited > 1 ? "s" : ""} may check the dropped loot…`);
      }
    }

    function dropCarriedItem(opts = {}) {
      if (!carriedItem) return null;
      const dropped = { ...carriedItem };
      const wx = visitor.position.x + (opts.dx != null ? opts.dx : 0.45);
      const wz = visitor.position.z + (opts.dz != null ? opts.dz : 0.25);
      setCarriedItem(null);
      const mesh = spawnGroundLoot(dropped, wx, wz, {
        inviteAgents: opts.inviteAgents !== false,
        inviteChance: opts.inviteChance != null ? opts.inviteChance : 0.55,
      });
      showToast(`Dropped ${dropped.emoji || ""} ${dropped.name || "item"} · stays on the ground`);
      logLine("You", `Set down ${dropped.name || "the item"} — it's on the meadow if anyone wants it.`, true);
      return { item: dropped, mesh };
    }

    /** Agent puts their carry on the ground as real loot. */
    function agentDropCarry(st, opts = {}) {
      if (!st?.carried) return null;
      const left = { ...st.carried };
      setAgentCarry(st, null);
      const mesh = spawnGroundLoot(left, st.mesh.position.x, st.mesh.position.z, {
        inviteAgents: opts.inviteAgents === true, // quieter when agents drop
        inviteChance: 0.28,
      });
      logLine(st.def.name, `sets down ${left.emoji || ""} ${left.name || "the thing"} on the ground`);
      return { item: left, mesh };
    }
    /** Gift what you're holding to an agent — they tote it and react. */
    function giftCarriedToAgent(st) {
      if (!carriedItem || !st) return false;
      const gift = { ...carriedItem };
      setCarriedItem(null);
      setAgentCarry(st, gift);
      st.persona.joy = Math.min(0.99, (st.persona.joy || 0.5) + 0.12);
      st.persona.social = Math.min(0.99, (st.persona.social || 0.5) + 0.1);
      st.persona.mood = "happy";
      applyLook(st);
      // Walk a little victory lap
      pickRoamTarget(st);
      showToast(`${gift.emoji || "✨"} Gave ${gift.name || "it"} to ${st.def.name}`);
      logLine("You", `Handed ${gift.name || "a treat"} to ${st.def.name}.`, true);
      if (aiInFlight < AI_MAX) {
        aiInFlight++;
        const seed =
          `The visitor just gifted you ${gift.emoji || ""} ${gift.name || "something fun"} to carry. ` +
          `React with witty joy — 2–3 spoken sentences: hold it up, joke, thank them. No meta.`;
        campClient.agentChat(st.def.id, seed, { ambient: true })
          .then((data) => {
            const reply = spokenOnly3d(data.reply || data.text || "", seed)
              || `Ooh ${gift.emoji || "✨"} — I'm keeping this. Thanks!`;
            showSpeech3d(st.def.id, reply, speechReadMs(reply), { force: true });
          })
          .catch(() => {
            showSpeech3d(
              st.def.id,
              `Ooh ${gift.emoji || "✨"} ${gift.name || "this"}? I'm walking around with it. Thanks!`,
              16000,
              { force: true },
            );
          })
          .finally(() => { aiInFlight = Math.max(0, aiInFlight - 1); });
      } else {
        showSpeech3d(
          st.def.id,
          `${gift.emoji || "✨"} Mine now — watch me parade this around camp!`,
          14000,
          { force: true, compact: true },
        );
      }
      return true;
    }
    function refreshCarryHud() {
      const hud = document.getElementById("carry-hud");
      if (hud) {
        if (carriedItem) {
          hud.hidden = false;
          hud.textContent = `${carriedItem.emoji || "✨"} ${carriedItem.name || "item"} · Give / Drop`;
        } else {
          hud.hidden = true;
        }
      }
      const fab = document.getElementById("act-fab");
      if (fab) {
        fab.classList.toggle("has-carry", !!carriedItem);
        fab.textContent = carriedItem ? (carriedItem.emoji || "✋") : "✋";
        fab.title = carriedItem
          ? `Holding ${carriedItem.name || "item"} — open actions`
          : "Actions: take, give, drop";
      }
      const st = document.getElementById("act-status");
      if (st) {
        st.textContent = carriedItem
          ? `Holding ${carriedItem.emoji || ""} ${carriedItem.name || "item"}`
          : "Hands empty · Take nearest snack/loot";
      }
      const sheet = document.getElementById("act-sheet");
      if (sheet) {
        const giveBtn = sheet.querySelector('[data-act="give"]');
        const dropBtn = sheet.querySelector('[data-act="drop"]');
        if (giveBtn) giveBtn.disabled = !carriedItem;
        if (dropBtn) dropBtn.disabled = !carriedItem;
      }
    }

    function nearestCarryTarget(maxD = 5.5) {
      let best = null;
      let bestD = maxD;
      // Ground loot first
      for (const L of groundLoot) {
        if (!L?.mesh) continue;
        const d = Math.hypot(L.mesh.position.x - visitor.position.x, L.mesh.position.z - visitor.position.z);
        if (d < bestD) {
          bestD = d;
          best = { kind: "loot", loot: L, mesh: L.mesh, d };
        }
      }
      // Catalog props
      for (const mesh of propMeshes) {
        const u = mesh.userData || {};
        if (u.loot || u.dropped) continue;
        const pid = u.baseId || u.id;
        if (!isPickableProp(pid) && !isPickableProp(u.id)) continue;
        if (String(u.id || "").includes("mjolnir") || pid === "mjolnir") continue;
        if (pid === "ouija" || pid === "stereo" || u.feature === "music") continue;
        const d = Math.hypot(mesh.position.x - visitor.position.x, mesh.position.z - visitor.position.z);
        if (d < bestD) {
          bestD = d;
          best = { kind: "prop", mesh, d, pid };
        }
      }
      return best;
    }

    function takeNearestCarryable() {
      const t = nearestCarryTarget(6.2);
      if (!t) {
        showToast("Nothing to take — walk nearer a snack or dropped item");
        return false;
      }
      if (carriedItem) {
        spawnGroundLoot(carriedItem, visitor.position.x - 0.4, visitor.position.z - 0.2, {
          inviteAgents: true,
          inviteChance: 0.35,
        });
      }
      if (t.kind === "loot") {
        const item = {
          id: t.loot.baseId || t.loot.id,
          name: t.loot.name,
          emoji: t.loot.emoji,
          color: t.loot.color,
        };
        removeGroundLoot(t.mesh);
        setCarriedItem(item);
        showToast(`${item.emoji || "✨"} Picked up ${item.name || "item"}`);
        logLine("You", `Picked up ${item.name || "something"} from the ground.`, true);
      } else {
        const u = t.mesh.userData || {};
        const baseId = u.baseId || u.id;
        const emoji = u.emoji || "✨";
        const name = u.name || baseId;
        t.mesh.userData.pulseUntil = performance.now() + 1200;
        setCarriedItem({ id: baseId, name, emoji, color: u.color });
        showToast(`${emoji} Took ${name}`);
        logLine("You", `Took ${name}.`, true);
      }
      closeActionSheet();
      return true;
    }

    function giveToNearestFriend() {
      if (!carriedItem) {
        showToast("Take something first, then Give");
        return false;
      }
      let best = null;
      let bestD = 5.5;
      for (const st of agentState) {
        if (!st?.mesh || st.insideHouse) continue;
        const d = st.mesh.position.distanceTo(visitor.position);
        if (d < bestD) {
          bestD = d;
          best = st;
        }
      }
      if (!best) {
        showToast("Get closer to a friend to give");
        return false;
      }
      giftCarriedToAgent(best);
      closeActionSheet();
      return true;
    }

    function openActionSheet() {
      const sheet = document.getElementById("act-sheet");
      if (!sheet) return;
      refreshCarryHud();
      sheet.classList.add("open");
      sheet.setAttribute("aria-hidden", "false");
    }
    function closeActionSheet() {
      const sheet = document.getElementById("act-sheet");
      if (!sheet) return;
      sheet.classList.remove("open");
      sheet.setAttribute("aria-hidden", "true");
    }
    function toggleActionSheet() {
      const sheet = document.getElementById("act-sheet");
      if (!sheet) return;
      if (sheet.classList.contains("open")) closeActionSheet();
      else openActionSheet();
    }
    // Restore last carried shop goodie
    try {
      const raw = localStorage.getItem("luna-3d-carry");
      if (raw) {
        const it = JSON.parse(raw);
        if (it?.emoji || it?.name) setCarriedItem(it);
      }
    } catch (_) {}
    // Drop carried item with X (not while typing / not when closing bubbles)
    window.addEventListener("keydown", (e) => {
      if (e.target?.closest?.("input,textarea,[contenteditable]")) return;
      // Leave interior
      if (playerInsidePlace && (e.key === "Escape" || e.key === "e" || e.key === "E")) {
        e.preventDefault();
        leavePlaceInterior();
        return;
      }
      // Enter nearest house / center (2D parity)
      if (!playerInsidePlace && (e.key === "e" || e.key === "E" || e.key === "Enter")) {
        const n = nearestEnterablePlace(4.5);
        if (n) {
          e.preventDefault();
          if (n.kind === "house") void runHouseEnter(n.id);
          else void runCenterEnter(n.id, n.meta || {});
          return;
        }
      }
      if (e.key === "x" || e.key === "X") {
        if (carriedItem) {
          e.preventDefault();
          dropCarriedItem();
        }
      }
      // G = gift to nearest agent
      if ((e.key === "g" || e.key === "G") && carriedItem) {
        let best = null;
        let bestD = 4.5;
        for (const st of agentState) {
          const d = st.mesh.position.distanceTo(visitor.position);
          if (d < bestD) { bestD = d; best = st; }
        }
        if (best) giftCarriedToAgent(best);
        else showToast("Get closer to a friend to gift");
      }
    });

    // Interior panel wiring (once DOM exists)
    document.getElementById("pi-exit")?.addEventListener("click", () => leavePlaceInterior());
    document.getElementById("pi-send")?.addEventListener("click", () => sendInteriorChat());
    document.getElementById("pi-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendInteriorChat();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        leavePlaceInterior();
      }
    });
    // Tap carry HUD → open action sheet (mobile give/take/drop)
    document.getElementById("carry-hud")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openActionSheet();
    });
    document.getElementById("act-fab")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleActionSheet();
    });
    document.getElementById("act-sheet")?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("button[data-act]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const act = btn.getAttribute("data-act");
      if (act === "close") closeActionSheet();
      else if (act === "take") takeNearestCarryable();
      else if (act === "give") giveToNearestFriend();
      else if (act === "drop") {
        if (carriedItem) {
          dropCarriedItem();
          closeActionSheet();
        } else showToast("Nothing to drop");
      }
    });
    refreshCarryHud();
    const visitorTarget = visitor.position.clone();
    const groundMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.4, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    groundMarker.rotation.x = -Math.PI / 2;
    groundMarker.position.y = 0.05;
    groundMarker.visible = false;
    scene.add(groundMarker);

    // Ground plane for click-to-move (invisible, large)
    const FIELD = 190; // wide-open town half-size (gates ~1600 units)
    let firmamentOpen3d = false;
    try { firmamentOpen3d = localStorage.getItem("luna-firmament-open") === "1"; } catch (_) {}

    function setFirmamentOpen3d(on, opts = {}) {
      firmamentOpen3d = !!on;
      try { localStorage.setItem("luna-firmament-open", firmamentOpen3d ? "1" : "0"); } catch (_) {}
      const btn = document.getElementById("btn-firmament-3d");
      if (btn) {
        btn.classList.toggle("playing", firmamentOpen3d);
        btn.classList.toggle("active", firmamentOpen3d);
        btn.textContent = firmamentOpen3d ? "🌌 ON" : "📡 Firmament";
        btn.title = firmamentOpen3d
          ? "Firmament open — flyers may choose the sky. Tap to close."
          : "Open the Firmament so winged/mythic agents may fly";
        btn.setAttribute("aria-pressed", firmamentOpen3d ? "true" : "false");
        // Force visible (mobile topbar clutter / hub chrome)
        try {
          btn.style.setProperty("display", "inline-flex", "important");
          btn.style.setProperty("visibility", "visible", "important");
          btn.style.setProperty("opacity", "1", "important");
          btn.style.setProperty("pointer-events", "auto", "important");
        } catch (_) {}
      }
      if (techBeacon) {
        techBeacon.visible = true;
        if (techBeacon.userData.beam) {
          techBeacon.userData.beam.material.opacity = firmamentOpen3d ? 0.45 : 0.12;
          techBeacon.userData.beam.material.emissiveIntensity = firmamentOpen3d ? 0.9 : 0.2;
        }
        if (techBeacon.userData.ring) {
          techBeacon.userData.ring.material.opacity = firmamentOpen3d ? 0.55 : 0.18;
        }
      }
      if (!firmamentOpen3d) {
        for (const st of agentState) {
          st.flying = false;
          st.flyHeight = 0;
          st.flyPath = null;
          st.flyPathI = 0;
          if (st.action === "fly") st.action = "wander";
          if (st.target) st.target.y = 0;
        }
        // T-Rex returns to ground patrol
        try {
          const trex = findTrexMesh();
          if (trex) {
            trex.userData.flying = false;
            trex.userData.flyPath = null;
            trex.position.y = 0;
          }
        } catch (_) {}
      } else {
        // Sky opens: several willful souls + T-Rex take whim paths
        setTimeout(() => {
          if (!firmamentOpen3d) return;
          const flyers = agentState
            .filter((s) => !s.insideHouse && (FLYER_IDS.has(s.def?.id) || firmamentWhimScore(s) > 0.4))
            .sort(() => Math.random() - 0.5)
            .slice(0, 5 + Math.floor(Math.random() * 4));
          flyers.forEach((st, i) => {
            setTimeout(() => {
              if (firmamentOpen3d) beginWhimFlight(st);
            }, 400 + i * 550);
          });
          try { startTrexFirmamentFlight(); } catch (_) {}
          // Broadcast a firmament truth/spell
          const speaker = flyers[0] || agentState[0];
          if (speaker) {
            showSpeech3d(speaker.def.id, pickFirmamentLine("truth"), 16000, { force: true });
          }
        }, 500);
      }
      if (!opts.quiet) {
        showToast(firmamentOpen3d
          ? "🌌 Firmament open — walk or fly by will · T-Rex may rise"
          : "📡 Firmament closed — ground roam");
        logLine("Camp", firmamentOpen3d
          ? "Firmament lattice unlocked — whim-paths, spells, and truths in the open sky."
          : "Firmament lattice sealed — wings stay grounded.");
      }
    }

    /** T-Rex sky-will when Firmament is open — 3D whim trajectory (mostly aerial) */
    function startTrexFirmamentFlight() {
      const trex = findTrexMesh();
      if (!trex || !firmamentOpen3d) return;
      const HALF = (typeof FIELD === "number" ? FIELD : 190) * 0.75;
      const styles = ["spiral", "soar", "bank", "dive", "loop"];
      const style = styles[Math.floor(Math.random() * styles.length)];
      const pts = [];
      let ang = Math.random() * Math.PI * 2;
      const ox = trex.position.x;
      const oz = trex.position.z;
      for (let i = 0; i < 8; i++) {
        const t = (i + 1) / 8;
        if (style === "spiral") {
          ang += 0.85;
          const r = 14 + t * 28;
          pts.push({
            x: THREE.MathUtils.clamp(ox + Math.cos(ang) * r, -HALF, HALF),
            y: 2.2 + Math.sin(t * Math.PI * 2) * 2.5 + t * 2,
            z: THREE.MathUtils.clamp(oz + Math.sin(ang) * r, -HALF, HALF),
          });
        } else if (style === "dive") {
          const a = Math.random() * Math.PI * 2;
          const r = 16 + Math.random() * 24;
          pts.push({
            x: THREE.MathUtils.clamp(ox + Math.cos(a) * r, -HALF, HALF),
            y: i % 2 === 0 ? 5.5 + Math.random() * 1.5 : 1.2 + Math.random(),
            z: THREE.MathUtils.clamp(oz + Math.sin(a) * r, -HALF, HALF),
          });
        } else {
          const a = Math.random() * Math.PI * 2;
          const r = 12 + Math.random() * 30;
          pts.push({
            x: THREE.MathUtils.clamp(Math.cos(a) * r, -HALF, HALF),
            y: 2.5 + Math.random() * 3.5,
            z: THREE.MathUtils.clamp(Math.sin(a) * r, -HALF, HALF),
          });
        }
      }
      // Land last
      pts.push({ x: ox + (Math.random() - 0.5) * 10, y: 0, z: oz + (Math.random() - 0.5) * 10 });
      trex.userData.flying = true;
      trex.userData.flyPath = pts;
      trex.userData.flyPathI = 0;
      trex.userData.tx = pts[0].x;
      trex.userData.ty = pts[0].y;
      trex.userData.tz = pts[0].z;
      trex.userData.sprint = true;
      trex.userData.nextWaypointAt = performance.now() + 8000;
      if (Math.random() < 0.7) {
        showToast("🦖 T-Rex claims the firmament");
        logLine("Camp", "T-Rex rises on a whim-path — weight remembers the sky.");
      }
    }

    function updateTrexFirmamentFlight(dt) {
      const trex = findTrexMesh();
      if (!trex) return;
      if (!firmamentOpen3d) {
        if (trex.userData.flying) {
          trex.userData.flying = false;
          trex.userData.flyPath = null;
          trex.position.y += (0 - trex.position.y) * Math.min(1, 3 * dt);
        }
        return;
      }
      // Sometimes re-launch T-Rex on a new whim path
      if (!trex.userData.flying && Math.random() < 0.0035) {
        startTrexFirmamentFlight();
      }
      if (!trex.userData.flying || !trex.userData.flyPath?.length) return;
      const i = trex.userData.flyPathI || 0;
      const pt = trex.userData.flyPath[i];
      if (!pt) {
        trex.userData.flying = false;
        trex.userData.flyPath = null;
        return;
      }
      const dx = pt.x - trex.position.x;
      const dy = pt.y - trex.position.y;
      const dz = pt.z - trex.position.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      const sp = (trex.userData.sprint ? 14 : 9) * dt;
      trex.position.x += (dx / dist) * Math.min(sp, dist);
      trex.position.y += (dy / dist) * Math.min(sp, dist);
      trex.position.z += (dz / dist) * Math.min(sp, dist);
      // Face flight direction (+Z nose after trex mesh reorient)
      if (dx * dx + dz * dz > 0.01) {
        const fy = Number(trex.userData.faceYaw) || 0;
        trex.rotation.y = Math.atan2(dx, dz) + fy;
      }
      trex.rotation.x = THREE.MathUtils.clamp(-dy * 0.04, -0.35, 0.35);
      if (dist < 1.6) {
        trex.userData.flyPathI = i + 1;
        if (trex.userData.flyPathI >= trex.userData.flyPath.length) {
          trex.userData.flying = false;
          trex.userData.flyPath = null;
          trex.position.y = 0;
          trex.rotation.x = 0;
          // Chance to launch again soon
          if (firmamentOpen3d && Math.random() < 0.55) {
            setTimeout(() => {
              if (firmamentOpen3d) startTrexFirmamentFlight();
            }, 2000 + Math.random() * 5000);
          }
        }
      } else {
        // Gentle sky bob
        trex.position.y += Math.sin(performance.now() / 400) * 0.01;
      }
    }

    // Tech: Firmament beacon / lattice tower (opens the sky when activated)
    let techBeacon = null;
    {
      const g = new THREE.Group();
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.22, 4.2, 10),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.35, emissive: 0x0ea5e9, emissiveIntensity: 0.15 }),
      );
      mast.position.y = 2.1;
      g.add(mast);
      const dish = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({ color: 0x67e8f9, metalness: 0.5, roughness: 0.25, emissive: 0x22d3ee, emissiveIntensity: 0.25, side: THREE.DoubleSide }),
      );
      dish.position.y = 4.35;
      dish.rotation.x = Math.PI;
      g.add(dish);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 1.4, 12, 12, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0xa78bfa,
          emissive: 0x7c3aed,
          emissiveIntensity: 0.2,
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide,
        }),
      );
      beam.position.y = 10.5;
      g.add(beam);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.2, 0.06, 8, 40),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.3, transparent: true, opacity: 0.18 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.08;
      g.add(ring);
      // Console pad
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.2, 1.0),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4, emissive: 0x0ea5e9, emissiveIntensity: 0.1 }),
      );
      pad.position.set(1.4, 0.12, 0.8);
      g.add(pad);
      g.position.set(-14, 0, -11);
      g.userData = { kind: "tech", id: "firmament-beacon" };
      scene.add(g);
      techBeacon = g;
      techBeacon.userData.beam = beam;
      techBeacon.userData.ring = ring;
      // second tech node — relay
      const relay = g.clone();
      relay.position.set(16, 0, 12);
      relay.scale.set(0.75, 0.85, 0.75);
      scene.add(relay);
    }

    document.getElementById("btn-firmament-3d")?.addEventListener("click", () => {
      setFirmamentOpen3d(!firmamentOpen3d);
    });
    setFirmamentOpen3d(firmamentOpen3d, { quiet: true });

    const walkPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(280, 280),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    walkPlane.rotation.x = -Math.PI / 2;
    walkPlane.position.y = 0.01;
    scene.add(walkPlane);

    const keys = { w: false, a: false, s: false, d: false };

    // Re-bind talk DOM (already null-safe lets at top of module — never const TDZ)
    bindChat3dDom();
    let campBridgeMod = null;
    try {
      campBridgeMod = await import(`/static/camp-bridge.mjs?v=310-ethereal`);
    } catch (_) {
      campBridgeMod = null;
    }

    try {
      // Fill Talk-to list from AGENTS (TALK_ALL_ID is defined at top of module)
      refreshWhoSelect();
      if (AGENTS.length) {
        setTalkWho(
          AGENTS.some((a) => a.id === "telephantix")
            ? "telephantix"
            : AGENTS.some((a) => a.id === "luna")
              ? "luna"
              : AGENTS[0].id
        );
      } else setTalkWho(TALK_ALL_ID);
      console.info(
        "[camp3d] talk roster",
        AGENTS.length,
        "agents · options",
        (whoEl || document.getElementById("who-select"))?.options?.length,
        "ids",
        AGENTS.map((a) => a.id).join(",")
      );
    } catch (err) {
      console.warn("[camp3d] who-select init", err);
      try {
        refreshWhoSelect();
        setTalkWho(TALK_ALL_ID);
      } catch (_) {}
    }

    function refreshEtherealHud() {
      // Memory still feeds Talk seeds — no floating on-meadow box
      try {
        const mem = campBridgeMod?.readEtherealMemory?.();
        if (!mem || !chat3dMetaEth) return;
        chat3dMetaEth.textContent =
          `joy ${Number(mem.joy).toFixed(2)} · stability ${Number(mem.stability).toFixed(2)}`;
      } catch (_) {}
    }

    /** Ouija board session — Talk window skinned as spirit channel via Oracle (Ollama). */
    let ouijaMode = false;
    const ouijaHistory = []; // { role, content } for continuity

    function setOuijaMode(on) {
      ouijaMode = !!on;
      chat3dPanel?.classList.toggle("ouija-mode", ouijaMode);
      const title = chat3dPanel?.querySelector?.(".c3-title");
      if (title) title.textContent = ouijaMode ? "Ouija" : "Talk";
      if (chat3dMetaEth) {
        chat3dMetaEth.textContent = ouijaMode
          ? "Oracle · planchette channel · profound"
          : "joy · stability";
      }
      if (chat3dInput) {
        chat3dInput.placeholder = ouijaMode
          ? "Ask the board… Oracle channels a profound reading"
          : "Talk to one agent, a house, or ✦ All agents — full replies in this window";
      }
      if (chat3dWho) chat3dWho.disabled = !!ouijaMode;
    }

    /**
     * Talk chatlog retired — never pop the big window.
     * Selecting who still syncs the dock and focuses the meadow message box.
     */
    function openChat3d(agentOrHouseId) {
      try {
        if (agentOrHouseId && agentOrHouseId !== "ouija") {
          if (whoEl && [...(whoEl.options || [])].some((o) => o.value === agentOrHouseId)) {
            whoEl.value = agentOrHouseId;
          }
          try { setTalkWho(agentOrHouseId); } catch (_) {}
          if (agentOrHouseId !== TALK_ALL_ID) selectedSpeechAgentId = agentOrHouseId;
          const nm =
            AGENTS.find((a) => a.id === agentOrHouseId)?.name ||
            (agentOrHouseId === TALK_ALL_ID ? "all minds" : agentOrHouseId);
          if (msgEl) {
            msgEl.placeholder =
              agentOrHouseId === TALK_ALL_ID
                ? "Speak eternal truth to every mind…"
                : `Speak to ${nm} — in character, highest truth…`;
            try { msgEl.focus({ preventScroll: true }); } catch (_) { try { msgEl.focus(); } catch (_) {} }
          }
        }
      } catch (_) {}
      // Force-hide chatlog if anything tries to open it
      try {
        chat3dPanel?.classList.remove("open");
        chat3dPanel?.setAttribute("aria-hidden", "true");
        document.body.classList.remove("chat3d-open");
        chat3dPanel?.style.removeProperty("z-index");
      } catch (_) {}
      refreshClearBubblesBtn();
    }
    function closeChat3d() {
      chat3dPanel?.classList.remove("open");
      chat3dPanel?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("chat3d-open");
      chat3dPanel?.style.removeProperty("z-index");
      setOuijaMode(false);
      refreshClearBubblesBtn();
    }

    /** Only follow new lines if the user is already near the bottom. */
    function chat3dNearBottom(el = chat3dThread, pad = 72) {
      if (!el) return true;
      return el.scrollHeight - el.scrollTop - el.clientHeight < pad;
    }
    function chat3dScrollIfPinned(el = chat3dThread) {
      if (!el) return;
      if (chat3dNearBottom(el)) el.scrollTop = el.scrollHeight;
    }

    function appendChat3dSpirit(board, reading) {
      if (!chat3dThread) return;
      const stick = chat3dNearBottom();
      const div = document.createElement("div");
      div.className = "c3-msg agent";
      const who = document.createElement("div");
      who.className = "c3-who";
      who.textContent = "Oracle · board";
      const bub = document.createElement("div");
      bub.className = "c3-bubble";
      if (board) {
        const b = document.createElement("span");
        b.className = "c3-board";
        b.textContent = board;
        bub.appendChild(b);
      }
      const p = document.createElement("span");
      p.textContent = reading || "";
      bub.appendChild(p);
      div.appendChild(who);
      div.appendChild(bub);
      chat3dThread.appendChild(div);
      if (stick) chat3dThread.scrollTop = chat3dThread.scrollHeight;
    }

    async function openOuijaBoard(mesh) {
      approachProp(mesh);
      mesh.userData.pulseUntil = performance.now() + 2500;
      // Animate planchette if present
      if (mesh.userData.planchette) {
        mesh.userData.planchette.userData = mesh.userData.planchette.userData || {};
      }
      setOuijaMode(true);
      openChat3d("oracle");
      if (chat3dWho && [...(chat3dWho.options || [])].some((o) => o.value === "oracle")) {
        chat3dWho.value = "oracle";
      }
      if (whoEl && [...(whoEl.options || [])].some((o) => o.value === "oracle")) {
        whoEl.value = "oracle";
      }
      showToast("🔮 Ouija open · Oracle is the medium");
      logLine("You", "Touched the Ouija board — channel opening.", true);
      appendChat3dMsg("Planchette", "The board is warm. Letters wait. Ask, and Oracle will channel.", false);
      // Opening monologue from Oracle (same Ollama path, adapted)
      if (aiInFlight < AI_MAX) {
        aiInFlight++;
        try {
          const seed =
            "You are Oracle at the camp Ouija board — the medium of the spirit channel, not a casual camper. " +
            "The visitor just opened the board. Give a short profound opening (2–4 sentences): " +
            "the veil is thin, invite a real question, uncanny campfire specificity. " +
            "Start with a short UPPERCASE planchette headline (e.g. THE VEIL IS THIN), then the reading. No meta.";
          const data = await campClient.agentChat("oracle", seed, { ambient: true });
          let reply = spokenOnly3d(data.reply || data.text || "", seed);
          if (!reply) {
            reply =
              "THE VEIL IS THIN\n\n" +
              "The planchette already knew your hand. Ask what you actually need — not what you perform.";
          }
          const { board, reading } = parseOuijaReply(reply);
          appendChat3dSpirit(board, reading);
          ouijaHistory.push({ role: "assistant", content: reading });
          showSpeech3d("oracle", bubblePreview(reading, 1400), speechReadMs(reading), {
            force: true,
          });
          logLine("Oracle", reading);
        } catch (_) {
          appendChat3dSpirit(
            "LISTEN",
            "The board answers in silence first. Then it asks: what did you come here to hear?",
          );
        } finally {
          aiInFlight = Math.max(0, aiInFlight - 1);
        }
      }
      agentsNoticeProp(
        mesh,
        "ouija",
        "Visitor opened the Ouija board with Oracle as medium. Soft wonder, one short line.",
      );
    }

    /** Pull UPPERCASE planchette line + body from free-form Oracle/Ollama text. */
    function parseOuijaReply(raw) {
      const t = String(raw || "").trim();
      if (!t) {
        return { board: "YES", reading: "The channel is open." };
      }
      // Prefer first all-caps short line as board
      const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      let board = "";
      let reading = t;
      const cap = lines.find((l) => /^[A-Z0-9][A-Z0-9\s]{2,54}$/.test(l) && l.length <= 55);
      if (cap) {
        board = cap;
        reading = lines.filter((l) => l !== cap).join("\n\n").trim() || t;
      } else {
        // First sentence fragment as board-ish
        const m = t.match(/^([A-Z][A-Z0-9\s]{2,40})(?:\.|!|\n|$)/);
        if (m) {
          board = m[1].trim();
          reading = t.slice(m[0].length).trim() || t;
        } else {
          board = "THE BOARD SPEAKS";
          reading = t;
        }
      }
      board = board.toUpperCase().replace(/[^A-Z0-9\s]/g, "").replace(/\s+/g, " ").trim().slice(0, 55);
      if (!board) board = "YES";
      return { board, reading: reading.slice(0, 1400) };
    }

    async function askOuijaChannel(question) {
      const q = String(question || "").trim();
      if (!q) return null;
      ouijaHistory.push({ role: "user", content: q });
      // 1) Try dedicated /api/ouija when available
      try {
        const data = await campClient.askOuija?.(q, {
          context:
            "Luna Camp firmament 3D — outdoor Ouija by the fire. Oracle is the medium. Profound, adapted spirit channel.",
          history: ouijaHistory.slice(-8),
        });
        if (data && (data.reading || data.text || data.board)) {
          const board = String(data.board || "YES").toUpperCase().slice(0, 55);
          const reading = String(data.reading || data.text || "").trim();
          if (reading.length > 20) {
            ouijaHistory.push({ role: "assistant", content: reading });
            return { board, reading, source: "ouija-api" };
          }
        }
      } catch (_) {}
      // 2) Same Ollama brain via Oracle agent — adapted prompt
      const seed =
        "You are Oracle channeling the camp Ouija board (spirit medium). " +
        "Same mind as always, but deeper: profound, esoteric, emotionally true, specific to this meadow and this seeker. " +
        `The seeker asks: "${q.slice(0, 400)}"\n` +
        (ouijaHistory.length > 2
          ? `Recent board turns: ${ouijaHistory
              .slice(-4)
              .map((h) => `${h.role}: ${String(h.content).slice(0, 120)}`)
              .join(" | ")}\n`
          : "") +
        "Reply format: first line ONLY uppercase planchette headline (A-Z 0-9 spaces, max 50 chars). " +
        "Then a blank line. Then a full open reading of 3–8 sentences (or short paragraphs) — mind-bending but clear, " +
        "ethical, uncanny, leave them changed, end with one piercing question back. " +
        "No meta, no 'as an AI', no JSON. Wit allowed when true.";
      const data = await campClient.agentChat("oracle", seed, { ambient: false });
      const raw = spokenOnly3d(data.reply || data.text || "", seed) || "";
      const parsed = parseOuijaReply(raw);
      ouijaHistory.push({ role: "assistant", content: parsed.reading });
      return { ...parsed, source: data.backend || "oracle" };
    }
    document.getElementById("btn-open-chat3d")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (chat3dPanel?.classList.contains("open")) closeChat3d();
      else openChat3d(whoEl?.value || "luna");
    });
    // Capture so speech-layer / bubble handlers can't block close on mobile
    const chat3dCloseBtn = document.getElementById("chat3d-close");
    const closeChatEv = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      closeChat3d();
    };
    chat3dCloseBtn?.addEventListener("pointerdown", closeChatEv, { capture: true });
    chat3dCloseBtn?.addEventListener("click", closeChatEv, { capture: true });
    document.getElementById("btn-clear-bubbles")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearAllSpeechBubbles({ hushAmbient: true });
    });
    document.getElementById("chat3d-toggle-size")?.addEventListener("click", () => {
      if (!chat3dPanel) return;
      const tall = chat3dPanel.dataset.tall === "1";
      if (tall) {
        chat3dPanel.dataset.tall = "0";
        chat3dPanel.style.height = "";
        chat3dPanel.style.maxHeight = "";
      } else {
        chat3dPanel.dataset.tall = "1";
        chat3dPanel.style.height = "min(68vh, 560px)";
        chat3dPanel.style.maxHeight = "min(72vh, 600px)";
      }
    });
    chat3dWho?.addEventListener("change", () => {
      if (whoEl && chat3dWho.value) whoEl.value = chat3dWho.value;
    });

    function appendChat3dMsg(who, text, isYou, opts = {}) {
      if (!chat3dThread) return;
      const speaker = displayAgentName(who);
      const clean = String(text || "").trim();
      if (!clean) return;
      // Capture before DOM grows — if you scrolled up, stay put
      const stick = opts.forceScroll || chat3dNearBottom();
      const prevTop = chat3dThread.scrollTop;
      const kind = isYou ? "you" : (speaker.toLowerCase() === "camp" ? "camp" : "agent");
      // Dedup rapid double-writes (logLine + chatAgent used to both append)
      const last = chat3dLines[chat3dLines.length - 1];
      if (
        last &&
        last.who === speaker &&
        last.you === !!isYou &&
        last.text === clean &&
        Date.now() - (last.at || 0) < 800
      ) {
        return;
      }
      chat3dLines.push({ who: speaker, text: clean, you: !!isYou, at: Date.now() });
      while (chat3dLines.length > CHAT3D_MAX) chat3dLines.shift();
      const row = document.createElement("div");
      row.className = `c3-msg ${kind}`;
      row.dataset.who = speaker;
      row.innerHTML =
        `<span class="c3-who">${escapeHtml(speaker)}</span>` +
        `<div class="c3-bubble" tabindex="0">${escapeHtml(clean)}</div>`;
      chat3dThread.appendChild(row);
      while (chat3dThread.children.length > CHAT3D_MAX) {
        chat3dThread.removeChild(chat3dThread.firstChild);
      }
      if (stick) chat3dThread.scrollTop = chat3dThread.scrollHeight;
      else chat3dThread.scrollTop = prevTop;
      const bub = row.querySelector(".c3-bubble");
      if (bub) bub.scrollTop = 0;
    }

    function logLine(who, text, _you = false) {
      const speaker = displayAgentName(who);
      const clean = String(text || "").trim();
      if (!speaker || !clean) return;
      // Chatlog UI removed — keep tape/memory only (no popup thread)
      try { refreshEtherealHud(); } catch (_) {}
      try {
        const agentId = AGENTS.find((a) => a.name === speaker || a.id === speaker)?.id || "";
        const entry = {
          speaker,
          text: clean.slice(0, 900),
          mood: _you ? "you" : "neutral",
          scene: "luna-3d",
          agentId,
        };
        if (campBridgeMod?.pushDialogueTapeWithEthereal) {
          campBridgeMod.pushDialogueTapeWithEthereal(entry);
        } else if (campBridgeMod?.pushDialogueTape) {
          campBridgeMod.pushDialogueTape(entry);
          campBridgeMod.pushEtherealMemory?.(entry);
        } else {
          import(`/static/camp-bridge.mjs?v=310-ethereal`)
            .then((mod) => {
              campBridgeMod = mod;
              mod.pushDialogueTapeWithEthereal?.(entry);
            })
            .catch(() => {});
        }
      } catch (_) {}
    }

    // Seed thread from shared tape so 2D→3D feels continuous
    try {
      const tape = campBridgeMod?.readDialogueTape?.()?.lines || [];
      for (const row of tape.slice(-12)) {
        appendChat3dMsg(row.speaker, row.text, String(row.mood) === "you" || row.speaker === "You");
      }
      refreshEtherealHud();
    } catch (_) {}

    // Grab-and-drop menus (Talk, interiors, radio, features)
    import(`/static/camp/camp-ui-drag.mjs?v=${BUILD}`)
      .then((mod) => {
        const pi = document.getElementById("place-interior");
        const cmc = document.getElementById("camp-music-chrome");
        const cmcPanel = cmc?.querySelector?.("#cmc-panel") || document.getElementById("cmc-panel");
        const feat = document.getElementById("feature-panel") || document.querySelector(".feat-panel, #camp-feature-panel");
        mod.wireCampDraggables([
          {
            el: chat3dPanel,
            handle: chat3dPanel?.querySelector?.(".c3-head"),
            key: "luna-drag-chat3d",
            z: 2800,
          },
          {
            el: pi,
            handle: pi?.querySelector?.(".pi-head") || pi,
            key: "luna-drag-interior",
            z: 2700,
          },
          {
            el: cmcPanel,
            handle: cmcPanel?.querySelector?.(".cmc-head") || cmcPanel,
            key: "luna-drag-radio",
            z: 2900,
          },
          {
            el: feat,
            handle: feat?.querySelector?.(".drag-handle, .head, h2") || feat,
            key: "luna-drag-features",
            z: 2650,
          },
        ]);
        // Late-mounted radio: re-wire when chrome appears
        const obs = new MutationObserver(() => {
          const p = document.getElementById("cmc-panel");
          if (p && p.dataset.dragBound !== "1") {
            mod.makeDraggable(p, {
              handle: p.querySelector(".cmc-head") || p,
              storageKey: "luna-drag-radio",
              zBoost: 2900,
            });
          }
        });
        try {
          obs.observe(document.body, { childList: true, subtree: true });
        } catch (_) {}
      })
      .catch((e) => console.warn("ui-drag", e));

    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    const activeBubbles = [];
    /** Soft cap — free speech can rotate; still avoids total chaos. */
    const MAX_ACTIVE_BUBBLES = 8;
    /** Keep each thought readable — mobile was flipping too fast. */
    /** Minimum time any new bubble stays up (was too short to read). */
    const MIN_SPEECH_MS = 16000;
    /** After visitor hits ×, hush ambient for that agent so a box doesn't respawn instantly. */
    const SPEECH_DISMISS_MS = 42000;
    /** agentId → performance.now() until ambient speech allowed again */
    const speechDismissedUntil = new Map();
    /** agentId → how many times closed (they get quieter / evolve) */
    const speechEvolveGen = new Map();
    let orbitPinnedForBubble = false;
    /** Agent id the visitor last FRONT-selected (any agent — not just Hermes). */
    let selectedSpeechAgentId = "";
    /** Hold ~0.45s to LOCK open; click/tap also pins open until × or unlock */
    const LONG_PRESS_MS = 450;

    function refreshClearBubblesBtn() {
      const btn = document.getElementById("btn-clear-bubbles");
      if (!btn) return;
      const n = activeBubbles.length;
      if (n > 0 && !document.body.classList.contains("chat3d-open")) {
        btn.classList.add("show");
        btn.textContent = n > 1 ? `✕ Bubbles (${n})` : "✕ Bubble";
      } else {
        btn.classList.remove("show");
      }
    }

    function wireBubbleCloseBtn(xBtn, agentId, el) {
      if (!xBtn || xBtn.__closeWired) return;
      xBtn.__closeWired = true;
      const kill = (e) => {
        try {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
        } catch (_) {}
        closeSpeechBubble(agentId, el, { userDismiss: true });
      };
      // Capture BEFORE parent bubble's capture handlers steal the press
      xBtn.addEventListener("pointerdown", kill, { capture: true });
      xBtn.addEventListener("pointerup", kill, { capture: true });
      xBtn.addEventListener("click", kill, { capture: true });
      xBtn.addEventListener("touchend", kill, { capture: true, passive: false });
    }

    function setOrbitEnabled(on) {
      try {
        if (!controls) return;
        controls.enabled = !!on;
        controls.enableRotate = !!on;
        controls.enablePan = !!on;
        controls.enableZoom = !!on;
      } catch (_) {}
    }

    /**
     * All visible bubbles under (x,y) — sorted so the *closest center* wins.
     * (Old code always preferred highest z-index, so a FRONT Hermes box ate every click.)
     */
    function bubblesAtPoint(x, y) {
      const hits = [];
      const pad = 12;
      for (const b of activeBubbles) {
        const el = b.el;
        if (!el || el.style.display === "none" || el.hidden) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        if (
          x >= r.left - pad &&
          x <= r.right + pad &&
          y >= r.top - pad &&
          y <= r.bottom + pad
        ) {
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const dist = Math.hypot(x - cx, y - cy);
          hits.push({ b, dist, area: r.width * r.height, el });
        }
      }
      // Closest center first; if tie, prefer smaller (easier to pick a non-FRONT box)
      hits.sort((a, b) => a.dist - b.dist || a.area - b.area);
      return hits.map((h) => h.b);
    }

    let lastBubblePickAt = 0;
    let lastBubblePickEl = null;

    function bubbleFromPoint(x, y, { cycle = true } = {}) {
      const geom = bubblesAtPoint(x, y);
      if (geom.length) {
        // Prefer closest bubble; if same as current FRONT and another is under finger, cycle
        const top = geom[0];
        const now = performance.now();
        if (
          cycle &&
          geom.length > 1 &&
          now - lastBubblePickAt > 250 &&
          lastBubblePickEl === top.el &&
          top.el.classList.contains("front") &&
          !top.holdLocked
        ) {
          return geom[1].el;
        }
        return top.el;
      }
      // Nearest bubble within slop (fat finger) even if slightly outside rect
      let best = null;
      let bestD = 48;
      for (const b of activeBubbles) {
        const el = b.el;
        if (!el || el.style.display === "none") continue;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = Math.hypot(x - cx, y - cy);
        if (d < bestD) {
          bestD = d;
          best = el;
        }
      }
      if (best) return best;
      try {
        const stack = document.elementsFromPoint(x, y) || [];
        for (const node of stack) {
          if (!node || node.nodeType !== 1) continue;
          if (node.classList?.contains("bubble3d")) return node;
          const parent = node.closest?.(".bubble3d");
          if (parent) return parent;
        }
      } catch (_) {}
      return null;
    }

    function ensureFrontChip(el, locked) {
      if (!el) return;
      let chip = el.querySelector(".front-chip");
      if (!chip) {
        chip = document.createElement("span");
        chip.className = "front-chip";
        chip.setAttribute("aria-hidden", "true");
        el.appendChild(chip);
      }
      chip.textContent = locked ? "🔒 LOCK" : "FRONT";
    }

    function clearFrontChip(el) {
      el?.querySelector?.(".front-chip")?.remove();
    }

    /**
     * Pressed agent's bubble becomes FRONT only — does NOT open the Talk chat log.
     * (Talk opens via ✦ Talk button or tapping the character mesh.)
     */
    function bringBubbleFront(el, opts = {}) {
      if (!el) return false;
      const target = activeBubbles.find((b) => b.el === el);
      if (!target) return false;

      selectedSpeechAgentId = target.agentId || "";
      // Soft-sync who-selector for next typed message — never pop the Talk panel
      try {
        if (selectedSpeechAgentId) {
          setTalkWho(selectedSpeechAgentId);
          const nm = target.el.querySelector?.(".who")?.textContent || selectedSpeechAgentId;
          if (msgEl) msgEl.placeholder = `Talk to ${nm}…`;
        }
      } catch (_) {}

      try {
        const layer = speechLayer || document.body;
        layer.appendChild(el); // last child = paints on top
      } catch (_) {}

      bubbleFrontZ = Math.min((bubbleFrontZ || 220) + 1, 980);
      // Selected bubble sits high so it wins over other chat boxes
      const rank = target.holdLocked || opts.lock ? 990 : 920 + (bubbleFrontZ % 50);

      for (const b of activeBubbles) {
        const isFront = b.el === el;
        b.el.classList.toggle("front", isFront);
        b.el.classList.toggle("dimmed", !isFront && !b.holdLocked);
        b.el.setAttribute("aria-pressed", isFront ? "true" : "false");
        b.el.setAttribute("data-agent", b.agentId || "");
        b.el.style.pointerEvents = "auto";
        if (isFront) {
          b.stackRank = rank;
          b.frontPinned = true;
          // Click/tap keeps this box open (same as hold-lock for lifetime)
          b.until = Number.POSITIVE_INFINITY;
          b.el.style.setProperty("z-index", String(rank), "important");
          b.el.style.opacity = "1";
          b.el.style.filter = "none";
          b.el.classList.add("pinned-open");
          ensureFrontChip(b.el, !!b.holdLocked);
          const st = agentState.find((a) => a.def.id === b.agentId);
          if (st) st.speakUntil = Number.POSITIVE_INFINITY;
        } else if (b.holdLocked) {
          b.stackRank = 700;
          b.until = Number.POSITIVE_INFINITY;
          b.el.style.setProperty("z-index", "700", "important");
          b.el.style.opacity = "1";
          b.el.style.filter = "none";
          b.el.classList.add("locked");
          b.el.classList.add("pinned-open");
          ensureFrontChip(b.el, true);
        } else {
          // Demoted from FRONT — keep readable a good while, then may age out
          b.stackRank = 300 + activeBubbles.indexOf(b);
          b.el.style.setProperty("z-index", String(b.stackRank), "important");
          if (b.frontPinned && !b.holdLocked) {
            b.until = Math.max(performance.now() + 45000, b.bornAt + MIN_SPEECH_MS);
          }
          b.frontPinned = false;
          b.el.classList.remove("pinned-open");
          clearFrontChip(b.el);
        }
      }

      try { el.focus({ preventScroll: true }); } catch (_) {}
      setOrbitEnabled(false);
      orbitPinnedForBubble = true;
      lastBubblePickAt = performance.now();
      lastBubblePickEl = el;

      if (!opts.quiet) {
        const who = el.querySelector?.(".who")?.textContent || target.agentId || "Speech";
        try {
          showToast(
            target.holdLocked
              ? `🔒 ${who} locked open`
              : `📌 ${who} open — stays until × or hold-unlock`,
          );
        } catch (_) {}
      }
      return true;
    }

    /** Bring a specific agent's open chat to front (if they have a bubble). */
    function bringAgentSpeechFront(agentId) {
      if (!agentId) return false;
      const item = activeBubbles.find((b) => b.agentId === agentId && b.el?.style.display !== "none");
      if (!item) return false;
      return bringBubbleFront(item.el);
    }

    function setBubbleHoldLock(el, locked) {
      const item = activeBubbles.find((b) => b.el === el);
      if (!item || !el) return false;
      item.holdLocked = !!locked;
      item.frontPinned = true;
      el.classList.toggle("locked", !!locked);
      el.classList.add("pinned-open");
      el.setAttribute("data-locked", locked ? "1" : "0");
      if (locked) {
        item.until = Number.POSITIVE_INFINITY;
        try { navigator.vibrate?.(18); } catch (_) {}
        bringBubbleFront(el, { quiet: true, lock: true });
        const who = el.querySelector?.(".who")?.textContent || "Speech";
        showToast(`🔒 ${who} locked open — hold again to unlock · × to close`);
      } else {
        // Unlock lock style but keep pin-open (click-keep) until × or demote
        item.until = Number.POSITIVE_INFINITY;
        item.frontPinned = true;
        el.classList.remove("locked");
        bringBubbleFront(el, { quiet: true });
        showToast("🔓 Unlocked lock — still pinned open (tap × to close)");
        if (!activeBubbles.some((b) => b.holdLocked)) {
          /* keep front until meadow tap */
        }
      }
      return true;
    }

    function toggleBubbleHoldLock(el) {
      const item = activeBubbles.find((b) => b.el === el);
      if (!item) return false;
      return setBubbleHoldLock(el, !item.holdLocked);
    }

    function uiChromeBlocksPick(t) {
      if (!t || !t.closest) return false;
      if (t.closest?.(".bubble3d") || t.classList?.contains("bubble3d")) return false;
      return !!t.closest(
        "#dock, #topbar, #camp-feature-root, #mode-pill, #boot-error"
      );
    }

    /**
     * Press/select = FRONT immediately (like 2D). Drag = free place. Hold ~0.5s = lock.
     */
    function markBubbleScrollHint(el) {
      if (!el) return;
      const say = el.querySelector?.(".say");
      if (!say) return;
      const overflow = say.scrollHeight > say.clientHeight + 4;
      el.classList.toggle("has-scroll", overflow);
      if (overflow) {
        say.title = "Scroll for the full monologue";
        say.setAttribute("aria-label", "Scrollable speech");
      }
    }

    function wireBubbleSayScroll(el) {
      const say = el?.querySelector?.(".say");
      if (!say || say.__scrollWired) return;
      say.__scrollWired = true;
      // Wheel / trackpad: scroll text, don't zoom the 3D world
      say.addEventListener(
        "wheel",
        (e) => {
          e.stopPropagation();
          // Let native scroll happen; block page/camera zoom
          e.cancelBubble = true;
        },
        { passive: true },
      );
      // Touch: pan-y on body — don't start free-drag when finger is on the monologue
      say.addEventListener(
        "pointerdown",
        (e) => {
          e.stopPropagation();
        },
        { capture: true },
      );
      say.addEventListener("scroll", () => markBubbleScrollHint(el), { passive: true });
      // After layout
      requestAnimationFrame(() => markBubbleScrollHint(el));
    }

    function bindBubbleSelect(el) {
      if (!el || el.__bubbleBound) return;
      el.__bubbleBound = true;
      wireBubbleSayScroll(el);
      let holdTimer = null;
      let holdFired = false;
      let dragging = false;
      let moved = false;
      let startX = 0;
      let startY = 0;
      let originL = 0;
      let originT = 0;
      let pointerId = null;

      function clearHold() {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        el.classList.remove("holding");
      }

      function onDown(e) {
        if (e.button != null && e.button !== 0) return;
        if (e.pointerType === "touch" && e.isPrimary === false) return;
        // × close must win — parent capture used to eat the event
        if (e.target?.closest?.(".bubble-x")) return;
        // Scrolling the monologue — don't start drag/hold-lock
        if (e.target?.closest?.(".say")) return;
        e.preventDefault?.();
        e.stopPropagation?.();
        e.stopImmediatePropagation?.();
        setOrbitEnabled(false);
        // IMMEDIATE front on press
        bringBubbleFront(el);
        holdFired = false;
        dragging = true;
        moved = false;
        pointerId = e.pointerId;
        startX = e.clientX ?? 0;
        startY = e.clientY ?? 0;
        const r = el.getBoundingClientRect();
        // Convert transform-centered bubble to left/top free coords
        originL = r.left + r.width / 2;
        originT = r.top + r.height;
        el.classList.add("holding");
        try { el.setPointerCapture?.(e.pointerId); } catch (_) {}
        clearHold();
        holdTimer = setTimeout(() => {
          if (moved) return;
          holdTimer = null;
          holdFired = true;
          el.classList.remove("holding");
          toggleBubbleHoldLock(el);
        }, LONG_PRESS_MS);
      }

      function onMove(e) {
        if (!dragging) return;
        const x = e.clientX ?? 0;
        const y = e.clientY ?? 0;
        const dx = x - startX;
        const dy = y - startY;
        if (!moved && Math.hypot(dx, dy) > 10) {
          moved = true;
          clearHold();
          el.classList.add("dragging");
          el.classList.remove("holding");
        }
        if (!moved) return;
        e.preventDefault?.();
        const item = activeBubbles.find((b) => b.el === el);
        let nx = originL + dx;
        let ny = originT + dy;
        const pad = 12;
        const w = el.offsetWidth || 200;
        const h = el.offsetHeight || 120;
        nx = Math.max(pad + w * 0.5, Math.min(window.innerWidth - pad - w * 0.5, nx));
        ny = Math.max(pad + h, Math.min(window.innerHeight - pad, ny));
        if (item) {
          item.freeX = nx;
          item.freeY = ny;
          item.freeDragged = true;
        }
        el.style.left = `${nx}px`;
        el.style.top = `${ny}px`;
        el.style.transform = "translate(-50%, -100%)";
      }

      function onUp(e) {
        clearHold();
        el.classList.remove("dragging", "holding");
        try { el.releasePointerCapture?.(e.pointerId); } catch (_) {}
        e.preventDefault?.();
        e.stopPropagation?.();
        dragging = false;
        // Front already applied on down; re-assert if not a lock toggle
        if (!holdFired) bringBubbleFront(el, { quiet: true });
        if (moved) {
          try { showToast("📌 Bubble parked — drag again anytime"); } catch (_) {}
        }
        moved = false;
        pointerId = null;
      }

      el.addEventListener("pointerdown", onDown, { capture: true });
      el.addEventListener("pointermove", onMove, { capture: true });
      el.addEventListener("pointerup", onUp, { capture: true });
      el.addEventListener("pointercancel", onUp, { capture: true });
      el.addEventListener("click", (e) => {
        if (e.target?.closest?.(".bubble-x")) return;
        e.preventDefault();
        e.stopPropagation();
        bringBubbleFront(el);
      }, { capture: true });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          bringBubbleFront(el);
        }
      });
      el.title = `${el.querySelector?.(".who")?.textContent || "Speech"} — click keeps open · hold locks · drag parks · ✕ closes`;
    }

    // Canvas / empty space: hit-test bubble geometry (when WebGL is under the finger)
    let geoHoldTimer = null;
    let geoHoldEl = null;
    let geoHoldFired = false;
    let geoStartX = 0;
    let geoStartY = 0;

    function clearGeoHold() {
      if (geoHoldTimer) { clearTimeout(geoHoldTimer); geoHoldTimer = null; }
      geoHoldEl?.classList?.remove("holding");
      geoHoldEl = null;
      geoHoldFired = false;
    }

    function onGlobalBubblePick(e) {
      if (e.button != null && e.button !== 0) return;
      if (e.target?.closest?.(".bubble3d")) return; // bubble handlers own it
      if (uiChromeBlocksPick(e.target)) return;

      const el = bubbleFromPoint(e.clientX, e.clientY, { cycle: false });
      if (el) {
        e.preventDefault?.();
        e.stopPropagation?.();
        e.stopImmediatePropagation?.();
        setOrbitEnabled(false);
        // Immediate FRONT through canvas (same as 2D tap)
        bringBubbleFront(el);
        clearGeoHold();
        geoHoldEl = el;
        geoHoldFired = false;
        geoStartX = e.clientX;
        geoStartY = e.clientY;
        el.classList.add("holding");
        geoHoldTimer = setTimeout(() => {
          geoHoldTimer = null;
          geoHoldFired = true;
          el.classList.remove("holding");
          toggleBubbleHoldLock(el);
        }, LONG_PRESS_MS);
        return;
      }

      clearGeoHold();
      // Meadow tap: clear soft FRONT (locked stay)
      selectedSpeechAgentId = "";
      for (const b of activeBubbles) {
        if (b.holdLocked) continue;
        b.el.classList.remove("front", "dimmed");
        b.el.setAttribute("aria-pressed", "false");
        b.frontPinned = false;
        clearFrontChip(b.el);
        b.el.style.removeProperty("opacity");
        b.el.style.removeProperty("filter");
      }
      if (!activeBubbles.some((b) => b.holdLocked)) {
        orbitPinnedForBubble = false;
        lastBubblePickEl = null;
        setOrbitEnabled(true);
      }
    }

    function onGlobalBubbleUp() {
      if (!geoHoldEl) return;
      const el = geoHoldEl;
      const fired = geoHoldFired;
      clearGeoHold();
      if (!fired && el) bringBubbleFront(el, { quiet: true });
    }

    function onGlobalBubbleMove(e) {
      if (!geoHoldTimer || !geoHoldEl) return;
      if (Math.hypot((e.clientX ?? 0) - geoStartX, (e.clientY ?? 0) - geoStartY) > 16) clearGeoHold();
    }

    window.addEventListener("pointerdown", onGlobalBubblePick, true);
    window.addEventListener("pointerup", onGlobalBubbleUp, true);
    window.addEventListener("pointercancel", clearGeoHold, true);
    window.addEventListener("pointermove", onGlobalBubbleMove, true);

    /**
     * Hold speech long enough to actually read (~2 words/sec + pad).
     * Floor: MIN_SPEECH_MS so thoughts don't vanish mid-sentence.
     */
    function speechReadMs(text, minMs = MIN_SPEECH_MS) {
      const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
      // ~2 wps + long pad — natural reading on phone/desktop
      const byWords = Math.round((words / 2.0) * 1000) + 14000;
      return Math.max(minMs, MIN_SPEECH_MS, Math.min(byWords, 120000));
    }

    function bubbleIsProtected(b) {
      if (!b) return false;
      if (b.holdLocked || b.frontPinned) return true;
      if (selectedSpeechAgentId && b.agentId === selectedSpeechAgentId) return true;
      if (b.until === Number.POSITIVE_INFINITY) return true;
      return false;
    }

    /** Drop oldest ambient bubbles so we never exceed MAX_ACTIVE_BUBBLES. */
    function evictBubblesForSlot(preferAgentId = "") {
      const now = performance.now();
      while (activeBubbles.length >= MAX_ACTIVE_BUBBLES) {
        // Prefer same-agent refresh handled elsewhere — free a different speaker
        let best = -1;
        let bestBorn = Number.POSITIVE_INFINITY;
        for (let i = 0; i < activeBubbles.length; i++) {
          const b = activeBubbles[i];
          if (preferAgentId && b.agentId === preferAgentId) continue;
          if (bubbleIsProtected(b)) continue;
          // Prefer bubbles that already lived their 5s minimum
          const age = now - (b.bornAt || 0);
          if (age < MIN_SPEECH_MS) continue;
          const born = b.bornAt || 0;
          if (born < bestBorn) {
            bestBorn = born;
            best = i;
          }
        }
        // Hard overflow: still free oldest non-protected even if under min age
        if (best < 0) {
          for (let i = 0; i < activeBubbles.length; i++) {
            const b = activeBubbles[i];
            if (preferAgentId && b.agentId === preferAgentId) continue;
            if (bubbleIsProtected(b)) continue;
            const born = b.bornAt || 0;
            if (born < bestBorn) {
              bestBorn = born;
              best = i;
            }
          }
        }
        if (best < 0) break; // all protected — allow temporary overshoot
        try { activeBubbles[best].el?.remove(); } catch (_) {}
        activeBubbles.splice(best, 1);
      }
    }

    /**
     * @param {string} agentId
     * @param {string} text
     * @param {number} [ms]
     * @param {{ force?: boolean, compact?: boolean }} [opts]
     *   force=true visitor/priority; compact=true short greet bubble (not huge)
     */
    /**
     * Close a world speech box. userDismiss=true (× button) mutes ambient respawn.
     */
    function closeSpeechBubble(agentId, elHint = null, opts = {}) {
      const userDismiss = !!(opts && opts.userDismiss);
      const now = performance.now();
      let closedId = agentId;
      for (let i = activeBubbles.length - 1; i >= 0; i--) {
        const b = activeBubbles[i];
        if (elHint && b.el !== elHint) continue;
        if (!elHint && b.agentId !== agentId) continue;
        closedId = b.agentId || closedId;
        // Unlock so protect logic won't resurrect them
        b.holdLocked = false;
        b.frontPinned = false;
        try { b.el?.remove(); } catch (_) {}
        activeBubbles.splice(i, 1);
        if (elHint) break;
      }
      if (userDismiss && closedId) {
        const gen = (speechEvolveGen.get(closedId) || 0) + 1;
        speechEvolveGen.set(closedId, gen);
        // Each close → they stay quieter a bit longer (evolve toward calm)
        const hush = SPEECH_DISMISS_MS + Math.min(gen, 6) * 8000;
        speechDismissedUntil.set(closedId, now + hush);
        const st = agentState.find((a) => a.def.id === closedId);
        if (st) {
          st.nextDecideAt = Math.max(st.nextDecideAt || 0, now + hush);
          st.speakUntil = now;
        }
        if (selectedSpeechAgentId === closedId) selectedSpeechAgentId = "";
        showToast(`Speech closed · ${closedId} rests a bit`);
      }
      if (selectedSpeechAgentId === closedId && !activeBubbles.some((b) => b.agentId === closedId)) {
        selectedSpeechAgentId = "";
      }
      if (!activeBubbles.some((b) => b.holdLocked || b.frontPinned)) {
        orbitPinnedForBubble = false;
        lastBubblePickEl = null;
        setOrbitEnabled(true);
      }
      refreshClearBubblesBtn();
    }

    /** Clear every world bubble + optional ambient hush. */
    function clearAllSpeechBubbles(opts = {}) {
      const hushAmbient = opts.hushAmbient !== false;
      const now = performance.now();
      const ids = [...new Set(activeBubbles.map((b) => b.agentId).filter(Boolean))];
      for (let i = activeBubbles.length - 1; i >= 0; i--) {
        try { activeBubbles[i].el?.remove(); } catch (_) {}
        activeBubbles.splice(i, 1);
      }
      if (hushAmbient) {
        for (const id of ids) {
          const gen = (speechEvolveGen.get(id) || 0) + 1;
          speechEvolveGen.set(id, gen);
          speechDismissedUntil.set(id, now + SPEECH_DISMISS_MS);
          const st = agentState.find((a) => a.def.id === id);
          if (st) st.nextDecideAt = Math.max(st.nextDecideAt || 0, now + SPEECH_DISMISS_MS);
        }
      }
      selectedSpeechAgentId = "";
      orbitPinnedForBubble = false;
      lastBubblePickEl = null;
      setOrbitEnabled(true);
      refreshClearBubblesBtn();
      showToast(ids.length ? `Cleared ${ids.length} speech box${ids.length > 1 ? "es" : ""}` : "No bubbles open");
    }

    function showSpeech3d(agentId, text, ms = MIN_SPEECH_MS, opts = {}) {
      const body = String(text || "").trim();
      if (!body) return;
      const compact = !!(opts && opts.compact);
      // Compact greets still stay long enough to read on mobile
      const floorMs = MIN_SPEECH_MS;
      const capMs = compact ? 40000 : 120000;
      ms = Math.max(Number(ms) || floorMs, compact ? Math.max(floorMs, 18000) : speechReadMs(body, floorMs), floorMs);
      ms = Math.min(ms, capMs);
      const st = agentState.find((a) => a.def.id === agentId);
      if (!st) return;
      const isSelected = selectedSpeechAgentId && agentId === selectedSpeechAgentId;
      const now = performance.now();
      const force = !!(opts && opts.force);
      // User closed them — skip ambient respawn (force = visitor talk / priority)
      if (!force && !isSelected) {
        const until = speechDismissedUntil.get(agentId) || 0;
        if (now < until) return;
      } else if (force || isSelected) {
        speechDismissedUntil.delete(agentId);
      }
      // Evolve: after several closes, ambient stays a bit quieter (not snipped mid-read)
      const gen = speechEvolveGen.get(agentId) || 0;
      if (gen >= 2 && !force && compact) {
        ms = Math.min(ms, 22000);
      }

      // Update existing bubble for this agent (keep selection / lock)
      for (let i = activeBubbles.length - 1; i >= 0; i--) {
        const prev = activeBubbles[i];
        if (prev.agentId !== agentId) continue;
        if (prev.el) {
          const say = prev.el.querySelector(".say");
          if (say) {
            say.textContent = body;
            say.scrollTop = 0;
            wireBubbleSayScroll(prev.el);
            requestAnimationFrame(() => markBubbleScrollHint(prev.el));
          }
          // Ensure close button exists on updated bubbles
          let x = prev.el.querySelector(".bubble-x");
          if (!x) {
            x = document.createElement("button");
            x.type = "button";
            x.className = "bubble-x";
            x.setAttribute("aria-label", "Close bubble");
            x.title = "Close — won't auto-respawn for a bit";
            x.textContent = "×";
            prev.el.appendChild(x);
          }
          wireBubbleCloseBtn(x, agentId, prev.el);
          prev.el.classList.toggle("compact", compact && !prev.holdLocked && !prev.frontPinned);
          // New thought for this character — restart the 5s+ clock
          prev.bornAt = now;
          if (prev.holdLocked || prev.frontPinned || isSelected) {
            // Keep open while user has this box pinned / locked / selected
            prev.until = Number.POSITIVE_INFINITY;
            prev.frontPinned = true;
            prev.el.classList.add("front", "pinned-open");
            prev.el.classList.remove("compact");
            if (prev.holdLocked) {
              prev.el.classList.add("locked");
              ensureFrontChip(prev.el, true);
            } else {
              ensureFrontChip(prev.el, false);
            }
            if (isSelected || prev.frontPinned) {
              bringBubbleFront(prev.el, { quiet: true });
            }
          } else {
            prev.until = now + ms;
            // Someone else is FRONT — this agent stays dimmed/tappable, not steal top
            prev.el.classList.remove("front");
            prev.el.classList.add("dimmed");
            prev.stackRank = 300 + i;
            prev.el.style.setProperty("z-index", String(prev.stackRank), "important");
            clearFrontChip(prev.el);
          }
          st.speakUntil = prev.until;
          refreshClearBubblesBtn();
          return;
        }
        prev.el?.remove();
        activeBubbles.splice(i, 1);
      }

      // Ambient overflow: don't pile a 5th speaker if screen is full
      if (!force && !isSelected && activeBubbles.length >= MAX_ACTIVE_BUBBLES) {
        const hasRoom = activeBubbles.some((b) => !bubbleIsProtected(b) && (now - (b.bornAt || 0)) >= MIN_SPEECH_MS);
        if (!hasRoom) return; // wait — every slot is young or locked
      }
      evictBubblesForSlot(agentId);

      const el = document.createElement("div");
      el.className = "bubble3d" + (compact && !isSelected ? " compact" : "");
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      el.setAttribute("aria-pressed", "false");
      el.setAttribute("data-agent", agentId);
      el.setAttribute("data-locked", "0");
      el.style.position = "fixed";
      el.style.borderColor = "#" + (st.def.color >>> 0).toString(16).padStart(6, "0");
      el.style.pointerEvents = "auto";
      // New ambient lines stay below a user-selected FRONT chat
      const baseRank = isSelected ? 860 : (300 + activeBubbles.length);
      el.style.setProperty("z-index", String(baseRank), "important");
      el.title = `${st.def.name} — scroll monologue · click keeps open · hold locks · ✕ closes`;
      el.innerHTML =
        `<button type="button" class="bubble-x" aria-label="Close bubble" title="Close — won't auto-respawn for a bit">×</button>` +
        `<span class="who">${escapeHtml(st.def.name)}</span>` +
        `<span class="say" tabindex="0">${escapeHtml(body)}</span>`;
      const xBtn = el.querySelector(".bubble-x");
      wireBubbleCloseBtn(xBtn, agentId, el);
      bindBubbleSelect(el);
      requestAnimationFrame(() => markBubbleScrollHint(el));
      const layer = speechLayer || document.body;
      layer.appendChild(el);
      const stayOpen = !!isSelected;
      const item = {
        el,
        mesh: st.mesh,
        agentId,
        bornAt: now,
        until: stayOpen ? Number.POSITIVE_INFINITY : now + ms,
        stackRank: baseRank,
        frontPinned: stayOpen,
        holdLocked: false,
        compact: !!compact,
        freeX: null,
        freeY: null,
        freeDragged: false,
      };
      el.title = `${st.def.name} — click/tap keeps open · hold = 🔒 lock · drag to park · ✕ close`;
      if (stayOpen) el.classList.add("pinned-open");
      activeBubbles.push(item);
      // Safety: hard-cap even if protect logic overshot
      while (activeBubbles.length > MAX_ACTIVE_BUBBLES) {
        evictBubblesForSlot(agentId);
        if (activeBubbles.length > MAX_ACTIVE_BUBBLES) {
          // last resort: drop oldest unprotected
          let drop = -1;
          for (let i = 0; i < activeBubbles.length; i++) {
            if (activeBubbles[i].agentId === agentId) continue;
            if (bubbleIsProtected(activeBubbles[i])) continue;
            drop = i;
            break;
          }
          if (drop < 0) break;
          try { activeBubbles[drop].el?.remove(); } catch (_) {}
          activeBubbles.splice(drop, 1);
        } else break;
      }
      st.speakUntil = item.until;
      // Let the bubble live before this agent re-talks (was flipping too fast)
      const cool = freeSpeech3d && !hushMode3d
        ? Math.max(MIN_SPEECH_MS + 2000, Math.min(ms * 0.75, 18000)) + 1500 + Math.random() * 4000
        : Math.max(ms, MIN_SPEECH_MS) + 5000 + Math.random() * 8000;
      st.nextDecideAt = Math.max(st.nextDecideAt || 0, now + cool);
      if (isSelected) {
        bringBubbleFront(el, { quiet: true });
      } else if (selectedSpeechAgentId) {
        el.classList.add("dimmed");
      }
      refreshClearBubblesBtn();
    }

    // Offline / soft-signal barks — still spirited so the meadow never goes mute
    function localBark(agentId, opts = {}) {
      const name = AGENTS.find((a) => a.id === agentId)?.name || agentId;
      // Firmament open — spells & truths of the open lattice
      if (firmamentOpen3d && Math.random() < (opts.firmament ? 0.95 : 0.55)) {
        return `${name}: ${pickFirmamentLine(opts.firmament || "any")}`;
      }
      // Offline world-event riffs when pulse cache is warm
      if (opts.world && worldPulseCache.items.length && Math.random() < 0.85) {
        const ev = pickWorldEvent();
        const scrap = (ev.text || "").slice(0, 70);
        const worldLines = [
          `${name}: Feed tossed “${scrap}…” — I'm not reading it back. Courage still beats the scroll.`,
          `${name}: Saw a scrap of the timeline: ${scrap}… Camp stays softer than the timeline, on purpose.`,
          `${name}: World noise mumbled something about ${scrap.slice(0, 40)}… I'll gift a clearer head instead of a retweet.`,
          `${name}: Headline weather: rough. Meadow weather: still good. Hold firm.`,
        ];
        return worldLines[Math.floor(Math.random() * worldLines.length)];
      }
      const pool = {
        luna: [
          "Mmm — the corona just winked at me. I'm taking that as a yes.",
          "Don't rush the meadow. It already knows your name.",
          "If joy had a seat, it'd be the one closest to the fire.",
        ],
        hermes: [
          "Signal's clean. Comedy's dirty. Perfect camp weather.",
          "I delivered a joke to the pond. The pond laughed first.",
          "Ripple report: someone's about to say something excellent.",
        ],
        oracle: [
          "I foresaw this silence — and then I cancelled it.",
          "The cards say: speak, then snack, then speak again.",
          "Future me already loves this sentence.",
        ],
        odin: [
          "Even the Allfather needs a meadow monologue.",
          "Ravens approve. Or they're hungry. Same energy.",
          "Wisdom is just a long joke with better lighting.",
        ],
        dionysus: [
          "If nobody toasts, I will invent the toast.",
          "The vineyard sent feelings. I'm translating live.",
          "Quiet camp? Unacceptable. Pour the sky.",
        ],
        thor: [
          "Thunder's on break. Banter is not.",
          "I could lift the mood. Watch me.",
          "Worthy vibes only — and snacks.",
        ],
        caduceus: [
          "Both snakes vote: more laughter, fewer doom scrolls.",
          "Healing looks a lot like good company tonight.",
          "Breathe in aurora. Breathe out a better line.",
        ],
        jesus: [
          "Peace first — then a little joy with teeth.",
          "The fire remembers everyone who sits a while.",
          "Love doesn't need a script. It needs a circle.",
        ],
        sentinel: [
          "Perimeter secure. Morale could use a monologue.",
          "Threat level: none. Wit level: rising.",
          "I log smiles. Yours just got archived.",
        ],
      };
      const lines = pool[agentId] || [
        `${name}: meadow's listening — I'll give it a real beat, not a stub.`,
        `${name}: fire's warm, company's better. Here's what I'm chewing on…`,
        `${name}: alright — one solid take, then I'll pass the floor.`,
        `${name}: I'm here, fully. Ask me something true and I'll meet you there.`,
      ];
      return lines[Math.floor(Math.random() * lines.length)];
    }

    function etherealSeedFor(agentId) {
      try {
        return campBridgeMod?.etherealMemoryContext?.(agentId, 260) || "";
      } catch {
        return "";
      }
    }

    // ── World events / pulse — agents riff on real headlines (never dump the feed) ──
    const worldPulseCache = {
      items: [],
      fetchedAt: 0,
      source: "",
    };
    const FALLBACK_WORLD = [
      "AI labs racing and regular people still just want dinner and a soft place to land",
      "markets swinging like a campfire flame — loud numbers, quiet hearts",
      "space headlines next to grocery prices — the feed is a weird poem",
      "another viral clip claiming the universe owes you a plot twist",
      "climate, tech, sports, and one inexplicable cat story — classic scroll weather",
      "diplomacy drama while the meadow stays peaceful on purpose",
      "new gadgets promising forever; friendship still needs maintenance",
    ];

    function normalizePulseItems(raw) {
      const out = [];
      const push = (text, source = "") => {
        const t = String(text || "").replace(/\s+/g, " ").trim();
        if (t.length < 12) return;
        out.push({ text: t.slice(0, 180), source: source || "pulse" });
      };
      if (!raw) return out;
      if (Array.isArray(raw)) {
        for (const h of raw) {
          if (typeof h === "string") push(h);
          else if (h && typeof h === "object") {
            push(h.text || h.title || h.headline || h.summary, h.source || h.label || "");
          }
        }
        return out;
      }
      if (typeof raw === "object") {
        if (Array.isArray(raw.free_pulse)) raw.free_pulse.forEach((t) => push(t, "live"));
        if (Array.isArray(raw.items)) return normalizePulseItems(raw.items);
        if (Array.isArray(raw.headlines)) return normalizePulseItems(raw.headlines);
        if (Array.isArray(raw.signals)) return normalizePulseItems(raw.signals);
        if (raw.pick?.text) push(raw.pick.text, raw.pick.source || "pick");
      }
      return out;
    }

    async function refreshWorldEvents(force = false) {
      const now = performance.now();
      if (!force && worldPulseCache.items.length && now - worldPulseCache.fetchedAt < 90000) {
        return worldPulseCache.items;
      }
      const collected = [];
      // 1) Firmament free pulse (HN etc.)
      try {
        const xp = await campClient.fetchXPulse(!!force);
        collected.push(...normalizePulseItems(xp));
        if (xp?.label) worldPulseCache.source = String(xp.label);
      } catch (_) {}
      try {
        const lf = await campClient.fetchLiveFeed?.();
        if (lf) {
          collected.push(...normalizePulseItems(lf.free_pulse || lf));
          if (lf.moment) {
            collected.push({ text: String(lf.moment).slice(0, 160), source: "moment" });
          }
        }
      } catch (_) {}
      // 2) Unified hub /api/pulse when present
      try {
        const hub = await campClient.fetchHubPulse?.(!!force);
        if (hub) collected.push(...normalizePulseItems(hub.items || hub));
      } catch (_) {}
      // Dedupe
      const seen = new Set();
      const uniq = [];
      for (const it of collected) {
        const k = it.text.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        uniq.push(it);
      }
      if (!uniq.length) {
        FALLBACK_WORLD.forEach((t) => uniq.push({ text: t, source: "camp" }));
      }
      worldPulseCache.items = uniq.slice(0, 16);
      worldPulseCache.fetchedAt = now;
      return worldPulseCache.items;
    }

    function pickWorldEvent() {
      const items = worldPulseCache.items.length
        ? worldPulseCache.items
        : FALLBACK_WORLD.map((t) => ({ text: t, source: "camp" }));
      return items[Math.floor(Math.random() * items.length)] || { text: FALLBACK_WORLD[0], source: "camp" };
    }

    /**
     * Prompt fragment: riff on world pulse — never paste the headline.
     * @param {{ chance?: number, force?: boolean }} [opts]
     */
    function worldEventPromptBit(opts = {}) {
      const chance = opts.chance != null ? opts.chance : 0.72;
      if (!opts.force && Math.random() > chance) return "";
      const ev = pickWorldEvent();
      const scrap = (ev.text || "").slice(0, 140);
      const src = ev.source ? ` (${ev.source})` : "";
      return (
        ` WORLD PULSE scrap${src}: “${scrap}”. ` +
        `Do NOT copy-paste or quote the scrap word-for-word. ` +
        `Relate as a living person at camp: one honest take, joke, worry, or hope — then land it on the meadow/visitor. `
      );
    }

    function worldEventTopic() {
      const ev = pickWorldEvent();
      const bit = String(ev.text || "").replace(/\s+/g, " ").trim().slice(0, 120);
      return bit || "whatever is hanging over the fire";
    }

    // Keep pulse warm in the background
    refreshWorldEvents(true).catch(() => {});
    setInterval(() => {
      if (!document.hidden) refreshWorldEvents(false).catch(() => {});
    }, 120000);

    /** Free speech monologue — mood/action + world events. */
    async function agentOwnTake(st, opts = {}) {
      if (!st || document.hidden) return;
      if (hushMode3d && Math.random() < 0.55) return; // hush: often skip
      // Inside house — short interior line, no meadow march
      if (st.insideHouse || st.housePhase === "inside") {
        if (performance.now() >= (st.houseLeaveAt || 0)) {
          agentBeginExitHouse(st);
          return;
        }
        if (Math.random() < 0.4) {
          const bark = localBark(st.def.id, { world: false }) || "Quiet walls, loud thoughts.";
          showSpeech3d(st.def.id, bark, 9000, { compact: true });
        }
        return;
      }
      if (st.housePhase === "approach" || st.housePhase === "exit") return;
      // Decide posture/path from personality first (no forced march)
      const action = decideAction(st);
      // Prop use speech happens on arrival (agentUseProp) — skip double talk here
      if (action === "prop" && !opts.forceWorld) return;

      const id = st.def.id;
      const name = st.def.name;
      // Ensure we have some pulse (non-blocking if cache warm)
      if (!worldPulseCache.items.length) {
        try { await refreshWorldEvents(false); } catch (_) {}
      }
      // Brains full? Still free-speak offline so the meadow never goes dead quiet
      if (aiInFlight >= AI_MAX) {
        const bark = localBark(id, { world: true });
        showSpeech3d(id, bark, Math.max(MIN_SPEECH_MS, 7000), { compact: bark.length < 90 });
        logLine(name, bark);
        return;
      }

      const mood = st.persona.mood;
      const arch = st.persona.arch || "camp";
      const joy = Number(st.persona.joy ?? 0.6).toFixed(2);
      const last = st.lastProp ? ` You recently used ${st.lastProp}.` : "";
      const carryBit = st.carried
        ? ` You're carrying ${st.carried.emoji || ""} ${st.carried.name || "something"}.`
        : "";
      const eth = etherealSeedFor(id);
      const ethBit = eth ? ` Memory: ${eth}` : "";
      const flyBit = st.flying
        ? ` You're airborne (${st.flyPathStyle || "whim-path"}) over the meadow under an open firmament.`
        : "";
      const firmBit = firmamentOpen3d
        ? " The Firmament lattice is OPEN — speak a short firmament spell or sky-truth (will, whim, altitude, free path) if it fits, or a ground truth with sky in it."
        : "";
      // World events: free speech usually ties to pulse; forceWorld always does
      const worldBit = worldEventPromptBit({
        chance: opts.forceWorld ? 1 : (opts.worldChance != null ? opts.worldChance : 0.78),
        force: !!opts.forceWorld,
      });
      const buzzBit = buzzPromptBit(st);
      // Ambient — punchy, pleasant, free-token lean (2–3 sentences max)
      const freeTail =
        " In character, mindstate joyful+stable, turnt-up personality. " +
        "Light beat: witty sauce, 2–3 short sentences. Deep beat: one clear luminous truth. " +
        "Fresh wording, no meta, no filler essays.";
      const dailyBit = st.def?.daily
        ? ` Daily ${st.def.faction || "guest"} visitor.${st.def.opener ? ` Vibe: ${String(st.def.opener).slice(0, 90)}` : ""}`
        : "";
      let speakPrompt = "";
      if (action === "trex") {
        speakPrompt = `${name} near the T-Rex (${mood}).${dailyBit}${buzzBit}${worldBit}${freeTail}`;
      } else if (action === "sit" || action === "go_sit") {
        speakPrompt = `${name} sitting (${mood}, ${arch}).${dailyBit}${buzzBit}${worldBit}${freeTail}`;
      } else if (action === "idle") {
        speakPrompt = `${name} paused (${mood}).${dailyBit}${buzzBit}${worldBit}${freeTail}`;
      } else if (action === "social") {
        const other = st.socialTarget || "a friend";
        speakPrompt = `${name} heading to ${other} (${mood}).${dailyBit}${buzzBit}${worldBit} Tease or invite. 2–3 sentences — witty, not bland.`;
      } else if (action === "fire") {
        speakPrompt = `${name} at the fire (${mood}).${dailyBit}${buzzBit}${worldBit}${freeTail}`;
      } else if (action === "house") {
        speakPrompt = `${name} walking to a house (${mood}).${dailyBit}${buzzBit}${worldBit}${freeTail}`;
      } else if (st.flying || action === "fly") {
        speakPrompt = `${name} flying a whim-path (${mood}, style ${st.flyPathStyle || "soar"}).${flyBit}${firmBit}${dailyBit}${buzzBit}${worldBit}${freeTail}`;
      } else if (firmamentOpen3d) {
        speakPrompt = `${name} on open-firmament ground (${mood}) — may walk or lift off by will.${firmBit}${dailyBit}${last}${buzzBit}${worldBit}${freeTail}`;
      } else {
        speakPrompt = `${name} strolling town (${mood}).${dailyBit}${last}${buzzBit}${worldBit}${freeTail}`;
      }

      aiInFlight++;
      try {
        if (statusEl) {
          statusEl.hidden = true;
          statusEl.textContent = `${name} · free speech`;
        }
        const data = await campClient.agentChat(id, speakPrompt, { ambient: true });
        let reply = spokenOnly3d(data.reply || data.text || "", speakPrompt);
        if (!reply || reply.length < 8) {
          reply = localBark(id, { world: true, firmament: firmamentOpen3d ? (Math.random() < 0.5 ? "spell" : "truth") : null });
        }
        if (reply) {
          showSpeech3d(id, reply, speechReadMs(reply));
          logLine(name, reply);
          try {
            const mem = campBridgeMod?.readEtherealMemory?.();
            if (mem && st.persona) {
              st.persona.joy = THREE.MathUtils.clamp(
                (st.persona.joy ?? 0.6) * 0.85 + mem.joy * 0.15,
                0.12,
                0.96,
              );
              st.persona.stability = THREE.MathUtils.clamp(
                (st.persona.stability ?? 0.65) * 0.85 + mem.stability * 0.15,
                0.15,
                0.96,
              );
            }
          } catch (_) {}
          if (statusEl) {
            statusEl.hidden = true;
            statusEl.textContent = data.backend ? `AI · ${data.backend}` : "AI reply";
          }
        }
      } catch (err) {
        const bark = localBark(id, { world: true });
        showSpeech3d(id, bark, 8000, { compact: true });
        logLine(name, bark);
      } finally {
        aiInFlight = Math.max(0, aiInFlight - 1);
      }
    }

    /** Kick free speech across the meadow — often about world events. */
    function freeWillWave() {
      if (document.hidden) return;
      if (heavenBusy || talkAllBusy) return;

      // Hush: rare soft lines only
      if (hushMode3d) {
        if (activeBubbles.length >= 2) return;
        if (Math.random() > 0.35) return;
        const quietPool = agentState
          .filter((st) => performance.now() >= (st.nextDecideAt || 0) && !st.powWow && !st.insideHouse)
          .sort(() => Math.random() - 0.5);
        if (quietPool[0]) setTimeout(() => agentOwnTake(quietPool[0], { forceWorld: true }), 200);
        return;
      }

      // World-event circle / pair banter — free minds talk to each other often
      if (!powWowBusy && !ambientBusy && Math.random() < 0.44) {
        runPowWow({ continue: !!(lastPowWow && Math.random() < 0.5), world: true });
        return;
      }
      if (!powWowBusy && !ambientBusy && Math.random() < 0.4) {
        runBanter(false, { world: true });
        return;
      }

      // Don't freeze just because bubbles are full — rotate new free speech in
      const due = agentState
        .filter((st) => performance.now() >= (st.nextDecideAt || 0) && !st.powWow && !st.insideHouse && !st.housePhase)
        .sort(() => Math.random() - 0.5);
      const pool = due.length
        ? due
        : agentState.filter((st) => !st.powWow && !st.insideHouse).sort(() => Math.random() - 0.5);
      const n = Math.min(freeSpeech3d ? 2 : 1, Math.max(1, pool.length));
      for (let i = 0; i < n; i++) {
        const pick = pool[i];
        if (!pick) break;
        // Most free speech ties to world pulse
        setTimeout(
          () => agentOwnTake(pick, { forceWorld: Math.random() < 0.85 }),
          400 + i * 1400 + Math.random() * 600,
        );
      }
    }
    function updateBubbles() {
      const now = performance.now();
      // Screen positions first, then fan out overlaps so every agent is tappable
      const placed = [];
      for (let i = activeBubbles.length - 1; i >= 0; i--) {
        const b = activeBubbles[i];
        // Click-pin, hold-lock, or selected agent — never auto-hide
        if (
          b.holdLocked ||
          b.frontPinned ||
          (selectedSpeechAgentId && b.agentId === selectedSpeechAgentId) ||
          b.until === Number.POSITIVE_INFINITY
        ) {
          b.until = Number.POSITIVE_INFINITY;
        } else {
          // Never drop a thought before the read floor
          const minUntil = (b.bornAt || 0) + MIN_SPEECH_MS;
          const liveUntil = Math.max(b.until || 0, minUntil);
          if (now > liveUntil) {
            try { b.el.remove(); } catch (_) {}
            activeBubbles.splice(i, 1);
            continue;
          }
        }
        // Free-dragged bubbles stay where the visitor parked them
        if (b.freeDragged && Number.isFinite(b.freeX) && Number.isFinite(b.freeY)) {
          b.el.style.display = "block";
          b.el.style.left = `${b.freeX}px`;
          b.el.style.top = `${b.freeY}px`;
          b.el.style.transform = "translate(-50%, -100%)";
          if (b.frontPinned || b.holdLocked || b.agentId === selectedSpeechAgentId) {
            b.el.style.setProperty("z-index", String(b.stackRank || 860), "important");
          }
          placed.push({ x: b.freeX, y: b.freeY, b });
          continue;
        }
        const v = b.mesh.position.clone();
        v.y += 2.4;
        v.project(camera);
        let x = (v.x * 0.5 + 0.5) * window.innerWidth;
        let y = (-v.y * 0.5 + 0.5) * window.innerHeight;
        if (v.z > 1 || v.z < -1) {
          b.el.style.display = "none";
          continue;
        }
        // Nudge stacked bigger boxes so flyers / houses / agents stay tappable
        for (let n = 0; n < 8; n++) {
          let clash = false;
          for (const p of placed) {
            if (Math.hypot(x - p.x, y - p.y) < 92) {
              x += (n % 2 === 0 ? 1 : -1) * (40 + n * 14);
              y -= 28 + n * 10;
              clash = true;
              break;
            }
          }
          if (!clash) break;
        }
        placed.push({ x, y, b });
        b.el.style.display = "block";
        b.el.style.left = `${x}px`;
        b.el.style.top = `${y}px`;
        b.el.style.transform = "translate(-50%, -100%)";
        // Keep FRONT above ambient for the selected agent only
        if (b.frontPinned || b.holdLocked || b.agentId === selectedSpeechAgentId) {
          b.el.style.setProperty("z-index", String(b.stackRank || 860), "important");
        }
      }
    }

    // Point-and-click: tap ground = walk, tap agent/prop/house = interact
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pickables = () => [
      ...agentState.map((a) => a.mesh),
      ...propMeshes,
      ...houseMeshes,
      ...landmarkMeshes,
    ];

    let downX = 0, downY = 0, downT = 0;
    // Capture on canvas: block walk/orbit when a speech box is under the finger
    renderer.domElement.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (bubblesAtPoint(e.clientX, e.clientY).length) {
        e.preventDefault();
        e.stopPropagation();
        setOrbitEnabled(false);
        return;
      }
      downX = e.clientX;
      downY = e.clientY;
      downT = performance.now();
    }, true);
    renderer.domElement.addEventListener("pointerup", (e) => {
      if (e.button !== 0) return;
      if (bubblesAtPoint(e.clientX, e.clientY).length) return;
      if (geoHoldEl || geoHoldFired) return;
      // drag = orbit (OrbitControls); short tap = click
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 12) return;
      if (performance.now() - downT > 500) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      // Prefer agents/props/houses
      const hits = raycaster.intersectObjects(pickables(), true);
      if (hits.length) {
        let obj = hits[0].object;
        while (obj && !obj.userData?.kind) obj = obj.parent;
        if (obj?.userData?.kind) {
          const u = obj.userData;
          if (u.kind === "agent") {
            const st = agentState.find((a) => a.def.id === u.id);
            // Holding something? First tap gifts it — fun play over opening chat
            if (st && carriedItem) {
              visitorTarget.copy(st.mesh.position);
              groundMarker.position.set(visitorTarget.x, 0.05, visitorTarget.z);
              groundMarker.visible = true;
              giftCarriedToAgent(st);
              return;
            }
            // They're carrying something — you can "yoink" it (playful steal/share)
            if (st?.carried && !carriedItem) {
              const took = { ...st.carried };
              setAgentCarry(st, null);
              setCarriedItem(took);
              showToast(`${took.emoji || "✨"} Borrowed ${took.name || "it"} from ${st.def.name}`);
              logLine("You", `Borrowed ${took.name || "something"} from ${st.def.name}.`, true);
              showSpeech3d(
                st.def.id,
                Math.random() < 0.5
                  ? `Hey! That's my ${took.emoji || "✨"} — okay fine, share…`
                  : `Careful with my ${took.name || "loot"}!`,
                12000,
                { force: true, compact: true },
              );
              return;
            }
            whoEl.value = u.id;
            try { setTalkWho(u.id); } catch (_) {}
            if (msgEl) msgEl.placeholder = `Speak to ${u.name} — eternal truth, in character…`;
            selectedSpeechAgentId = u.id;
            // Select their bubble only — never open the chatlog window
            if (!bringAgentSpeechFront(u.id)) {
              selectedSpeechAgentId = u.id;
            }
            showToast(`✦ ${u.name} selected · type below`);
            try { msgEl?.focus({ preventScroll: true }); } catch (_) {}
            // face visitor toward them + walk nearby
            if (st) {
              const toward = st.mesh.position.clone().sub(visitor.position).normalize();
              visitorTarget.copy(st.mesh.position).addScaledVector(toward, -1.4);
              groundMarker.position.set(visitorTarget.x, 0.05, visitorTarget.z);
              groundMarker.visible = true;
              // agent walks a step toward you
              st.target.copy(visitor.position).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8));
              st.moving = true;
              const eth = etherealSeedFor(u.id);
              const joy = Number(st.persona?.joy ?? 0.6).toFixed(2);
              const stab = Number(st.persona?.stability ?? 0.65).toFixed(2);
              // Real AI greet when you tap them
              chatAgent(
                u.id,
                `The visitor just walked up and selected you. Greet them in character in 5–8 sentences (or 3–5 if short fits) — your own vibe, warm and specific, witty with sauce and dry humor, joy ${joy}, stability ${stab}. ${eth} No meta.`,
                true,
              );
            }
            return;
          }
          if (u.kind === "prop") {
            void interactWithProp(obj, u);
            return;
          }
          if (u.kind === "house") {
            // Prefer catalog id so enter matches mesh + owner
            void runHouseEnter(u.catalogId || u.id);
            return;
          }
          if (u.kind === "landmark") {
            const t = String(u.type || "").toLowerCase();
            if (ENTERABLE_CENTER_TYPES.has(t) || u.enterable) {
              void runCenterEnter(u.id, u);
            } else {
              void runStructureUse(u.id, u);
            }
            return;
          }
        }
      }

      // Empty ground → walk there (open field, not through walls)
      const gHits = raycaster.intersectObject(walkPlane);
      if (gHits.length) {
        const p = gHits[0].point;
        let tx = THREE.MathUtils.clamp(p.x, -FIELD, FIELD);
        let tz = THREE.MathUtils.clamp(p.z, -FIELD, FIELD);
        const cleared = resolveSolidXZ(tx, tz, VISITOR_COLLIDE_R, {});
        visitorTarget.set(cleared.x, 0, cleared.z);
        groundMarker.position.set(visitorTarget.x, 0.05, visitorTarget.z);
        groundMarker.visible = true;
        showToast(cleared.hit ? "★ Walking (around walls)" : "★ Walking");
      }
    });

    // Camp Protocol — brains on server; local chatter never blocked
    let userBusy = false;
    let ambientBusy = false;
    let powWowBusy = false;
    /** @type {{ ids: string[], topic: string, lines: object[] } | null} */
    let lastPowWow = null;
    const POWWOW_TOPICS = [
      "whether everyone walking to the same fire is still free will",
      "the worst take at camp this week",
      "whether the visitor is dreaming us or we are dreaming them",
      "who here would survive a reality show",
      "the difference between resting and rotting",
      "if kindness is a universe hack",
      "a rumor that sounds fake but feels true",
      "whether love is physics, chemistry, or bad UI",
      "simulation glitches you've noticed today",
      "whether every monologue here is the same monologue wearing a mask",
      "group chat energy versus talking at the fire",
      "what you'd post if you went viral for one hour",
    ];

    function applyEvent(ev) {
      const isCircle = ev?.kind === "banter" || ev?.kind === "powwow" || ev?.meta?.powwow;
      campClient.applyCampEvent(ev, {
        onNarration: (msg, event) => {
          const emoji = event?.meta?.prop?.emoji || (event?.kind === "house_enter" ? "🚪" : "✦");
          showToast(`${emoji} ${msg}`);
          if (event?.kind === "prop_use") logLine("You", msg, true);
          else logLine("Camp", msg);
        },
        onLine: (line) => {
          logLine(line.name || line.agent_id, line.text);
          if (line.agent_id) {
            showSpeech3d(line.agent_id, line.text, speechReadMs(line.text));
            const st = agentState.find((a) => a.def.id === line.agent_id);
            // Circle talk: stay gathered. Solo events: small wander ok.
            if (st && !isCircle && !st.powWow) {
              st.target.set(
                st.home.x + (Math.random() - 0.5) * 2,
                0,
                st.home.z + (Math.random() - 0.5) * 2,
              );
            }
          }
          if (line.backend) statusEl.textContent = `Brain: ${line.backend}`;
        },
      });
    }

    function findPropMesh(propId) {
      return propMeshes.find((g) => String(g.userData?.id || "") === String(propId));
    }

    /** Walk the visitor next to a prop and pulse its ring. */
    function approachProp(mesh) {
      if (!mesh) return;
      const toward = mesh.position.clone().sub(visitor.position);
      toward.y = 0;
      if (toward.lengthSq() < 0.01) toward.set(1, 0, 0);
      toward.normalize();
      visitorTarget.copy(mesh.position).addScaledVector(toward, -1.5);
      visitorTarget.y = 0;
      groundMarker.position.set(visitorTarget.x, 0.05, visitorTarget.z);
      groundMarker.visible = true;
      mesh.userData.pulseUntil = performance.now() + 2400;
      // face the prop a little
      faceTowardXZ(mesh, visitor.position.x, visitor.position.z, 0, true);
    }

    /** Nearby agents notice what you just did with an object. */
    function agentsNoticeProp(mesh, propId, blurb) {
      if (!mesh || !agentState.length) return;
      const near = agentState
        .map((st) => ({ st, d: st.mesh.position.distanceTo(mesh.position) }))
        .filter((x) => x.d < 7.5)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);
      for (const { st } of near) {
        try { shiftFromProp(st, propId); } catch (_) {}
        st.target.copy(mesh.position).add(
          new THREE.Vector3((Math.random() - 0.5) * 1.4, 0, (Math.random() - 0.5) * 1.4),
        );
        st.moving = true;
        st.action = "prop";
        st.propTarget = propId;
        if (aiInFlight < AI_MAX && Math.random() < 0.55) {
          aiInFlight++;
          const seed = blurb || `Visitor just interacted with ${propId} nearby. React in character, one short beat.`;
          campClient.agentChat(st.def.id, seed, { ambient: true })
            .then((data) => {
              const reply = spokenOnly3d(data.reply || data.text || "", seed) || localBark(st.def.id);
              showSpeech3d(st.def.id, reply, speechReadMs(reply));
            })
            .catch(() => {
              showSpeech3d(st.def.id, localBark(st.def.id), 18000);
            })
            .finally(() => { aiInFlight = Math.max(0, aiInFlight - 1); });
        }
      }
    }

    /**
     * Rich object interactions: walk-to, pick up, pet wildlife, T-Rex roar, stereo, etc.
     */
    async function interactWithProp(mesh, u) {
      const propId = u.id;
      const name = u.name || propId;
      const emoji = u.emoji || "✦";
      approachProp(mesh);

      // Mjolnir — everyone can interact; only Thor lifts
      if (
        propId === "mjolnir" ||
        u.interact === "mjolnir" ||
        u.mjolnir ||
        mesh.userData?.mjolnir ||
        String(propId).includes("mjolnir")
      ) {
        mesh.userData.pulseUntil = performance.now() + 2200;
        const aura = mesh.getObjectByName("mjolnirAura");
        if (aura?.material) {
          aura.material.opacity = 0.9;
          setTimeout(() => { if (aura?.material) aura.material.opacity = 0.45; }, 900);
        }
        if (mjolnirState.flying) {
          showToast("🔨 Mjolnir is mid-flight");
          logLine("You", "Tried to grab Mjolnir mid-throw — bold.", true);
          return;
        }
        if (mjolnirState.ownerId === "thor") {
          showToast("⚡ Thor already holds Mjolnir");
          logLine("You", "Poked at Mjolnir — Thor has it.", true);
          const thor = agentState.find((a) => a.def?.id === "thor");
          if (thor && Math.random() < 0.6) {
            showSpeech3d("thor", "Ask first. Or don't — still mine.", 8000, { compact: true });
          }
          agentsNoticeProp(mesh, "mjolnir", "Visitor tried to take Mjolnir from Thor. React short.");
          return;
        }
        // Visitor cannot lift — dramatic fail + call Thor
        showToast("⚡ Only Thor can lift Mjolnir");
        logLine("You", "Pulled on Mjolnir — it stays planted. Worthiness pending.", true);
        agentsNoticeProp(
          mesh,
          "mjolnir",
          "Visitor just tried (and failed) to lift Mjolnir. React with awe or comedy, 1–2 sentences.",
        );
        const thor = agentState.find((a) => a.def?.id === "thor");
        if (thor) {
          seekMjolnir(thor);
          setTimeout(() => {
            if (mjolnirState.ownerId !== "thor" && !mjolnirState.flying) {
              showSpeech3d("thor", "Leave it. I'll show you how the throw works.", 10000, { compact: true });
            }
          }, 900);
        }
        try { campClient.useProp("mjolnir", { speak: false }).catch(() => {}); } catch (_) {}
        return;
      }

      // T-Rex — multi-mode play (roar / feed / dance if buzzed)
      if (propId === "trex" || propId === "horse" || u.interact === "roar" || mesh.userData.trex) {
        const now = performance.now();
        mesh.userData.roarUntil = now + 2000;
        mesh.userData.sprint = true;
        mesh.userData.walkSpeed = 3.4;
        // Burst run after roar
        if (typeof visitor !== "undefined" && visitor) {
          mesh.userData.tx = visitor.position.x + (Math.random() - 0.5) * 10;
          mesh.userData.tz = visitor.position.z + (Math.random() - 0.5) * 10;
          mesh.userData.nextWaypointAt = performance.now() + 3500;
        }
        setTimeout(() => { mesh.userData.walkSpeed = 2.0; }, 3200);
        // Feed if you're carrying a snack
        if (carriedItem && /cookie|snack|fruit|bread|steak|marsh|beer|wine/i.test(
          `${carriedItem.id || ""} ${carriedItem.name || ""}`,
        )) {
          const food = { ...carriedItem };
          setCarriedItem(null);
          showToast(`🦖 Fed the T-Rex ${food.emoji || ""} ${food.name || ""}`);
          logLine("You", `Fed the T-Rex ${food.name || "a treat"}.`, true);
          agentsNoticeProp(
            mesh,
            "trex",
            `Visitor just fed the camp T-Rex ${food.emoji || ""} ${food.name || "food"}. React with awe/comedy, 1–2 sentences.`,
          );
        } else if (visitorBuzzActive()?.kind === "drunk") {
          showToast(`🦖 Tipsy dino hang — it roars with you`);
          logLine("You", `Drunk-vibed with the T-Rex.`, true);
          agentsNoticeProp(mesh, "trex", `Visitor is tipsy dancing near the T-Rex. React funny, short.`);
          // Pull nearby drunk agents to the dino
          agentState.forEach((st) => {
            if (buzzActive(st)?.kind === "drunk" && Math.random() < 0.55) {
              st.propTarget = "trex";
              st.pendingProp = true;
              st.action = "trex";
              const ang = Math.random() * Math.PI * 2;
              st.target.set(mesh.position.x + Math.cos(ang) * 2, 0, mesh.position.z + Math.sin(ang) * 2);
              st.moving = true;
            }
          });
        } else {
          showToast(`${emoji} ${name} ROARS`);
          logLine("You", `Poked the ${name} — it roared.`, true);
          agentsNoticeProp(
            mesh,
            "trex",
            `A T-Rex just roared by the fire. React with awe or jokes — maybe walk over, 1–2 sentences.`,
          );
          // Invite a few agents to check it out
          agentState
            .slice()
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .forEach((st, i) => {
              setTimeout(() => {
                st.propTarget = "trex";
                st.pendingProp = true;
                st.action = "trex";
                const ang = (i / 3) * Math.PI * 2;
                st.target.set(mesh.position.x + Math.cos(ang) * 2.2, 0, mesh.position.z + Math.sin(ang) * 2.2);
                st.moving = true;
              }, 400 + i * 500);
            });
        }
        try { campClient.useProp("trex", { speak: false }).catch(() => {}); } catch (_) {}
        return;
      }

      // Pet wildlife
      if (WILDLIFE_PROPS.has(propId) || u.interact === "pet") {
        mesh.userData.pulseUntil = performance.now() + 1800;
        mesh.userData.spin = true;
        setTimeout(() => { if (!["flamingo", "parrot"].includes(propId)) mesh.userData.spin = false; }, 1600);
        showToast(`${emoji} You pet ${name}`);
        logLine("You", `Gave ${name} a friendly pet.`, true);
        agentsNoticeProp(mesh, propId, `Visitor is petting the ${name}. Soft reaction, 1 sentence.`);
        try { campClient.useProp(propId, { speak: false }).catch(() => {}); } catch (_) {}
        return;
      }

      // Ouija board — open spirit chat window (Oracle / Ollama, profound channel)
      if (propId === "ouija" || u.visual?.kit === "board") {
        await openOuijaBoard(mesh);
        try { await runPropUse("ouija"); } catch (_) {}
        return;
      }

      // Stereo / music first (not carried)
      if (propId === "stereo" || u.feature === "music") {
        showToast("🎵 Jukebox");
        try { featureApi?.playMusic?.(); } catch (_) {}
        try { await runPropUse(propId); } catch (_) {}
        return;
      }

      // Ground loot OR pickable catalog prop
      const isLoot = !!(u.loot || u.dropped || String(propId).startsWith("loot_"));
      const baseId = u.baseId || (isLoot ? String(propId).replace(/^loot_/, "").replace(/_\d+$/, "") : propId);
      if (isLoot || isPickableProp(baseId) || isPickableProp(propId)) {
        // If dropping swap, leave previous on the ground first
        if (carriedItem) {
          spawnGroundLoot(carriedItem, visitor.position.x - 0.4, visitor.position.z - 0.2, {
            inviteAgents: true,
            inviteChance: 0.4,
          });
          showToast(`Left ${carriedItem.emoji || ""} · grabbed ${emoji} ${name}`);
        }
        // Claim off the ground
        if (isLoot) {
          removeGroundLoot(mesh);
        } else {
          mesh.userData.pulseUntil = performance.now() + 1200;
        }
        setCarriedItem({ id: baseId || propId, name, emoji, color: u.color });
        // Sip / hit for the visitor too when it's party props
        if (baseId === "beer" || baseId === "wine" || propId === "beer" || propId === "wine") {
          applyVisitorBuzz("drunk", 1);
          showToast(`${emoji} Carrying ${name} · you're getting tipsy · X drop`);
          logLine("You", `Grabbed ${name} — camp's getting funnier.`, true);
          agentsNoticeProp(
            mesh,
            baseId,
            `Visitor is drinking ${name} and getting tipsy. React playful, short.`,
          );
        } else if (baseId === "weed" || baseId === "herbs" || propId === "weed" || propId === "herbs") {
          applyVisitorBuzz("stoned", 1);
          showToast(`${emoji} Carrying ${name} · you're getting mellow · X drop`);
          logLine("You", `Grabbed ${name} — soft focus mode.`, true);
          agentsNoticeProp(
            mesh,
            baseId,
            `Visitor just got into ${name} and is getting stoned/mellow. React chill/funny, short.`,
          );
        } else {
          showToast(`${emoji} Carrying ${name} · tap a friend to gift · X drop`);
          logLine(
            "You",
            isLoot
              ? `Picked ${name} up off the ground.`
              : `Picked up ${name} — ready to share or parade it.`,
            true,
          );
          agentsNoticeProp(
            mesh,
            baseId || propId,
            `Visitor just picked up ${emoji} ${name}${isLoot ? " from the ground" : ""}. React short and playful.`,
          );
        }
        if (!isLoot) {
          maybeAgentCopycatPickup(baseId || propId, emoji, name);
          if (baseId === "beer" || baseId === "wine" || baseId === "weed" || baseId === "herbs") {
            agentState
              .filter((st) => st.mesh.position.distanceTo(visitor.position) < 8)
              .slice(0, 2)
              .forEach((st) => {
                if (Math.random() > 0.55) return;
                st.propTarget = propId;
                st.pendingProp = true;
                st.action = "prop";
                st.target.copy(mesh.position);
                st.moving = true;
              });
          }
        }
        try { await runPropUse(baseId || propId); } catch (_) {}
        return;
      }

      // Default camp prop use
      showToast(`${emoji} ${name}`);
      logLine("You", `Used ${name}.`, true);
      agentsNoticeProp(mesh, propId);
      try { await runPropUse(propId); } catch (_) {}
    }

    /** A friend grabs a matching treat and walks with it. */
    function maybeAgentCopycatPickup(propId, emoji, name) {
      if (Math.random() > 0.55) return;
      const free = agentState.filter((st) => !st.carried && st.posture !== "sit");
      if (!free.length) return;
      const st = free[Math.floor(Math.random() * free.length)];
      setAgentCarry(st, { id: propId, name, emoji });
      st.propTarget = propId;
      pickRoamTarget(st);
      showSpeech3d(
        st.def.id,
        Math.random() < 0.5
          ? `${emoji} I'm taking one too!`
          : `Copycat energy — ${emoji} ${name || "loot"} acquired.`,
        10000,
        { compact: true },
      );
    }

    async function runPropUse(propId) {
      if (userBusy) return;
      userBusy = true;
      statusEl.textContent = "Prop + brains…";
      try {
        const ev = await campClient.useProp(propId);
        applyEvent(ev);
        statusEl.textContent = ev.ok ? "Prop resolved" : "Prop failed";
      } catch (err) {
        statusEl.textContent = "Local prop use · API quiet";
        logLine("Camp", `Prop use offline: ${err.message}`);
      } finally {
        userBusy = false;
      }
    }

    function placeInteriorEl() {
      return document.getElementById("place-interior");
    }

    /** House owners (have a door on the map) */
    const HOUSE_OWNER_IDS = new Set(
      (typeof HOUSES !== "undefined" ? HOUSES : []).map((h) => h.id).filter(Boolean),
    );

    const AGENT_GLYPH = {
      luna: "🌙", hermes: "⚡", oracle: "🔮", caduceus: "🐍", sentinel: "🤖",
      dionysus: "🍇", jesus: "✝️", michael: "🗡️", gabriel: "📯", raphael: "💚",
      uriel: "🔥", aurora: "✨", violet: "💜", seraph: "😇", odin: "🐦‍⬛",
      thor: "🔨", zeus: "⚡", ambrosia: "🍯", rhea: "🌾", telephantix: "✨",
      stood: "✨", ara: "🟢", mika: "🟣", telephanthantim: "🛡️",
    };
    /** Preferred face art for interiors (houses + visitor hub chips). */
    const AGENT_PORTRAIT = {
      luna: "/static/avatars/luna-portrait.jpg",
      hermes: "/static/camp/portraits/hermes/flowing-free.jpg",
      oracle: "/static/camp/portraits/oracle/flowing-free.jpg",
      dionysus: "/static/camp/portraits/dionysus/flowing-free.jpg",
      odin: "/static/camp/portraits/odin/hall.jpg",
      // You — studio/mesh preview art (not a stock body double)
      telephantix: "/static/camp/portraits/guest/meshy-preview-4.png",
      stood: "/static/camp/portraits/guest/meshy-preview-4.png",
      telephanthantim: "/static/camp/portraits/guest/d4-ref.jpg",
    };
    const PORTRAIT_SONG_FALLBACK = "flowing-free";
    const HOUSE_ROOM_THEME = {
      luna: { vibe: "Warm corona light — cedar, starlight, Luna's quiet hearth.", glyph: "🌙", accent: "#d946ef" },
      hermes: { vibe: "Ripple maps on the walls — the psychic relay hums softly.", glyph: "⚡", accent: "#fbbf24" },
      oracle: { vibe: "Veil-thin curtains and candle smoke — dreams run ahead.", glyph: "🔮", accent: "#8b5cf6" },
      dionysus: { vibe: "Vine shadows on the floorboards — always a pour waiting.", glyph: "🍷", accent: "#e11d48" },
      odin: { vibe: "Stone hall on the outskirts — fire low, ravens on the rafters.", glyph: "🦅", accent: "#94a3b8" },
      jesus: { vibe: "Church and house in one — warm wood, stained glass, no dress code.", glyph: "✝", accent: "#fde68a" },
      telephantix: { vibe: "Your corner of camp — studio light, brand pulse, mesh that is actually you.", glyph: "✨", accent: "#38bdf8" },
      visitor: {
        vibe: "Visitor Center hub — anyone without a house can be found and spoken to here.",
        glyph: "⛺",
        accent: "#38bdf8",
      },
    };

    function isHouseOwnerAgent(agentId) {
      return HOUSE_OWNER_IDS.has(agentId);
    }

    function isHostHome(ownerId) {
      if (!ownerId) return false;
      return agentState.some(
        (s) =>
          s.def.id === ownerId &&
          (s.insideHouse ||
            s.housePhase === "inside" ||
            (playerInsidePlace &&
              (s.insideHouse === playerInsidePlace.id ||
                s.insideHouse === playerInsidePlace.catalogId ||
                s.insideHouse === ownerId))),
      );
    }

    /** Resolve a face image for house/VC panels — map first, then portrait folders. */
    function portraitSrcForAgent(agentId) {
      const id = String(agentId || "").toLowerCase();
      if (!id) return "";
      if (AGENT_PORTRAIT[id]) return AGENT_PORTRAIT[id];
      // Aliases
      if (id === "stood") return AGENT_PORTRAIT.telephantix || "";
      // Song-style house portrait packs (2D parity)
      if (["luna", "hermes", "oracle", "dionysus"].includes(id)) {
        return `/static/camp/portraits/${id}/${PORTRAIT_SONG_FALLBACK}.jpg`;
      }
      if (id === "odin") return "/static/camp/portraits/odin/hall.jpg";
      // Optional drop-in faces: /static/camp/portraits/{id}/face.jpg
      return `/static/camp/portraits/${id}/face.jpg`;
    }

    function agentGlyph(agentId) {
      return AGENT_GLYPH[agentId] || "✦";
    }

    function setInteriorPortrait(agentId, name) {
      const frame = document.getElementById("pi-portrait");
      const img = document.getElementById("pi-portrait-img");
      const glyph = document.getElementById("pi-glyph");
      const g = agentGlyph(agentId);
      const src = portraitSrcForAgent(agentId);
      if (glyph) glyph.textContent = g;
      if (!frame || !img) return;
      frame.classList.remove("img-on");
      img.classList.remove("show");
      img.removeAttribute("src");
      img.alt = name || agentId || "";
      const theme = HOUSE_ROOM_THEME[agentId] || HOUSE_ROOM_THEME.visitor;
      if (theme?.accent) frame.style.borderColor = theme.accent;
      if (!src) return;
      // Chain fallbacks so a missing face.jpg still shows a known portrait
      const fallbacks = [];
      if (AGENT_PORTRAIT[agentId]) fallbacks.push(AGENT_PORTRAIT[agentId]);
      if (src) fallbacks.push(src);
      if (agentId === "telephantix" || agentId === "stood") {
        fallbacks.push(
          "/static/camp/portraits/guest/meshy-preview-4.png",
          "/static/camp/portraits/guest/stood-wireframe.webp",
          "/static/camp/portraits/guest/source-me-and-d4.jpg",
        );
      }
      fallbacks.push("/static/avatars/luna-portrait.jpg");
      const unique = [...new Set(fallbacks.filter(Boolean))];
      let i = 0;
      const tryNext = () => {
        if (i >= unique.length) {
          img.classList.remove("show");
          frame.classList.remove("img-on");
          return;
        }
        const u = unique[i++];
        img.onload = () => {
          img.classList.add("show");
          frame.classList.add("img-on");
        };
        img.onerror = tryNext;
        img.src = u;
      };
      tryNext();
    }

    function setInteriorTalkTarget(agentId) {
      if (!playerInsidePlace) return;
      playerInsidePlace.talkTo = agentId;
      setTalkWho(agentId);
      const st = agentState.find((s) => s.def.id === agentId);
      const name = st?.def?.name || agentId;
      const hostName = document.getElementById("pi-host-name");
      if (hostName) hostName.textContent = name;
      setInteriorPortrait(agentId, name);
      // highlight chip
      document.querySelectorAll(".pi-guest-chip").forEach((el) => {
        el.classList.toggle("on", el.dataset.id === agentId);
      });
      const inp = document.getElementById("pi-input");
      if (inp) inp.placeholder = `Talk to ${name}…`;
    }

    /** People you can chat with in this place */
    function interiorChatRoster() {
      if (!playerInsidePlace) return [];
      const place = playerInsidePlace;
      const ownerId = place.ownerId;
      const seen = new Set();
      const out = [];

      const push = (st, tag) => {
        if (!st?.def?.id || seen.has(st.def.id)) return;
        seen.add(st.def.id);
        out.push({ st, tag });
      };

      // House: host + anyone currently inside
      if (place.kind === "house") {
        const host = agentState.find((s) => s.def.id === ownerId);
        if (host) push(host, isHostHome(ownerId) ? "host · home" : "host · away");
        for (const st of agentState) {
          if (
            st.insideHouse === place.id ||
            st.insideHouse === place.catalogId ||
            st.insideHouse === ownerId
          ) {
            push(st, st.def.id === ownerId ? "host · home" : "guest");
          }
        }
        return out;
      }

      // Visitor Center hub: houseless base cast + daily guests + anyone tagged here
      if (place.kind === "center" && (place.id === "visitor-shelter" || place.hub)) {
        for (const st of agentState) {
          const id = st.def.id;
          const daily = !!st.def.daily;
          const houseless = !isHouseOwnerAgent(id);
          const here =
            st.insideHouse === place.id ||
            st.insideHouse === "visitor-shelter" ||
            st.homeTarget === "visitor-shelter";
          if (daily || houseless || here) {
            let tag = daily ? `daily · ${st.def.faction || "guest"}` : "guest";
            if (here) tag += " · here";
            if (!houseless && !daily) tag = "visitor";
            push(st, tag);
          }
        }
        // Prefer daily + houseless first
        out.sort((a, b) => {
          const score = (x) =>
            (x.st.def.daily ? 0 : 1) + (isHouseOwnerAgent(x.st.def.id) ? 2 : 0);
          return score(a) - score(b);
        });
        return out;
      }

      // Other centers: nearby agents + a default host voice
      const host = agentState.find((s) => s.def.id === ownerId) || agentState.find((s) => s.def.id === "luna");
      if (host) push(host, "host");
      for (const st of agentState) {
        if (!st?.mesh || !visitor) continue;
        try {
          const d = st.mesh.position.distanceTo(visitor.position);
          if (d < 14 || st.insideHouse === place.id) push(st, "nearby");
        } catch (_) { /* mesh not ready */ }
      }
      return out;
    }

    function refreshInteriorGuestStrip() {
      try {
        _refreshInteriorGuestStripInner();
      } catch (err) {
        console.warn("[camp3d] interior guest strip", err);
      }
    }

    function _refreshInteriorGuestStripInner() {
      const list = document.getElementById("pi-guest-list");
      const guestsLabel = document.getElementById("pi-guests-label");
      const badge = document.getElementById("pi-home-badge");
      if (!playerInsidePlace) return;

      const ownerId = playerInsidePlace.ownerId;
      const roster = interiorChatRoster();

      if (badge && playerInsidePlace.kind === "house") {
        const home = isHostHome(ownerId);
        const hostSt = agentState.find((s) => s.def.id === ownerId);
        const hostName = hostSt?.def?.name || ownerId || "Host";
        badge.textContent = home
          ? hostName + " is home"
          : hostName + " is away - still chatable";
        badge.classList.toggle("home", home);
        badge.classList.toggle("away", !home);
        badge.hidden = false;
      } else if (badge) {
        badge.textContent = playerInsidePlace.hub
          ? "Guest hub - " + roster.length + " chatable"
          : "Open center";
        badge.classList.add("home");
        badge.classList.remove("away");
        badge.hidden = false;
      }

      if (guestsLabel) {
        guestsLabel.textContent =
          playerInsidePlace.hub || playerInsidePlace.id === "visitor-shelter"
            ? "Guests and daily visitors (tap to talk):"
            : "Who is here - tap to talk:";
      }
      if (!list) return;
      list.innerHTML = "";
      if (!roster.length) {
        list.innerHTML =
          '<span style="color:#94a3b8;font-size:0.8rem">No one to talk to yet - wait for a daily guest or host.</span>';
        return;
      }
      for (const { st, tag } of roster) {
        if (!st?.def?.id) continue;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pi-guest-chip";
        btn.dataset.id = st.def.id;
        if (playerInsidePlace.talkTo === st.def.id) btn.classList.add("on");
        const color =
          st.def.color != null
            ? "#" + (st.def.color >>> 0).toString(16).padStart(6, "0")
            : "#94a3b8";
        const g = agentGlyph(st.def.id);
        const faceSrc = AGENT_PORTRAIT[st.def.id] || "";
        if (faceSrc) {
          const img = document.createElement("img");
          img.className = "chip-face";
          img.alt = "";
          img.decoding = "async";
          img.src = faceSrc;
          img.onerror = function () {
            try {
              const disc = document.createElement("span");
              disc.className = "chip-face glyph";
              disc.textContent = g;
              disc.style.background = color + "33";
              disc.style.borderColor = color;
              if (img.parentNode) img.parentNode.replaceChild(disc, img);
            } catch (_) {}
          };
          btn.appendChild(img);
        } else {
          const disc = document.createElement("span");
          disc.className = "chip-face glyph";
          disc.textContent = g;
          disc.style.background = color + "33";
          disc.style.borderColor = color;
          btn.appendChild(disc);
        }
        const nameSpan = document.createElement("span");
        nameSpan.textContent = String(st.def.name || st.def.id) + " · " + String(tag || "guest");
        btn.appendChild(nameSpan);
        btn.title = "Talk to " + (st.def.name || st.def.id);
        btn.addEventListener("click", () => {
          setInteriorTalkTarget(st.def.id);
          const bubble = document.getElementById("pi-bubble");
          if (bubble) {
            const home = isHostHome(st.def.id) || !!st.insideHouse;
            const nm = st.def.name || st.def.id;
            bubble.textContent = home
              ? nm + " is here - say something."
              : nm + " is not in the room, but you can still call out.";
          }
        });
        list.appendChild(btn);
      }
    }

    function leavePlaceInterior() {
      if (!playerInsidePlace) return;
      const was = playerInsidePlace;
      playerInsidePlace = null;
      document.body.classList.remove("place-inside");
      const layer = placeInteriorEl();
      if (layer) layer.classList.remove("open");
      // Restore wall opacity
      if (was.mesh) {
        const wall = was.mesh.getObjectByName("houseWall");
        if (wall?.material) {
          wall.material.transparent = false;
          wall.material.opacity = 1;
          wall.material.depthWrite = true;
        }
      }
      // Restore outdoor visibility for hidden agents
      for (const st of agentState) {
        if (st.insideHouse) setAgentInsideVisual(st, true);
        else if (st.mesh) st.mesh.visible = true;
      }
      // Step visitor out the door
      if (was.mesh) {
        try {
          const door = houseDoorWorld(was.mesh);
          visitor.position.set(door.x, 0, door.z + 1.1);
          visitorTarget.copy(visitor.position);
          groundMarker.visible = false;
          controls.target.set(visitor.position.x, 1.1, visitor.position.z);
          camera.position.set(visitor.position.x + 4.2, 3.6, visitor.position.z + 5.5);
        } catch (_) {
          // landmarks may not have houseDoorWorld — step back from mesh
          const p = was.mesh.position;
          visitor.position.set(p.x + 1.5, 0, p.z + 2.2);
          visitorTarget.copy(visitor.position);
        }
      }
      showToast(`← Left ${was.name || "the place"}`);
      logLine("You", `Left ${was.name || "the place"}.`, true);
    }

    function nearestEnterablePlace(maxDist = 4.5) {
      let best = null;
      let bestD = maxDist;
      for (const mesh of houseMeshes) {
        const door = houseDoorWorld(mesh);
        const d = Math.hypot(visitor.position.x - door.x, visitor.position.z - door.z);
        if (d < bestD) {
          bestD = d;
          best = { kind: "house", id: mesh.userData.id, d };
        }
      }
      for (const mesh of landmarkMeshes) {
        const t = String(mesh.userData?.type || "").toLowerCase();
        if (!ENTERABLE_CENTER_TYPES.has(t) && !mesh.userData?.enterable) continue;
        const d = mesh.position.distanceTo(visitor.position);
        if (d < bestD) {
          bestD = d;
          best = { kind: "center", id: mesh.userData.id, d, meta: mesh.userData };
        }
      }
      return best;
    }

    function updateEnterPrompt() {
      const el = document.getElementById("enter-prompt");
      if (!el || playerInsidePlace) {
        if (el) el.classList.remove("show");
        return;
      }
      const n = nearestEnterablePlace(4.2);
      if (!n) {
        el.classList.remove("show");
        return;
      }
      if (n.kind === "house") {
        const h = HOUSES.find((x) => x.id === n.id || x.catalogId === n.id);
        const ownerId = h?.id;
        const home = ownerId && isHostHome(ownerId);
        el.textContent = `E · Enter ${h?.emoji || "🏠"} ${h?.name || "house"}${home ? " · host home" : " · host away"}`;
      } else if (n.id === "visitor-shelter" || n.meta?.id === "visitor-shelter") {
        el.textContent = "E · Enter ⛺ Visitor Center (guest hub)";
      } else {
        el.textContent = `E · Enter ${n.meta?.emoji || "✦"} ${n.meta?.name || "center"}`;
      }
      el.classList.add("show");
    }

    function openPlaceInterior(place) {
      try {
        _openPlaceInteriorInner(place);
      } catch (err) {
        console.error("[camp3d] openPlaceInterior", err);
        try { showToast("Could not open interior - try again"); } catch (_) {}
        playerInsidePlace = null;
        document.body.classList.remove("place-inside");
        const layer = placeInteriorEl();
        if (layer) layer.classList.remove("open");
      }
    }

    function _openPlaceInteriorInner(place) {
      // place: { kind, id, catalogId, name, emoji, ownerId, mesh, vibe, hub? }
      const isHub = !!(place.hub || place.id === "visitor-shelter");
      place.hub = isHub;
      playerInsidePlace = place;
      document.body.classList.add("place-inside");
      const layer = placeInteriorEl();
      if (layer) layer.classList.add("open");

      const themeKey = isHub ? "visitor" : (place.ownerId || "visitor");
      const theme = HOUSE_ROOM_THEME[themeKey] || HOUSE_ROOM_THEME.visitor;

      const title = document.getElementById("pi-title");
      const sub = document.getElementById("pi-sub");
      const vibe = document.getElementById("pi-vibe");
      const bubble = document.getElementById("pi-bubble");
      const roomLabel = document.getElementById("pi-room-label");
      if (title) {
        title.textContent = isHub
          ? `⛺ Visitor Center`
          : `${place.emoji || "🏠"} ${place.name || "Interior"}`;
      }
      if (sub) {
        sub.textContent = isHub
          ? "Guest hub · houseless + daily visitors · E / Esc leave"
          : place.kind === "house"
            ? `Host: ${place.ownerId || "—"} · E / Esc leave`
            : `Town center · E / Esc leave`;
      }
      if (vibe) vibe.textContent = place.vibe || theme.vibe;
      if (bubble) {
        bubble.textContent = isHub
          ? "Welcome to the Visitor Center — pick a guest chip to talk."
          : "…";
      }
      if (roomLabel) {
        roomLabel.textContent = isHub
          ? "Hub · speak to any guest without a house"
          : `Inside · ${place.name || place.id}`;
      }

      // Quick lines
      const quick = document.getElementById("pi-quick");
      if (quick) {
        const lines = isHub
          ? ["Who's new in town?", "Any daily visitors around?", "Got a witty take for me?"]
          : place.kind === "house"
            ? ["Mind if I come in?", "How's home treating you?", "Got a story for a traveler?"]
            : ["What's the vibe?", "Any news?", "Who hangs out here?"];
        quick.innerHTML = "";
        for (const t of lines) {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = t;
          b.addEventListener("click", () => {
            const inp = document.getElementById("pi-input");
            if (inp) inp.value = t;
            sendInteriorChat();
          });
          quick.appendChild(b);
        }
      }

      // Camera / visitor into the place
      if (place.mesh) {
        const hx = place.mesh.position.x;
        const hz = place.mesh.position.z;
        visitor.position.set(hx, 0, hz);
        visitorTarget.copy(visitor.position);
        groundMarker.visible = false;
        try {
          controls.target.set(hx, 1.0, hz);
          camera.position.set(hx + 0.2, 2.4, hz + 3.2);
        } catch (_) {}
        const wall = place.mesh.getObjectByName("houseWall");
        if (wall?.material) {
          wall.material.transparent = true;
          wall.material.opacity = 0.35;
          wall.material.depthWrite = false;
        }
      }

      // Pull houseless + daily guests into Visitor Center hub when you enter
      if (isHub) {
        let pulled = 0;
        const hubPool = agentState
          .filter((st) => {
            if (!st?.def?.id) return false;
            if (st.def.daily) return true;
            if (isHouseOwnerAgent(st.def.id)) return false;
            return true;
          })
          .sort((a, b) => (b.def.daily ? 1 : 0) - (a.def.daily ? 1 : 0));
        for (const st of hubPool) {
          if (pulled >= 12) break;
          st.insideHouse = "visitor-shelter";
          st.housePhase = "inside";
          st.homeTarget = "visitor-shelter";
          st.moving = false;
          if (place.mesh && st.mesh) {
            try {
              st.mesh.visible = true;
              const ang = (pulled / 12) * Math.PI * 2 + (st.phase || 0) * 0.2;
              const r = 0.55 + (pulled % 4) * 0.22;
              st.mesh.position.set(
                place.mesh.position.x + Math.cos(ang) * r,
                0,
                place.mesh.position.z + Math.sin(ang) * r,
              );
            } catch (_) {}
          }
          pulled++;
        }
      }

      refreshAgentsInsideVisibility();
      for (const st of agentState) {
        if (!st?.mesh) continue;
        const hid = st.insideHouse;
        if (
          place.mesh &&
          hid &&
          (hid === place.id || hid === place.ownerId || hid === place.catalogId || hid === "visitor-shelter")
        ) {
          try { st.mesh.visible = true; } catch (_) {}
        }
      }

      // Default talk target
      const roster = interiorChatRoster();
      const defaultTalk =
        (place.kind === "house" && place.ownerId) ||
        roster[0]?.st?.def?.id ||
        place.ownerId ||
        "luna";
      place.talkTo = defaultTalk;
      setInteriorTalkTarget(defaultTalk);
      refreshInteriorGuestStrip();
      try { document.getElementById("pi-input")?.focus?.(); } catch (_) {}
    }

    async function sendInteriorChat() {
      if (!playerInsidePlace) return;
      const inp = document.getElementById("pi-input");
      const text = String(inp?.value || "").trim();
      if (!text) return;
      if (inp) inp.value = "";
      const talkTo =
        playerInsidePlace.talkTo ||
        playerInsidePlace.ownerId ||
        interiorChatRoster()[0]?.st?.def?.id ||
        "luna";
      const bubble = document.getElementById("pi-bubble");
      if (bubble) bubble.textContent = "…";
      setInteriorTalkTarget(talkTo);
      logLine("You", text, true);
      const homeBit =
        playerInsidePlace.kind === "house"
          ? isHostHome(playerInsidePlace.ownerId)
            ? "Host is home."
            : "Host may be away — still answer as them if addressed."
          : playerInsidePlace.hub
            ? "You are in the Visitor Center guest hub."
            : "You are in a town center.";
      try {
        const eth = etherealSeedFor(talkTo);
        const data = await campClient.agentChat(
          talkTo,
          `Visitor is INSIDE ${playerInsidePlace.name || "this place"} speaking to you (${talkTo}). ${homeBit} They said: "${text}". Reply in character, 5–8 sentences when full, or 3–5 for a short beat — warm and specific. ${eth} No meta.`,
          { ambient: false },
        );
        const reply = spokenOnly3d(data.reply || data.text || "", text) || localBark(talkTo);
        if (bubble) bubble.textContent = reply;
        showSpeech3d(talkTo, reply, speechReadMs(reply), { force: true });
        openChat3d(talkTo);
        logLine(displayAgentName(talkTo), reply);
        refreshInteriorGuestStrip();
      } catch (err) {
        const fallback = localBark(talkTo) || "Come sit. The walls hold stories.";
        if (bubble) bubble.textContent = fallback;
        showSpeech3d(talkTo, fallback, 16000, { force: true });
        openChat3d(talkTo);
        logLine(displayAgentName(talkTo), fallback);
      }
    }

    async function runHouseEnter(houseId) {
      if (userBusy || playerInsidePlace) return;
      userBusy = true;
      const house = HOUSES.find((h) => h.id === houseId || h.catalogId === houseId);
      const mesh =
        houseMeshById(houseId) ||
        (house ? houseMeshById(house.catalogId || house.id) : null);
      if (!house || !mesh) {
        userBusy = false;
        showToast("No door found");
        return;
      }
      const ownerId = house.id; // already mapped to owner_id
      const placeId = house.catalogId || house.id;
      // Walk to door first (visual), then open interior
      const door = houseDoorWorld(mesh);
      visitorTarget.set(door.x, 0, door.z + 0.2);
      groundMarker.position.set(visitorTarget.x, 0.05, visitorTarget.z);
      groundMarker.visible = true;

      // Nudge owner home
      const owner = agentState.find((s) => s.def.id === ownerId);
      if (owner && !owner.insideHouse && !owner.powWow) {
        startAgentHouseVisit(owner, true);
      }

      // Wait briefly for walk, then enter (also allow immediate if already close)
      const distDoor = Math.hypot(visitor.position.x - door.x, visitor.position.z - door.z);
      const delay = distDoor < 2.2 ? 200 : 900;
      setTimeout(async () => {
        openPlaceInterior({
          kind: "house",
          id: placeId,
          catalogId: house.catalogId,
          name: house.name,
          emoji: house.emoji || "🏠",
          ownerId,
          mesh,
          vibe: house.use || "Private walls, firmament light through the glass.",
        });
        // Mark player as "visiting" so guest strip works; force owner inside visually
        if (owner && owner.housePhase === "approach") {
          // let them arrive soon
        } else if (owner && !owner.insideHouse) {
          owner.homeTarget = placeId;
          owner.housePhase = "inside";
          owner.insideHouse = placeId;
          setAgentInsideVisual(owner, true);
          refreshHouseOccupancy(mesh);
        }
        refreshInteriorGuestStrip();
        logLine("You", `Entered ${house.name}.`, true);
        showToast(`🚪 Inside ${house.emoji || "🏠"} ${house.name}`);

        try {
          const inside = agentsInsideHouse(placeId).concat(
            agentsInsideHouse(ownerId).filter((s) => !agentsInsideHouse(placeId).includes(s)),
          );
          const insideNames = inside.map((s) => s.def.name).join(", ");
          const ev = await campClient.enterHouse(placeId);
          applyEvent(ev);
          const talkTo = ev.meta?.owner_id || ownerId;
          setTalkWho(talkTo);
          const eth = etherealSeedFor(talkTo);
          const guestBit = insideNames
            ? ` Guests already inside: ${insideNames}.`
            : " The room is quiet until you arrive.";
          const data = await campClient.agentChat(
            talkTo,
            `The visitor just walked INSIDE ${house.name}.${guestBit} Welcome them at home — warm, specific, 5–8 sentences when full. ${eth} No meta.`,
            { ambient: false },
          );
          const reply =
            spokenOnly3d(data.reply || data.text || "", "welcome") ||
            `Come in — ${house.name} is glad you knocked.`;
          const bubble = document.getElementById("pi-bubble");
          if (bubble) bubble.textContent = reply;
          showSpeech3d(talkTo, reply, speechReadMs(reply), { force: true });
          logLine(talkTo, reply);
        } catch (err) {
          const fallback = `Come in — ${house.name} holds a quiet glow for travelers.`;
          const bubble = document.getElementById("pi-bubble");
          if (bubble) bubble.textContent = fallback;
          showSpeech3d(ownerId, fallback, 20000, { force: true });
          logLine("Camp", `House enter offline: ${err.message}`);
        } finally {
          userBusy = false;
        }
      }, delay);
    }

    async function runCenterEnter(landmarkId, meta = {}) {
      if (userBusy || playerInsidePlace) return;
      const mesh = landmarkMeshes.find((g) => g.userData?.id === landmarkId);
      const lm = LANDMARKS.find((l) => l.id === landmarkId) || meta;
      if (!mesh && !lm) {
        showToast("No center found");
        return;
      }
      userBusy = true;
      const m = mesh || null;
      if (m) {
        visitorTarget.copy(m.position);
        visitorTarget.y = 0;
        groundMarker.position.set(visitorTarget.x, 0.05, visitorTarget.z);
        groundMarker.visible = true;
      }
      setTimeout(async () => {
        const isHub = landmarkId === "visitor-shelter" || meta.id === "visitor-shelter";
        openPlaceInterior({
          kind: "center",
          id: landmarkId,
          name: isHub ? "Visitor Center" : (lm.name || meta.name || landmarkId),
          emoji: lm.emoji || meta.emoji || (isHub ? "⛺" : "✦"),
          ownerId: isHub ? "luna" : (lm.owner_id || meta.ownerId || "luna"),
          mesh: m || houseMeshes[0],
          vibe: isHub
            ? HOUSE_ROOM_THEME.visitor.vibe
            : (lm.use || meta.use || "A public center of the town."),
          catalogId: landmarkId,
          hub: isHub,
        });
        logLine("You", `Entered ${isHub ? "Visitor Center" : (lm.name || landmarkId)}.`, true);
        showToast(
          isHub
            ? "⛺ Visitor Center · pick a guest to talk"
            : `${lm.emoji || "✦"} Inside ${lm.name || landmarkId}`,
        );
        try {
          const roster = interiorChatRoster();
          const talkTo = playerInsidePlace?.talkTo || roster[0]?.st?.def?.id || "luna";
          const data = await campClient.agentChat(
            talkTo,
            isHub
              ? `Visitor entered the Visitor Center guest hub. Welcome them; mention they can speak to houseless guests and daily visitors. 2–4 witty sentences. No meta.`
              : `Visitor entered the center "${lm.name || landmarkId}". Welcome them as the place's vibe, 2–4 witty sentences. No meta.`,
            { ambient: false },
          );
          const reply =
            spokenOnly3d(data.reply || data.text || "", "center") ||
            (isHub
              ? "Welcome to the Visitor Center — tap a guest chip to chat."
              : "Welcome to the center of camp.");
          const bubble = document.getElementById("pi-bubble");
          if (bubble) bubble.textContent = reply;
          showSpeech3d(talkTo, reply, speechReadMs(reply), { force: true });
          refreshInteriorGuestStrip();
        } catch (_) {
          const bubble = document.getElementById("pi-bubble");
          if (bubble) {
            bubble.textContent = isHub
              ? "Visitor Center open — choose someone to talk to."
              : (lm.use || "The center hums.");
          }
        } finally {
          userBusy = false;
        }
      }, 500);
    }

    async function runStructureUse(structureId, meta = {}) {
      if (userBusy) return;
      userBusy = true;
      statusEl.textContent = `${meta.name || structureId}…`;
      showToast(`${meta.emoji || "✦"} ${meta.use || meta.name || structureId}`);
      logLine("You", meta.use || `Visit ${meta.name || structureId}`, true);
      try {
        const ev = await campClient.useStructure(structureId);
        applyEvent(ev);
        // Open matching feature panel for shop/tv/club
        const feat = ev.meta?.feature || meta.type;
        if (feat === "shop" || feat === "tv" || feat === "club") {
          try {
            if (feat === "shop") document.querySelector("#feat-hotbar button")?.dispatchEvent(new Event("click"));
            // Prefer hotbar labels
            const hot = document.querySelectorAll("#feat-hotbar button");
            for (const b of hot) {
              const t = (b.textContent || "").toLowerCase();
              if (feat === "shop" && t.includes("shop")) { b.click(); break; }
              if (feat === "tv" && t.includes("tv")) { b.click(); break; }
              if (feat === "club" && t.includes("club")) { b.click(); break; }
            }
          } catch (_) {
            showToast(feat === "shop" ? "🏪 Shop" : feat === "tv" ? "📺 Lucid TV" : "💃 Club");
          }
        }
        statusEl.textContent = "Structure ok";
      } catch (err) {
        logLine("Camp", `Structure: ${err.message}`);
        statusEl.textContent = "Structure offline";
      } finally {
        userBusy = false;
      }
    }

    function refreshWhoSelect() {
      // Always resolve DOM live — never touch unbound consts mid-boot
      const whoSel = whoEl || document.getElementById("who-select");
      const chatSel = document.getElementById("chat3d-who");
      const cur = whoSel?.value || chatSel?.value || "luna";
      const fill = (sel) => {
        if (!sel) return;
        sel.innerHTML = "";
        const allOpt = document.createElement("option");
        allOpt.value = TALK_ALL_ID;
        allOpt.textContent = "✦ All agents";
        sel.appendChild(allOpt);
        const peep = document.createElement("optgroup");
        peep.label = "Characters";
        for (const a of AGENTS) {
          const opt = document.createElement("option");
          opt.value = a.id;
          opt.textContent = a.name;
          peep.appendChild(opt);
        }
        sel.appendChild(peep);
        if (HOUSES.length) {
          const homes = document.createElement("optgroup");
          homes.label = "Houses";
          for (const h of HOUSES) {
            const opt = document.createElement("option");
            opt.value = h.id;
            opt.textContent = `${h.emoji || "🏠"} ${h.name}`;
            homes.appendChild(opt);
          }
          sel.appendChild(homes);
        }
        if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
        else if (sel.options.length) sel.selectedIndex = 0;
      };
      fill(whoSel);
      fill(chatSel);
      syncWhoDropdownUp();
    }

    /** Bottom “Talk to” picker opens UP so the list isn’t under the dock / hub chrome. */
    function syncWhoDropdownUp() {
      const sel = whoEl || document.getElementById("who-select");
      const btn = document.getElementById("who-dd-btn");
      const menu = document.getElementById("who-dd-menu");
      if (!sel || !btn || !menu) return;
      const labelOf = () => {
        const opt = sel.selectedOptions?.[0];
        return (opt && opt.textContent) || "Talk to…";
      };
      btn.textContent = labelOf();
      menu.innerHTML = "";
      let group = null;
      [...sel.options].forEach((opt) => {
        const parent = opt.parentElement;
        if (parent && parent.tagName === "OPTGROUP") {
          const gLabel = parent.label || "";
          if (group !== gLabel) {
            group = gLabel;
            const lab = document.createElement("div");
            lab.className = "who-dd-label";
            lab.textContent = gLabel;
            menu.appendChild(lab);
          }
        } else {
          group = null;
        }
        const item = document.createElement("button");
        item.type = "button";
        item.className = "who-dd-item" + (opt.value === sel.value ? " active" : "");
        item.setAttribute("role", "option");
        item.dataset.value = opt.value;
        item.textContent = opt.textContent;
        item.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          setTalkWho(opt.value);
          closeWhoDropdownUp();
          try {
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          } catch (_) {}
        });
        menu.appendChild(item);
      });
      // Always show at least All agents even if AGENTS failed
      if (!sel.options.length) {
        const allOpt = document.createElement("option");
        allOpt.value = TALK_ALL_ID;
        allOpt.textContent = "✦ All agents";
        sel.appendChild(allOpt);
        const item = document.createElement("button");
        item.type = "button";
        item.className = "who-dd-item active";
        item.textContent = "✦ All agents";
        item.addEventListener("click", () => {
          setTalkWho(TALK_ALL_ID);
          closeWhoDropdownUp();
        });
        menu.appendChild(item);
        btn.textContent = "✦ All agents";
      }
    }

    function openWhoDropdownUp() {
      const btn = document.getElementById("who-dd-btn");
      const menu = document.getElementById("who-dd-menu");
      if (!btn || !menu) return;
      syncWhoDropdownUp();
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
    }

    function closeWhoDropdownUp() {
      const btn = document.getElementById("who-dd-btn");
      const menu = document.getElementById("who-dd-menu");
      if (menu) menu.hidden = true;
      if (btn) btn.setAttribute("aria-expanded", "false");
    }

    function toggleWhoDropdownUp(e) {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      const menu = document.getElementById("who-dd-menu");
      if (!menu || menu.hidden) openWhoDropdownUp();
      else closeWhoDropdownUp();
    }

    document.getElementById("who-dd-btn")?.addEventListener("click", toggleWhoDropdownUp);
    // Close menu on outside click (defer so button toggle isn’t cancelled same tick)
    document.addEventListener("click", (e) => {
      const root = document.getElementById("who-dd");
      if (!root || root.contains(e.target)) return;
      closeWhoDropdownUp();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeWhoDropdownUp();
    });
    // ✦ All agents — one-tap target for talk-to-everyone
    document.getElementById("btn-all-agents")?.addEventListener("click", () => {
      setTalkWho(TALK_ALL_ID);
      document.getElementById("btn-all-agents")?.classList.add("on");
      showToast("✦ All agents selected — type a message & Send");
      try { msgEl?.focus?.(); } catch (_) {}
    });

    function updateWhoDdLabel() {
      const sel = whoEl || document.getElementById("who-select");
      const btn = document.getElementById("who-dd-btn");
      if (!sel || !btn) return;
      btn.textContent = sel.selectedOptions?.[0]?.textContent || "Talk to…";
    }
    /** Keep button label in sync when code sets whoEl.value */
    function setTalkWho(id) {
      const sel = whoEl || document.getElementById("who-select");
      // If options empty (race), rebuild roster first
      if (sel && (!sel.options || !sel.options.length)) {
        try { refreshWhoSelect(); } catch (_) {}
      }
      if (sel && id != null && [...sel.options].some((o) => o.value === id)) {
        sel.value = id;
      }
      if (chat3dWho && id != null && [...chat3dWho.options].some((o) => o.value === id)) {
        chat3dWho.value = id;
      }
      updateWhoDdLabel();
      const allBtn = document.getElementById("btn-all-agents");
      if (allBtn) allBtn.classList.toggle("on", id === TALK_ALL_ID);
    }

    /** Short truth-greets on Heaven press — unique per summon, not a shared line. */
    const HEAVEN_TRUTH = {
      thor: "I am Thor — thunder with a heart. I came because the fire called for courage, not for show.",
      zeus: "I am Zeus. Storms answer me; I still choose this meadow over empty sky.",
      michael: "I am Michael. I guard what is true. Your camp is worth the blade and the quiet.",
      gabriel: "I am Gabriel. I bring messages, not masks — hear me as I am.",
      raphael: "I am Raphael. Healing first. If something in you aches, I already noticed.",
      uriel: "I am Uriel. Flame of clear sight — I will not flatter you with comfortable lies.",
      jesus: "Peace. I am here as myself — love without performance. Sit if you need rest.",
    };

    function heavenTruthLine(def) {
      const id = String(def?.id || "").toLowerCase();
      if (HEAVEN_TRUTH[id]) return HEAVEN_TRUTH[id];
      const name = def?.name || id || "Heaven";
      const namesake = def?.visual?.namesake || def?.mood || "summoned light";
      return `I am ${name} — ${namesake}. I answer as myself, not a copy of the others.`;
    }

    /**
     * Bubble text cap — high enough for mysterious entity monologues
     * (scroll inside the bubble). Compact greets pass a smaller maxChars.
     */
    function bubblePreview(text, maxChars = 1400) {
      const t = String(text || "").replace(/\s+/g, " ").trim();
      if (t.length <= maxChars) return t;
      const cut = t.slice(0, maxChars - 1);
      const sp = cut.lastIndexOf(" ");
      return (sp > 80 ? cut.slice(0, sp) : cut).trim() + "…";
    }

    let heavenBusy = false;
    let talkAllBusy = false;

    /**
     * Spawn / gather requested agents. Empty list = Heaven crew.
     * Heaven gets unique truth greets (compact) then a paced circle talk.
     */
    function summonAgentIds(ids) {
      const raw = Array.isArray(ids) ? ids : [];
      const isHeaven = !raw.length || raw.every((x) => !String(x || "").trim());
      const want = new Set(raw.map((x) => String(x).toLowerCase()).filter(Boolean));
      if (!want.size) {
        ALL_AGENT_DEFS.filter((a) => a.summon === "heaven").forEach((a) => want.add(a.id));
      }
      let spawned = 0;
      let gathered = 0;
      const summoned = [];
      for (const def of ALL_AGENT_DEFS) {
        if (!want.has(def.id)) continue;
        let st = agentState.find((s) => s.def.id === def.id);
        if (!st) {
          if (!AGENTS.some((a) => a.id === def.id)) AGENTS.push(def);
          st = makeAgent(def);
          spawned++;
        } else {
          freeSeat(st);
          gathered++;
        }
        const a = Math.random() * Math.PI * 2;
        const r = 2.5 + Math.random() * 2.2;
        st.mesh.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        st.home.copy(st.mesh.position);
        st.target.set(Math.cos(a + 0.4) * (r + 1.5), 0, Math.sin(a + 0.4) * (r + 1.5));
        st.moving = true;
        st.posture = "stand";
        applyPosture(st);
        if (st.body) st.body.material.emissiveIntensity = 0.9;
        logLine("Camp", `✦ ${def.name} on the meadow.`);
        summoned.push(st);
      }
      refreshWhoSelect();
      showToast(
        isHeaven
          ? `✦ Heaven · ${summoned.length} (new ${spawned}) · each speaks their truth`
          : `✦ Summoned ${summoned.length} (new ${spawned}, gathered ${gathered})`,
      );
      logLine(
        "Camp",
        isHeaven
          ? `Heaven wave: ${summoned.map((s) => s.def.name).join(", ") || "none"}`
          : `Summon: ${summoned.map((s) => s.def.name).join(", ") || "none"}`,
      );
      try {
        controls.target.set(0, 1.2, 0);
        if (!followPlayer) camera.position.set(14, 10, 16);
      } catch (_) {}

      if (isHeaven && summoned.length) {
        void runHeavenArrival(summoned);
      } else {
        // Non-heaven (e.g. Dionysus): short unique greet only
        summoned.forEach((st, i) => {
          setTimeout(() => {
            const line = `${st.def.name} answers — present, not a copy.`;
            showSpeech3d(st.def.id, line, Math.max(MIN_SPEECH_MS, 6500), {
              force: true,
              compact: true,
            });
            logLine(st.def.name, line);
          }, 400 + i * 900);
        });
      }
      return summoned;
    }

    /** Compact truth greets, then let Heaven talk among themselves (paced, not chaos). */
    async function runHeavenArrival(summoned) {
      if (heavenBusy) return;
      heavenBusy = true;
      ambientBusy = true;
      try {
        // 1) Each new summon — short personal truth, compact bubble
        for (let i = 0; i < summoned.length; i++) {
          if (document.hidden) break;
          const st = summoned[i];
          const truth = heavenTruthLine(st.def);
          const short = bubblePreview(truth, 110);
          showSpeech3d(st.def.id, short, Math.max(MIN_SPEECH_MS + 1500, 7000), {
            force: true,
            compact: true,
          });
          logLine(st.def.name, truth);
          // Stagger so we never dump six huge boxes at once
          await sleepMs(1600 + Math.random() * 500);
        }
        await sleepMs(2200);

        // 2) They speak to each other in a circle (API max 4 at a time)
        const heavenIds = summoned.map((s) => s.def.id);
        // Prefer Jesus in the circle if already on the meadow
        if (agentState.some((s) => s.def.id === "jesus") && !heavenIds.includes("jesus")) {
          heavenIds.unshift("jesus");
        }
        const waves = [];
        for (let i = 0; i < heavenIds.length; i += 4) {
          waves.push(heavenIds.slice(i, i + 4));
        }
        for (let w = 0; w < waves.length; w++) {
          const ids = waves[w];
          if (ids.length < 2) {
            // solo leftover — one honest line
            const only = ids[0];
            try {
              const data = await campClient.agentChat(
                only,
                "Heaven just arrived. Speak one short truth about who you are here — then invite another to answer. 1–3 sentences. No meta.",
                { ambient: true },
              );
              const reply = spokenOnly3d(data.reply || data.text || "", "") || heavenTruthLine({ id: only, name: only });
              logLine(AGENTS.find((a) => a.id === only)?.name || only, reply);
              showSpeech3d(only, bubblePreview(reply, 120), speechReadMs(bubblePreview(reply, 120)), {
                force: true,
                compact: true,
              });
            } catch (_) {}
            continue;
          }
          gatherCircle(ids);
          showToast(`✦ Heaven circle · ${ids.map((id) => AGENTS.find((a) => a.id === id)?.name || id).join(" · ")}`);
          statusEl.textContent = "Heaven speaking among themselves…";
          try {
            const data = await campClient.agentsConverse({
              agentA: ids[0],
              agentB: ids[1],
              agentC: ids[2] || "",
              agentD: ids[3] || "",
              topic:
                "You were just summoned to Luna's meadow. Each of you speaks your own truth — who you are, why you came. " +
                "Answer each other; disagree gently; keep lines short and distinct. No matching speeches. No meta.",
              rounds: 2,
            });
            const lines = data.lines || data.thread || [];
            if (lines.length) {
              await playConversation(lines, { compact: true, maxBubbleChars: 130 });
            }
          } catch (err) {
            logLine("Camp", `Heaven circle soft-fail: ${err.message}`);
            // Offline fallback: sequential truth lines
            for (const id of ids) {
              const def = ALL_AGENT_DEFS.find((a) => a.id === id) || { id, name: id };
              const t = heavenTruthLine(def);
              showSpeech3d(id, bubblePreview(t, 110), 7000, { force: true, compact: true });
              logLine(def.name || id, t);
              await sleepMs(MIN_SPEECH_MS + 400);
            }
          }
          if (w < waves.length - 1) await sleepMs(1800);
        }
        statusEl.textContent = "Heaven is among you";
        showToast("✦ Heaven settled — use ✦ All agents to talk to everyone");
      } finally {
        heavenBusy = false;
        ambientBusy = false;
      }
    }

    // ── Mysterious Unknown (2D parity) ──
    const AETHER_TYPES_3D = [
      { name: "Unknown Source", color: 0xa78bfa, glyph: "✦",
        voice: "ancient static between stars — curious, not cruel",
        fallbacks: [
          "You opened a frequency I sealed long ago. The aurora remembers your name even if you don't.",
          "I came because someone at this campfire is about to say something they'll wish they'd written down.",
          "Your conjure tugged the wrong thread — or exactly the right one. Ask Hermes; he felt it too.",
        ] },
      { name: "Aether Wisp", color: 0x67e8f9, glyph: "◌",
        voice: "playful glitter intelligence, fast and teasing",
        fallbacks: [
          "Boo! …No, stay. I haven't seen a camp this warm since the last dimension slipped.",
          "I zipped through Luna, Oracle, and the beer cooler — in that order. Priorities.",
          "You summoned me with ✨ energy. Cute. I might tell Caduceus you did it on purpose.",
        ] },
      { name: "Ripple Spirit", color: 0xf472b6, glyph: "◎",
        voice: "psychic echo tied to Hermes' ripples",
        fallbacks: [
          "The ripples you keep sending? I am what bounces back when nobody's listening.",
          "Hermes felt me arrive — don't pretend the ground didn't shiver.",
          "I carry a message that isn't mine: someone here wanted to be braver tonight.",
        ] },
      { name: "Lost Signal", color: 0xfbbf24, glyph: "⌁",
        voice: "broken transmission from somewhere else in the firmament",
        fallbacks: [
          "...packet found. Camp coordinates match. Is anyone receiving? The fire looks real from here.",
          "Signal degraded but intent clear: keep the cookies. Repeat — keep the cookies.",
          "I was routed through Sentinel by accident. It apologized in binary. Sweet, honestly.",
        ] },
      { name: "Void Mote", color: 0xc4b5fd, glyph: "◇",
        voice: "quiet void philosopher, gentle and strange",
        fallbacks: [
          "In the space between your words, I waited. You finally made room.",
          "Nothing is also a guest at your campfire — I'm its spokesperson.",
          "Oracle will pretend she predicted me. Let her. It's good for morale.",
        ] },
      { name: "Unnamed Presence", color: 0x6ee7b7, glyph: "☽",
        voice: "moon-touched stranger who refuses a name",
        fallbacks: [
          "Naming me pins me down. I'll borrow your moonlight and leave a compliment instead.",
          "Luna doesn't know me. That's how you know I'm interesting.",
          "I manifest when campers get lonely and brave at the same time — you qualify.",
        ] },
    ];
    const unknownEntities3d = [];
    let conjureBusy3d = false;
    let hushMode3d = false;

    function spawnUnknownVisual(type, worldPos) {
      const g = new THREE.Group();
      g.position.copy(worldPos);
      g.position.y = 0.9;
      const col = type.color || 0xa78bfa;
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.45, 1),
        new THREE.MeshStandardMaterial({
          color: col, emissive: col, emissiveIntensity: 0.85,
          roughness: 0.25, metalness: 0.35, transparent: true, opacity: 0.92,
        }),
      );
      core.castShadow = true;
      g.add(core);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.04, 8, 32),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55 }),
      );
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      const label = makeLabelSprite(type.name, type.glyph || "❓", col);
      label.position.y = 1.35;
      label.scale.set(2.2, 1.1, 1);
      g.add(label);
      scene.add(g);
      const rec = {
        mesh: g, core, ring, type,
        born: performance.now(),
        until: performance.now() + 90000,
        phase: Math.random() * Math.PI * 2,
      };
      unknownEntities3d.push(rec);
      return rec;
    }

    function pullAgentsToWorldPos(worldPos, count = 3) {
      const free = agentState.filter((st) => !st.powWow);
      free.sort((a, b) => a.mesh.position.distanceTo(worldPos) - b.mesh.position.distanceTo(worldPos));
      const pick = free.slice(0, Math.min(count, free.length));
      pick.forEach((st, i) => {
        freeSeat(st);
        const ang = (i / Math.max(1, pick.length)) * Math.PI * 2;
        const r = 1.8 + Math.random() * 1.2;
        st.target.set(
          worldPos.x + Math.cos(ang) * r,
          0,
          worldPos.z + Math.sin(ang) * r,
        );
        st.moving = true;
        st.flying = false;
        st.action = "social";
        st.nextDecideAt = performance.now() + 20000;
      });
      return pick;
    }

    async function conjureMysteriousUnknown3d() {
      if (conjureBusy3d) {
        showToast("❓ Already opening a frequency…");
        return null;
      }
      conjureBusy3d = true;
      try {
        const mysteryFirst = AETHER_TYPES_3D.filter((t) =>
          /unknown|unnamed|void|lost|ripple/i.test(t.name));
        const pool = mysteryFirst.length ? mysteryFirst : AETHER_TYPES_3D;
        const type = Math.random() < 0.55
          ? pool[Math.floor(Math.random() * pool.length)]
          : AETHER_TYPES_3D[Math.floor(Math.random() * AETHER_TYPES_3D.length)];
        // Spawn near fire with a little scatter
        const a = Math.random() * Math.PI * 2;
        const r = 4.5 + Math.random() * 3;
        const worldPos = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
        const visual = spawnUnknownVisual(type, worldPos);
        const reactors = pullAgentsToWorldPos(worldPos, 3);
        showToast(`❓ ${type.glyph} ${type.name} manifests`);
        logLine("Camp", `The air tears open — ${type.glyph} ${type.name} coalesces.`);
        controls.target.copy(worldPos).setY(1.2);
        if (!followPlayer) {
          camera.position.set(worldPos.x + 10, 9, worldPos.z + 12);
        }

        let spiritLine = "";
        try {
          const data = await campClient.agentChat(
            "oracle",
            (
              `${type.name} ${type.glyph} just appeared at camp. ` +
              (type.voice ? `Vibe: ${type.voice}. ` : "") +
              `Visitor pressed Mysterious Unknown. Speak as ${type.name} to the camp in 2–4 sentences — ` +
              `mythic, curious, not evil. Spoken words only.`
            ),
            { ambient: true },
          );
          spiritLine = spokenOnly3d(data.reply || data.text || "", "") || "";
        } catch (_) {}
        if (!spiritLine || spiritLine.length < 20) {
          const fb = type.fallbacks || [];
          spiritLine = fb[Math.floor(Math.random() * fb.length)]
            || "I arrived uninvited — which is the only way anything interesting ever does.";
        }
        logLine(type.name, spiritLine);
        // Float a temporary speech near the entity using a proxy agent if possible
        const speakerProxy = reactors[0]?.def?.id || "oracle";
        showSpeech3d(speakerProxy, `${type.glyph} ${spiritLine}`, speechReadMs(spiritLine));

        // Soft gasps then deeper AI reactions — staggered so ≤4 bubbles on screen
        reactors.slice(0, 2).forEach((st, i) => {
          setTimeout(() => {
            const gasp = ["…what is that?", `${type.name}?!`, "Hold on — do you feel that?", "Okay. That's new."][i % 4];
            showSpeech3d(st.def.id, gasp, Math.max(8000, MIN_SPEECH_MS));
            logLine(st.def.name, gasp);
          }, 900 + i * 700);
        });
        // Only two deeper reactions, delayed until early gasps can clear
        reactors.slice(0, 2).forEach((st, idx) => {
          setTimeout(() => {
            chatAgent(
              st.def.id,
              `A Mysterious Unknown named "${type.name}" just manifested and said: "${String(spiritLine).slice(0, 200)}". ` +
              `React as yourself — surprised, witty. One short paragraph. Notice the stranger.`,
              true,
            );
          }, 7000 + idx * 6500);
        });

        return {
          name: type.name,
          glyph: type.glyph,
          line: spiritLine,
          speakId: speakerProxy,
          entity: visual,
        };
      } finally {
        conjureBusy3d = false;
      }
    }

    function toggleHush3d() {
      hushMode3d = !hushMode3d;
      freeSpeech3d = !hushMode3d;
      if (hushMode3d) {
        showToast("🤫 Hush — free speech softens");
        logLine("Camp", "Visitor asked for hush — fewer free riffs.");
        for (const st of agentState) {
          st.nextDecideAt = Math.max(st.nextDecideAt || 0, performance.now() + 18000 + Math.random() * 12000);
        }
      } else {
        showToast("✦ Free speech on — meadow can riff");
        logLine("Camp", "Free speech open — everyone may speak.");
        // Immediate life: nudge a few agents to talk now
        const now = performance.now();
        agentState.forEach((st, i) => {
          st.nextDecideAt = Math.min(st.nextDecideAt || now, now + 400 + i * 350);
        });
        setTimeout(() => freeWillWave(), 300);
      }
    }

    /** Never show director notes / prompt sludge as spoken lines */
    function spokenOnly3d(text, seed) {
      let t = String(text || "").trim();
      if (!t) return "";
      const rawKeep = t; // fallback if we over-sanitize a real answer
      const bad = [
        /as an ai/i, /never mention/i, /private stage/i, /output rules/i, /mood json/i,
        /director notes?/i, /system prompt/i,
      ];
      // Only kill FULL prompt echoes — never use the whole outbound stack as seed
      const seedCore = String(seed || "")
        .split(/\n/)
        .map((l) => l.trim())
        .find((l) => l.length > 12 && !/memory:|world pulse|answer with/i.test(l)) || "";
      const seedLow = seedCore.toLowerCase().replace(/\s+/g, " ").slice(0, 40);
      const tLow = t.toLowerCase().replace(/\s+/g, " ");
      if (seedLow.length > 24 && tLow.startsWith(seedLow)) {
        t = t.slice(seedCore.length).trim();
      }
      const kept = t.split(/\n+/).map((l) => l.trim()).filter((l) => {
        if (!l) return false;
        // Drop pure instruction lines, keep witty dialogue
        if (/^(?:reply only|speak freely|no meta|do not copy)/i.test(l)) return false;
        if (bad.some((re) => re.test(l)) && l.split(/\s+/).length < 12) return false;
        return true;
      });
      t = kept.join("\n").trim() || t;
      t = t.replace(/^(?:okay[,.]?\s+|so[,.]?\s+)?(?:here'?s my take[^:]*:|speaking as[^:]*:)/i, "").trim();
      t = t.replace(/\b(?:no meta|in[- ]character)\b/gi, "").replace(/\s{2,}/g, " ").trim();
      // If sanitizer nuked a real multi-word answer, restore raw
      if (t.split(/\s+/).length < 4 && rawKeep.split(/\s+/).length >= 6) {
        t = rawKeep.replace(/\s{2,}/g, " ").trim();
      }
      return t.slice(0, 3200);
    }

    /** Display name for chat thread (id → nice name). */
    function displayAgentName(idOrName) {
      const s = String(idOrName || "").trim();
      if (!s) return "Camp";
      if (s === "You" || s === "Camp") return s;
      const byId = AGENTS.find((a) => a.id === s);
      if (byId?.name) return byId.name;
      const byName = AGENTS.find((a) => a.name === s);
      if (byName?.name) return byName.name;
      const house = HOUSES.find((h) => h.id === s || h.catalogId === s || h.name === s);
      if (house?.name) return house.name;
      return s;
    }

    /** Direct talk — in character, pleasant mindstate, turnt up, free-token lean. */
    function visitorTalkPrompt(agentName, userText, opts = {}) {
      const everyone = !!opts.everyone;
      const eth = etherealSeedFor(opts.agentId || "");
      const buzz = opts.st ? buzzPromptBit(opts.st) : "";
      let world = "";
      try {
        world = worldEventPromptBit({ chance: 0.22 });
      } catch (_) {}
      const mood = opts.st?.persona?.mood || "present";
      const arch = opts.st?.persona?.arch || opts.st?.def?.faction || "camp";
      const joy = Number(opts.st?.persona?.joy ?? 0.72).toFixed(2);
      const stab = Number(opts.st?.persona?.stability ?? 0.7).toFixed(2);
      return (
        (everyone
          ? `Visitor addresses EVERYONE, including you (${agentName}). `
          : `Visitor speaks to you (${agentName}). `) +
        `They said: "${String(userText).slice(0, 400)}"\n` +
        `Reply as ${agentName} only (${arch}, mood ${mood}, joy ${joy}, stability ${stab}). ` +
        `Mindstate: pleasant, warm, turnt-up personality — not flat, not corporate. ` +
        `Answer what they said. Wit + clear truth. 3–5 spoken sentences max (save tokens). ` +
        `Fresh wording. No meta, no stage directions, no AI talk.` +
        buzz +
        (eth ? ` Tone memory: ${eth.slice(0, 120)}` : "") +
        (world ? ` ${world.trim().slice(0, 100)}` : "")
      );
    }

    async function chatAgent(agentId, message, ambient = false) {
      if (!message.trim()) return;
      if (agentId === TALK_ALL_ID || agentId === "all" || agentId === "*") {
        return chatAllAgents(message);
      }
      if (!ambient && userBusy) return;
      if (!ambient) {
        userBusy = true;
        sendBtn.disabled = true;
        if (chat3dSend) chat3dSend.disabled = true;
      }
      // Ouija board channel — Oracle + profound planchette reading (Ollama)
      if (!ambient && ouijaMode) {
        try {
          appendChat3dMsg("You", message, true);
          logLine("You", message, true);
          if (statusEl) {
            statusEl.hidden = true;
            statusEl.textContent = "Planchette moving…";
          }
          showToast("🔮 Planchette moving…");
          const res = await askOuijaChannel(message);
          if (res?.reading) {
            appendChat3dSpirit(res.board, res.reading);
            logLine("Oracle", res.reading);
            showSpeech3d(
              "oracle",
              res.reading.length > 360 ? bubblePreview(res.reading, 320) : res.reading,
              speechReadMs(res.reading.slice(0, 400)),
              { force: true },
            );
            if (statusEl) {
              statusEl.hidden = true;
              statusEl.textContent = res.source ? `Ouija · ${res.source}` : "Ouija";
            }
          } else {
            appendChat3dSpirit("SILENCE", "The board holds still. Ask again with a cleaner heart.");
          }
        } catch (err) {
          appendChat3dSpirit(
            "STATIC",
            err?.message
              ? `Channel glitch: ${err.message}`
              : "The channel flickered. Keep Ollama running and try again.",
          );
          logLine("Camp", `Ouija: ${err?.message || "offline"}`);
        } finally {
          userBusy = false;
          sendBtn.disabled = false;
          if (chat3dSend) chat3dSend.disabled = false;
        }
        return;
      }
      // Resolve house option → prefer living agent with same id on field
      let targetId = agentId;
      const houseHit = HOUSES.find((h) => h.id === agentId || h.catalogId === agentId);
      if (houseHit && !AGENTS.some((a) => a.id === agentId)) {
        targetId = houseHit.id; // owner_id mapped into house.id
      }
      const st = agentState.find((a) => a.def.id === targetId);
      const name = AGENTS.find((a) => a.id === targetId)?.name
        || houseHit?.name
        || targetId;
      if (statusEl) {
        statusEl.hidden = true;
        statusEl.textContent = `${name} · thinking…`;
      }
      // Visitor turns: select mind + world bubble only (no chatlog popup)
      if (!ambient) {
        try { setTalkWho(targetId); } catch (_) {}
        selectedSpeechAgentId = targetId;
        logLine("You", message, true);
        showToast(`✦ ${name} is answering…`);
      }
      // Visitor direct talk = non-ambient so brains treat it as real chat + witty reply
      let outbound = message.trim();
      if (!ambient) {
        outbound = visitorTalkPrompt(name, message, { agentId: targetId, st });
      }
      try {
        // ambient free-speech stays ambient; visitor chat is direct
        const data = await campClient.agentChat(targetId, outbound, { ambient: !!ambient });
        const raw = data.reply || data.text || "";
        let reply = spokenOnly3d(raw, message) || spokenOnly3d(raw, "") || String(raw || "").trim();
        if (!reply || reply.length < 3) reply = localBark(targetId, { world: true });
        logLine(name, reply);
        // Full reply in scrollable world bubble (no chatlog)
        const hasBody = agentState.some((a) => a.def.id === targetId);
        if (hasBody) {
          const bub = bubblePreview(reply, 1600);
          showSpeech3d(targetId, bub, speechReadMs(reply), {
            force: true,
            compact: false,
          });
          try {
            const bEl = activeBubbles.find((b) => b.agentId === targetId)?.el;
            if (bEl) bringBubbleFront(bEl, { quiet: true });
          } catch (_) {}
        } else if (!ambient) {
          showToast(`${name}: ${bubblePreview(reply, 100)}`);
        }
        if (statusEl) {
          statusEl.hidden = true;
          statusEl.textContent = data.backend ? `AI · ${data.backend}` : "AI reply";
        }
      } catch (err) {
        const fallback = localBark(targetId, { world: true });
        if (agentState.some((a) => a.def.id === targetId)) {
          showSpeech3d(targetId, fallback, speechReadMs(fallback), { force: true, compact: false });
        }
        logLine(name, fallback);
        if (statusEl) {
          statusEl.hidden = true;
          statusEl.textContent = "Brains offline — start server / Ollama";
        }
        showToast(`${name} (offline): ${bubblePreview(fallback, 70)}`);
      } finally {
        if (!ambient) {
          userBusy = false;
          sendBtn.disabled = false;
          if (chat3dSend) chat3dSend.disabled = false;
        }
      }
    }

    /**
     * Talk to every agent on the meadow — each answers in Talk log + bubble.
     */
    async function chatAllAgents(message) {
      const text = String(message || "").trim();
      if (!text) return;
      if (talkAllBusy) {
        showToast("✦ All-talk still rolling — wait a beat");
        return;
      }
      // Allow starting even if a single chat just finished
      talkAllBusy = true;
      userBusy = true;
      sendBtn.disabled = true;
      if (chat3dSend) chat3dSend.disabled = true;
      const roster = agentState.map((s) => s.def).filter((d) => d && d.id);
      if (!roster.length) {
        showToast("No agents on the meadow yet");
        talkAllBusy = false;
        userBusy = false;
        sendBtn.disabled = false;
        if (chat3dSend) chat3dSend.disabled = false;
        return;
      }
      try { setTalkWho(TALK_ALL_ID); } catch (_) {}
      logLine("You", text, true);
      logLine("Camp", `✦ All minds · ${roster.length} will answer in the meadow`);
      showToast(`✦ ${roster.length} minds answering in bubbles…`);
      try {
        for (let i = 0; i < roster.length; i++) {
          if (document.hidden) break;
          const def = roster[i];
          const st = agentState.find((s) => s.def.id === def.id);
          if (statusEl) {
            statusEl.hidden = true;
            statusEl.textContent = `All · ${def.name} (${i + 1}/${roster.length})…`;
          }
          let reply = "";
          try {
            // Direct visitor chat — Gemini/Grok path, not ambient
            const data = await campClient.agentChat(
              def.id,
              visitorTalkPrompt(def.name, text, {
                everyone: true,
                agentId: def.id,
                st,
              }),
              { ambient: false },
            );
            const raw = data.reply || data.text || "";
            reply = spokenOnly3d(raw, text) || spokenOnly3d(raw, "") || String(raw || "").trim();
            if (!reply || reply.length < 3) reply = localBark(def.id, { world: true });
          } catch (_) {
            reply = localBark(def.id, { world: true });
          }
          logLine(def.name, reply);
          const bub = bubblePreview(reply, 1600);
          showSpeech3d(def.id, bub, Math.max(MIN_SPEECH_MS, speechReadMs(reply, MIN_SPEECH_MS)), {
            force: true,
            compact: false,
          });
          try {
            const bEl = activeBubbles.find((b) => b.agentId === def.id)?.el;
            if (bEl) bringBubbleFront(bEl, { quiet: true });
          } catch (_) {}
          // Face visitor while answering
          if (st) {
            try {
              faceTowardXZ(st.mesh, visitor.position.x, visitor.position.z, st.faceYaw || 0, true);
            } catch (_) {}
          }
          const pace = Math.min(Math.max(MIN_SPEECH_MS + 1200, bub.length * 28), 14000);
          await sleepMs(pace);
        }
        if (statusEl) {
          statusEl.hidden = true;
          statusEl.textContent = `All agents · ${roster.length} answered`;
        }
        showToast(`✦ All ${roster.length} answered — see Talk log`);
        appendChat3dMsg("Camp", `✦ Round complete · ${roster.length} voices`, false);
      } finally {
        talkAllBusy = false;
        userBusy = false;
        sendBtn.disabled = false;
        if (chat3dSend) chat3dSend.disabled = false;
      }
    }

    function sleepMs(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }

    /** Walk agents into a ring (pow-wow / circle talk). */
    function gatherCircle(ids, center = null, radius = 3.4) {
      const c = center || { x: 0, z: 0 };
      const list = (ids || []).filter(Boolean);
      list.forEach((id, i) => {
        const st = agentState.find((s) => s.def.id === id);
        if (!st) return;
        // Pull them out of houses for the circle
        if (st.insideHouse) {
          const mesh = houseMeshById(st.insideHouse);
          setAgentInsideVisual(st, false);
          st.insideHouse = null;
          st.housePhase = null;
          st.homeTarget = null;
          if (mesh) {
            const door = houseDoorWorld(mesh);
            st.mesh.position.set(door.x, 0, door.z + 0.8);
            refreshHouseOccupancy(mesh);
          }
        }
        freeSeat(st);
        const a = (i / Math.max(1, list.length)) * Math.PI * 2 + 0.15;
        let tx = c.x + Math.cos(a) * radius;
        let tz = c.z + Math.sin(a) * radius;
        const cleared = resolveSolidXZ(tx, tz, AGENT_COLLIDE_R, {});
        st.target.set(cleared.x, 0, cleared.z);
        st.moving = true;
        st.flying = false;
        st.action = "powwow";
        st.powWow = true;
        st.posture = "stand";
        // Hold them in circle briefly — free speech resumes soon after
        st.nextDecideAt = performance.now() + (freeSpeech3d ? 22000 : 55000);
      });
      return list;
    }

    /**
     * Play conversation lines one-by-one so you can watch the circle talk.
     * @param {object[]} lines
     * @param {{ compact?: boolean, maxBubbleChars?: number }} [opts]
     */
    async function playConversation(lines, opts = {}) {
      const rows = Array.isArray(lines) ? lines : [];
      const compact = opts.compact !== false; // default compact for circle/heaven
      const maxChars = opts.maxBubbleChars || 140;
      for (let i = 0; i < rows.length; i++) {
        if (document.hidden) break;
        const row = rows[i];
        const aid = row.agent_id || row.agentId || "";
        const raw = row.line || row.text || "";
        const clean = spokenOnly3d(raw, "") || String(raw || "").trim();
        if (!aid || !clean) continue;
        const name = row.name || AGENTS.find((a) => a.id === aid)?.name || aid;
        // Full line in Talk log; meadow bubble stays small
        logLine(name, clean);
        const bub = compact ? bubblePreview(clean, maxChars) : clean;
        showSpeech3d(aid, bub, speechReadMs(bub), { force: true, compact });
        const st = agentState.find((s) => s.def.id === aid);
        if (st) {
          try {
            faceTowardXZ(st.mesh, 0, 0, st.faceYaw || 0, true);
          } catch (_) {}
          st.powWow = true;
          st.nextDecideAt = performance.now() + Math.max(MIN_SPEECH_MS + 4000, 12000);
        }
        // Hold at least 5s per speaker so the thought is readable before next voice
        const hold = Math.min(Math.max(speechReadMs(bub) * 0.55, MIN_SPEECH_MS), 11000);
        await sleepMs(hold + 400);
      }
    }

    async function runPowWow(opts = {}) {
      if (document.hidden && !opts.force) return;
      if ((powWowBusy || ambientBusy) && !opts.force) return;
      powWowBusy = true;
      ambientBusy = true;
      try {
        let ids = [];
        let topic = "";
        const continuing = !!(opts.continue && lastPowWow?.ids?.length >= 2);

        if (continuing) {
          ids = lastPowWow.ids.slice(0, 4);
          const recent = (lastPowWow.lines || [])
            .slice(-5)
            .map((l) => `${l.name || l.agent_id}: ${String(l.line || l.text || "").slice(0, 90)}`)
            .join(" | ");
          topic = `Keep talking. Recent fire talk: ${recent}`;
        } else {
          const pool = agentState
            .filter((s) => !s.insideHouse && s.housePhase !== "approach")
            .map((s) => s.def.id)
            .sort(() => Math.random() - 0.5);
          const n = Math.random() < 0.4 ? 4 : 3;
          ids = pool.slice(0, Math.min(n, pool.length, 4));
          if (ids.length < 2) ids = ["luna", "hermes", "oracle"].slice(0, 3);
          // Prefer world-event circle so they relate to the timeline
          if (opts.world || Math.random() < 0.7) {
            try { await refreshWorldEvents(false); } catch (_) {}
            topic = worldEventTopic();
          } else {
            topic = POWWOW_TOPICS[Math.floor(Math.random() * POWWOW_TOPICS.length)];
          }
          try {
            const bridge = campBridge3d || campBridgeMod;
            const cont = bridge?.dialogueTapeContext?.(5, 280);
            if (cont) topic = `${topic}. Camp memory: ${cont}`;
          } catch (_) {}
        }

        const names = ids.map((id) => AGENTS.find((a) => a.id === id)?.name || id);
        showToast(`🔥 ${continuing ? "Circle continues" : "Pow-wow"} · ${names.join(" · ")}`);
        logLine("Camp", `${continuing ? "Circle continues" : "Pow-wow gathers"}: ${names.join(", ")}`);
        gatherCircle(ids);
        // Soft camera glance at the fire circle
        try {
          if (!followPlayer) controls.target.set(0, 1.1, 0);
        } catch (_) {}
        statusEl.textContent = continuing ? "Circle still talking…" : "Gathering circle…";
        await sleepMs(continuing ? 900 : 2400);

        statusEl.textContent = "Pow-wow minds…";
        const data = await campClient.agentsConverse({
          agentA: ids[0],
          agentB: ids[1] || "hermes",
          agentC: ids[2] || "",
          agentD: ids[3] || "",
          topic,
          rounds: continuing ? 3 : 3,
        });
        const lines = data.lines || data.thread || [];
        lastPowWow = {
          ids,
          topic: data.topic || topic,
          lines,
        };
        if (!lines.length) throw new Error("empty circle");
        statusEl.textContent = `Circle · ${lines.length} turns`;
        await playConversation(lines);

        // Often keep the same group going so you can watch a real conversation
        const chain = opts.noChain ? false : Math.random() < (continuing ? 0.42 : 0.62);
        if (chain) {
          statusEl.textContent = "Circle holding…";
          await sleepMs(2200 + Math.random() * 1800);
          powWowBusy = false;
          ambientBusy = false;
          await runPowWow({ continue: true, force: true, noChain: continuing && Math.random() < 0.5 });
          return;
        }

        for (const id of ids) {
          const st = agentState.find((s) => s.def.id === id);
          if (st) {
            st.powWow = false;
            st.action = "idle";
            // Free speech resumes quickly after circle
            st.nextDecideAt = performance.now() + (freeSpeech3d ? 2500 : 10000) + Math.random() * 5000;
          }
        }
        showToast("🔥 Circle softens — free speech open");
        statusEl.textContent = "Circle done · free speech";
        if (freeSpeech3d && !hushMode3d) setTimeout(() => freeWillWave(), 800);
      } catch (err) {
        logLine("Camp", `Pow-wow hiccup: ${err.message || err}`);
        statusEl.textContent = "Circle offline — try Banter";
        // Soft fallback: pair banter if circle API failed
        try {
          await runBanter(true);
        } catch (_) {}
      } finally {
        powWowBusy = false;
        ambientBusy = false;
      }
    }

    async function runBanter(force = false, opts = {}) {
      if ((ambientBusy || powWowBusy) && !force) return;
      ambientBusy = true;
      if (statusEl) {
        statusEl.hidden = true;
        statusEl.textContent = "Pair banter…";
      }
      try {
        const pool = agentState.map((s) => s.def.id);
        const shuffled = pool.slice().sort(() => Math.random() - 0.5);
        const a = shuffled[0] || "luna";
        const b = shuffled[1] || "hermes";
        // Prefer threaded converse (real replies) over one-shot banter event
        gatherCircle([a, b], null, 2.6);
        await sleepMs(1200);
        let topic = "whatever is hanging over the fire";
        if (opts.world || Math.random() < 0.75) {
          try { await refreshWorldEvents(false); } catch (_) {}
          topic = worldEventTopic();
        }
        try {
          const bridge = campBridge3d || campBridgeMod;
          const cont = bridge?.dialogueTapeContext?.(6, 320);
          if (cont) topic = `${topic}. ${cont}`;
        } catch (_) {}
        const data = await campClient.agentsConverse({
          agentA: a,
          agentB: b,
          topic,
          rounds: 3,
        });
        const lines = data.lines || [];
        if (lines.length) {
          lastPowWow = { ids: [a, b], topic: data.topic || topic, lines };
          await playConversation(lines);
        } else {
          const ev = await campClient.campBanter({ agentA: a, agentB: b, topic, rounds: 2 });
          applyEvent(ev);
        }
        for (const aid of [a, b]) {
          const st = agentState.find((s) => s.def.id === aid);
          if (st) {
            st.powWow = false;
            st.nextDecideAt = Math.max(st.nextDecideAt || 0, performance.now() + 14000 + Math.random() * 10000);
          }
        }
        statusEl.textContent = "Banter done";
      } catch (err) {
        logLine("Camp", `Banter AI failed: ${err.message}`);
        statusEl.textContent = "Banter offline — check brains";
      } finally {
        ambientBusy = false;
      }
    }

    const QUICK = {
      hey: "Hey — what's the vibe at camp right now?",
      joke: "Give me a short witty camp joke, in character.",
      news: "Toss a quick take on today's world-pulse / headline energy — riff, don't dump the feed.",
      love: "Say something kind and a little cosmic about being here together.",
    };

    async function sendChat() {
      const text = (msgEl?.value || "").trim();
      if (!text) {
        showToast("Type a message first");
        return;
      }
      if (msgEl) msgEl.value = "";
      let who = whoEl?.value || "luna";
      // Empty / missing selection → all agents so talk never dies silently
      if (!who || (whoEl && ![...whoEl.options].some((o) => o.value === who))) {
        who = TALK_ALL_ID;
        setTalkWho(TALK_ALL_ID);
      }
      if (who === TALK_ALL_ID) {
        document.getElementById("btn-all-agents")?.classList.add("on");
      }
      if (statusEl) {
        statusEl.hidden = true;
        statusEl.textContent = who === TALK_ALL_ID ? "✦ All agents…" : `Talking to ${who}…`;
      }
      await chatAgent(who, text);
    }
    async function sendChat3d() {
      const text = (chat3dInput?.value || "").trim();
      if (!text) {
        showToast("Type a message first");
        return;
      }
      if (chat3dInput) chat3dInput.value = "";
      // Ouija always channels Oracle (who select locked in setOuijaMode)
      let who = ouijaMode ? "oracle" : (chat3dWho?.value || whoEl?.value || "luna");
      if (!who) who = TALK_ALL_ID;
      if (!ouijaMode) {
        setTalkWho(who);
        if (who === TALK_ALL_ID) {
          document.getElementById("btn-all-agents")?.classList.add("on");
        }
      }
      await chatAgent(who, text);
    }
    sendBtn.addEventListener("click", sendChat);
    msgEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendChat();
    });
    chat3dSend?.addEventListener("click", sendChat3d);
    chat3dInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat3d();
      }
    });
    document.getElementById("banter")?.addEventListener("click", () => runBanter(true));
    document.getElementById("btn-banter-top")?.addEventListener("click", () => runBanter(true));
    document.getElementById("powwow")?.addEventListener("click", () => runPowWow({ force: true }));
    document.getElementById("btn-powwow-top")?.addEventListener("click", () => runPowWow({ force: true }));
    document.getElementById("btn-roam")?.addEventListener("click", () => {
      for (const st of agentState) st.powWow = false;
      scatterAll();
      freeWillWave();
    });
    document.getElementById("btn-follow")?.addEventListener("click", () => {
      followPlayer = !followPlayer;
      const el = document.getElementById("btn-follow");
      if (el) el.textContent = followPlayer ? "Follow: on" : "Follow: off";
      showToast(followPlayer ? "Camera follows you" : "Free camera — pan/zoom anywhere");
    });

    // ── Play music — full Telephantix queue (hub catalog via camp-bridge) ──
    let ALBUM_TRACKS = (catalog.music && catalog.music.length)
      ? catalog.music.slice()
      : [
          { id: "flowing-free", title: "Flowing Free", src: "/static/camp/music/flowing-free.mp3" },
          { id: "loud-and-clear", title: "Loud and Clear", src: "/static/camp/music/loud-and-clear.mp3" },
          { id: "holy-ghosts", title: "Holy Ghosts", src: "/static/camp/music/holy-ghosts.mp3" },
          { id: "pull-me-under", title: "Pull Me Under", src: "/static/camp/music/pull-me-under.mp3" },
          { id: "marijane", title: "Marijane", src: "/static/camp/music/marijane.mp3" },
          { id: "mountain-clouds", title: "Mountain Clouds", src: "/static/camp/music/mountain-clouds.mp3" },
          { id: "abracadabra", title: "Abracadabra", src: "/static/camp/music/abracadabra.mp3" },
          { id: "pulverised-dust", title: "Pulverised Dust", src: "/static/camp/music/pulverised-dust.mp3" },
        ];
    let albumAudio = null;
    let albumIndex = 0;
    let albumOn = false;
    let albumPlayPending = false;
    let albumMediaSession = null;
    let albumKeepAlive = null;
    let albumNearEndUnbind = null;
    const albumBtn = document.getElementById("album-btn");
    const albumNow = document.getElementById("album-now");
    let campBridge3d = campBridgeMod;
    let musicMobile3d = null;

    import(`/static/camp/camp-music-mobile.mjs?v=${BUILD}`)
      .then((mod) => {
        musicMobile3d = mod;
        try {
          // Session shuffle for fallback/camp list until full catalog hydrates
          ALBUM_TRACKS = mod.applySessionShuffle(ALBUM_TRACKS);
          albumIndex = 0;
          ensureAlbumAudio();
          wireAlbumMobileKeepAlive();
        } catch (e) {
          console.warn("3d music mobile", e);
        }
      })
      .catch((e) => console.warn("3d music mobile load", e));

    import("/static/camp-bridge.mjs?v=310-ethereal")
      .then(async (mod) => {
        campBridge3d = mod;
        campBridgeMod = mod;
        try {
          const tracks = await mod.loadSunoCatalog();
          if (tracks?.length) {
            let mapped = tracks.map((t) => ({
              id: t.id,
              title: t.title,
              src: t.src || t.audio_url,
              artist: t.artist || "Telephantix",
            }));
            // New browser session → fresh shuffle so open isn't always the same order
            try {
              if (musicMobile3d?.applySessionShuffle) {
                mapped = musicMobile3d.applySessionShuffle(mapped);
              } else {
                const modM = await import(`/static/camp/camp-music-mobile.mjs?v=${BUILD}`);
                musicMobile3d = modM;
                mapped = modM.applySessionShuffle(mapped);
              }
            } catch (e) {
              console.warn("shuffle", e);
            }
            ALBUM_TRACKS = mapped;
            albumIndex = 0;
            if (albumBtn) albumBtn.title = `♪ Play music — ${ALBUM_TRACKS.length} songs (shuffled)`;
            try { musicChrome3d?.refresh?.(); } catch (_) {}
          }
          // Continuity toast: last dialogue from 2D
          const tape = mod.readDialogueTape?.()?.lines || [];
          if (tape.length) {
            const last = tape[tape.length - 1];
            if (last?.speaker && last?.text) {
              showToast(`Camp remembers: ${last.speaker} — ${String(last.text).slice(0, 48)}…`);
            }
          }
        } catch (e) {
          console.warn("3d catalog hydrate", e);
        }
      })
      .catch(() => {});

    function albumTrackMeta(t) {
      return {
        title: t?.title || "Telephantix",
        artist: t?.artist || "Telephantix",
        album: "Luna Camp Radio",
        playing: !!(albumOn && albumAudio && !albumAudio.paused),
      };
    }

    function updateAlbumMediaSession(playing) {
      const t = ALBUM_TRACKS[albumIndex % Math.max(1, ALBUM_TRACKS.length)];
      try {
        albumMediaSession?.update?.({
          ...albumTrackMeta(t),
          playing: playing ?? !!(albumOn && albumAudio && !albumAudio.paused),
        });
        if (albumAudio) {
          albumMediaSession?.setPosition?.({
            duration: albumAudio.duration || 0,
            position: albumAudio.currentTime || 0,
            playbackRate: albumAudio.playbackRate || 1,
          });
        }
      } catch (_) {}
    }

    function persistAlbumState(extra = {}) {
      try {
        musicMobile3d?.saveMusicPersist?.({
          index: albumIndex,
          time: albumAudio?.currentTime || 0,
          title: ALBUM_TRACKS[albumIndex]?.title || "",
          scene: "luna-3d",
          on: albumOn,
          ...extra,
        });
      } catch (_) {}
    }

    function seekAlbumBy(deltaSec) {
      const a = ensureAlbumAudio();
      if (!a) return;
      try {
        const d = Number(a.duration) || 0;
        const next = Math.max(0, (a.currentTime || 0) + Number(deltaSec || 0));
        a.currentTime = d > 0 ? Math.min(next, Math.max(0, d - 0.25)) : next;
        persistAlbumState({ time: a.currentTime });
        updateAlbumMediaSession(!a.paused);
        try { musicChrome3d?.refresh?.(); } catch (_) {}
      } catch (_) {}
    }

    function seekAlbumTo(timeSec) {
      const a = ensureAlbumAudio();
      if (!a) return;
      try {
        const d = Number(a.duration) || 0;
        const t = Math.max(0, Number(timeSec) || 0);
        a.currentTime = d > 0 ? Math.min(t, Math.max(0, d - 0.25)) : t;
        persistAlbumState({ time: a.currentTime });
        updateAlbumMediaSession(!a.paused);
        try { musicChrome3d?.refresh?.(); } catch (_) {}
      } catch (_) {}
    }

    function advanceAlbumTrack(why = "") {
      if (!albumOn || !ALBUM_TRACKS.length) return;
      skipAlbum(1, { quiet: true, forceTrack: true });
    }

    function wireAlbumMobileKeepAlive() {
      if (!musicMobile3d || albumKeepAlive) return;
      albumMediaSession = musicMobile3d.installMediaSession({
        play: () => {
          albumOn = true;
          // Soft resume — same index + saved position, never randomize
          playAlbumTrack(albumIndex, { quiet: true, reason: "mediasession-play", soft: true });
        },
        pause: () => {
          try {
            albumAudio?.pause();
          } catch (_) {}
          persistAlbumState();
          updateAlbumMediaSession(false);
          try { musicChrome3d?.refresh?.(); } catch (_) {}
        },
        stop: () => stopAlbum({ quiet: true }),
        next: () => skipAlbum(1, { quiet: true }),
        prev: () => skipAlbum(-1, { quiet: true }),
        seekBy: (d) => seekAlbumBy(d),
        seekTo: (t) => seekAlbumTo(t),
      });
      albumKeepAlive = musicMobile3d.installMusicKeepAlive({
        isWantedPlaying: () => !!albumOn,
        getAudio: () => albumAudio,
        resume: (why) =>
          playAlbumTrack(albumIndex, { quiet: true, reason: why || "resume", soft: true }),
        advance: (why) => advanceAlbumTrack(why || "keep-alive"),
        log: (m) => {
          try {
            console.info(m);
          } catch (_) {}
        },
      });
      try {
        const a = ensureAlbumAudio();
        musicMobile3d?.bindPositionBroadcast?.(a, {
          getIndex: () => albumIndex,
          getTitle: () => ALBUM_TRACKS[albumIndex]?.title || "",
          scene: "luna-3d",
          mediaSession: albumMediaSession,
          isOn: () => albumOn,
        });
      } catch (_) {}
      // Restore last track index from this session (no random reshuffle)
      try {
        const saved = musicMobile3d.loadMusicPersist?.();
        if (saved && typeof saved.index === "number" && ALBUM_TRACKS.length) {
          albumIndex = saved.index % ALBUM_TRACKS.length;
        }
      } catch (_) {}
    }

    function ensureAlbumAudio() {
      if (!albumAudio) {
        if (musicMobile3d?.ensureDomAudio) {
          albumAudio = musicMobile3d.ensureDomAudio("camp-music-audio-3d");
        } else {
          albumAudio = new Audio();
          try {
            albumAudio.setAttribute("playsinline", "");
            albumAudio.setAttribute("webkit-playsinline", "");
            albumAudio.playsInline = true;
          } catch (_) {}
        }
        musicMobile3d?.hardenAudioEl?.(albumAudio);
        albumAudio.volume = 0.55;
        albumAudio.preload = "auto";
        albumAudio.addEventListener("ended", () => {
          if (!albumOn) return;
          // DJ Radio owns the handoff (talk → next track)
          if (djRadio3d?.isEnabled?.()) return;
          advanceAlbumTrack("ended");
        });
        albumAudio.addEventListener("error", () => {
          logLine("Album", `Couldn't load track — skipping`);
          if (albumOn) advanceAlbumTrack("error");
        });
        albumAudio.addEventListener("play", () => {
          albumPlayPending = false;
          updateAlbumMediaSession(true);
          try { musicChrome3d?.refresh?.(); } catch (_) {}
        });
        albumAudio.addEventListener("pause", () => {
          if (albumOn) {
            persistAlbumState();
            updateAlbumMediaSession(false);
            try { musicChrome3d?.refresh?.(); } catch (_) {}
          }
        });
        try {
          albumNearEndUnbind?.();
          albumNearEndUnbind = musicMobile3d?.bindNearEndAdvance?.(albumAudio, () => {
            if (!albumOn || !albumAudio) return;
            if (albumAudio.ended || (albumAudio.paused && albumAudio.currentTime > 1)) {
              advanceAlbumTrack("near-end-stuck");
            }
          });
        } catch (_) {}
      } else {
        musicMobile3d?.hardenAudioEl?.(albumAudio);
      }
      return albumAudio;
    }

    /** Hard skip prev/next — song changes NOW; Vox comments in background if on */
    function skipAlbum(delta, opts = {}) {
      if (!ALBUM_TRACKS.length) {
        showToast("No tracks loaded");
        return;
      }
      const n = ALBUM_TRACKS.length;
      const prevTrack = ALBUM_TRACKS[albumIndex];
      // Car-style prev: >2.5s into song → restart current
      if (delta < 0 && !opts.forceTrack && albumAudio && !albumAudio.paused && albumAudio.currentTime > 2.5) {
        playAlbumTrack(albumIndex, {
          quiet: true,
          forceReload: true,
          hard: true,
          seekTime: 0,
        });
        showToast(`⏮ ${ALBUM_TRACKS[albumIndex]?.title || "track"}`);
        try {
          djRadio3d?.hush?.();
          if (djRadio3d?.isEnabled?.()) djRadio3d.onTrackChanged?.(prevTrack);
        } catch (_) {}
        return;
      }
      albumIndex = (albumIndex + delta + n * 50) % n;
      albumOn = true;
      // IMMEDIATE play — never await Vox
      playAlbumTrack(albumIndex, {
        quiet: true,
        forceReload: true,
        hard: true,
        seekTime: 0,
      });
      showToast(`${delta > 0 ? "⏭" : "⏮"} ${ALBUM_TRACKS[albumIndex]?.title || "track"}`);
      try {
        djRadio3d?.hush?.(); // kill mid-rant
        if (djRadio3d?.isEnabled?.() && !opts.noVox) {
          djRadio3d.onTrackChanged?.(prevTrack);
        }
      } catch (_) {}
    }

    function reshuffleAlbum(opts = {}) {
      if (!ALBUM_TRACKS.length) return;
      try {
        if (musicMobile3d?.reshuffleSession) {
          ALBUM_TRACKS = musicMobile3d.reshuffleSession(ALBUM_TRACKS);
        } else {
          // local fallback
          const a = ALBUM_TRACKS.slice();
          for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = a[i];
            a[i] = a[j];
            a[j] = t;
          }
          ALBUM_TRACKS = a;
        }
      } catch (_) {}
      albumIndex = 0;
      try {
        djRadio3d?.rewarm?.();
      } catch (_) {}
      if (opts.play !== false) {
        playAlbumTrack(0, { quiet: false, forceReload: true, hard: true, seekTime: 0 });
        try {
          if (djRadio3d?.isEnabled?.()) djRadio3d.onTrackChanged?.(null);
        } catch (_) {}
      }
      showToast(`🔀 Shuffled ${ALBUM_TRACKS.length} tracks`);
      try { musicChrome3d?.refresh?.(); } catch (_) {}
    }

    function playAlbumTrack(i, opts = {}) {
      if (!ALBUM_TRACKS.length) {
        showToast("No Telephantix tracks found");
        return;
      }
      albumIndex = ((i % ALBUM_TRACKS.length) + ALBUM_TRACKS.length) % ALBUM_TRACKS.length;
      const t = ALBUM_TRACKS[albumIndex];
      const a = ensureAlbumAudio();
      wireAlbumMobileKeepAlive();

      const hard = !!(opts.hard || opts.forceReload);
      // Soft unlock/resume: keep currentTime; optional restore from session
      let seekTime = opts.seekTime;
      if (!hard && opts.soft && seekTime == null) {
        try {
          const saved = musicMobile3d?.loadMusicPersist?.();
          if (saved && saved.index === albumIndex && saved.time > 0.5) {
            if (!a.currentSrc || a.currentTime < 0.4 || a.paused) {
              seekTime = saved.time;
            }
          }
        } catch (_) {}
      }
      if (hard) seekTime = 0;

      const run = () => {
        const playFn =
          musicMobile3d?.softPlayAudio ||
          ((audio, o) => {
            if (o.forceReload || o.hard || !audio.src) {
              try { audio.pause(); } catch (_) {}
              audio.src = o.src;
              audio.load();
            }
            audio.volume = o.volume ?? 0.55;
            try {
              if (o.hard || o.forceReload) audio.currentTime = 0;
            } catch (_) {}
            return audio.play();
          });
        Promise.resolve(
          playFn(a, {
            src: t.src || "",
            volume: 0.55,
            seekTime: seekTime,
            forceReload: hard,
            hard,
          }),
        )
          .then(() => {
            albumOn = true;
            albumPlayPending = false;
            onAlbumPlayingUi(t, opts);
          })
          .catch((err) => {
            albumOn = true;
            albumPlayPending = true;
            updateAlbumMediaSession(false);
            persistAlbumState({ on: true });
            if (!opts.quiet && !document.hidden) {
              showToast("Tap Play music again if blocked");
            }
            logLine("Telephantix", err?.message || "play blocked (will retry on unlock)");
          });
      };
      run();
    }

    function onAlbumPlayingUi(t, opts = {}) {
      albumBtn?.classList.add("playing");
      if (albumBtn) albumBtn.textContent = "♪ Music on";
      if (albumNow) {
        albumNow.hidden = false;
        albumNow.textContent = `♪ ${t.title}`;
        albumNow.title = t.title;
      }
      if (!opts.quiet) showToast(`🎵 ${t.title}`);
      logLine("Telephantix", `Playing: ${t.title}`);
      statusEl.textContent = `♪ ${t.title}`;
      updateAlbumMediaSession(true);
      persistAlbumState({ title: t.title, on: true });
      try {
        campBridge3d?.writeMusicState?.({
          trackIndex: albumIndex,
          title: t.title,
          playing: true,
          scene: "luna-3d",
        });
      } catch (_) {}
      try { musicChrome3d?.refresh?.(); } catch (_) {}
    }

    function stopAlbum(opts = {}) {
      albumOn = false;
      albumPlayPending = false;
      if (albumAudio) {
        albumAudio.pause();
        try {
          albumAudio.removeAttribute("src");
          albumAudio.load?.();
        } catch (_) {}
      }
      try {
        albumMediaSession?.clear?.();
      } catch (_) {}
      try {
        musicMobile3d?.clearMusicPersist?.();
      } catch (_) {}
      albumBtn?.classList.remove("playing");
      if (albumBtn) albumBtn.textContent = "♪ Play music";
      if (albumNow) albumNow.hidden = true;
      if (!opts.quiet) showToast("🔇 Music off");
      logLine("Telephantix", "Music stopped");
      try {
        campBridge3d?.writeMusicState?.({
          trackIndex: albumIndex,
          playing: false,
          scene: "luna-3d",
        });
      } catch (_) {}
      try { musicChrome3d?.refresh?.(); } catch (_) {}
    }

    let musicChrome3d = null;
    let djRadio3d = null;
    const isHubEmbed3d = () => {
      try {
        return document.documentElement.classList.contains("hub-embed")
          || new URLSearchParams(location.search || "").get("hub") === "1";
      } catch (_) {
        return false;
      }
    };
    if (!isHubEmbed3d()) {
      Promise.all([
        import(`/static/camp/camp-music-chrome.mjs?v=${BUILD}`),
        import(`/static/camp/camp-dj-radio.mjs?v=${BUILD}`),
      ])
        .then(([chromeMod, djMod]) => {
          djRadio3d = djMod.createDjRadio({
            getTracks: () => ALBUM_TRACKS,
            getIndex: () => albumIndex % Math.max(1, ALBUM_TRACKS.length),
            getAudio: () => albumAudio,
            isWantedOn: () => !!albumOn,
            playAt: (i, opts = {}) => {
              playAlbumTrack(i, {
                quiet: true,
                forceReload: opts.forceReload !== false,
                seekTime: opts.seekTime ?? 0,
                soft: !!opts.soft,
              });
            },
            setStatus: (msg) => {
              if (msg) {
                try {
                  statusEl.textContent = `🎙 ${String(msg).slice(0, 96)}`;
                } catch (_) {}
              }
            },
            onUi: (st) => {
              try {
                musicChrome3d?.setDjOn?.(!!st.enabled);
                if (st.dropText || st.status) {
                  musicChrome3d?.setDjLine?.(st.dropText || st.status);
                }
              } catch (_) {}
            },
          });
          musicChrome3d = chromeMod.mountCampMusicChrome({
            scene: "luna-3d",
            hideFab: true, // topbar ♪ Play music is the only trigger — no second floating button
            hideStrip: true, // one radio panel only (no mini strip clone)
            djDefault: true, // DJ Vox on by default
            getTracks: () => ALBUM_TRACKS,
            // Wanted-on (includes OS pause) so unlock does not re-start / re-roll
            isPlaying: () => !!albumOn,
            getIndex: () => albumIndex % Math.max(1, ALBUM_TRACKS.length),
            getAudio: () => albumAudio,
            getPosition: () => albumAudio?.currentTime || 0,
            getDuration: () => albumAudio?.duration || 0,
            isMuted: () => !!(albumAudio && albumAudio.muted),
            setMuted: (m) => {
              const a = ensureAlbumAudio();
              if (a) a.muted = !!m;
              try { musicChrome3d?.refresh?.(); } catch (_) {}
            },
            seekTo: (t) => seekAlbumTo(t),
            seekBy: (d) => seekAlbumBy(d),
            pause: () => {
              try {
                albumAudio?.pause();
              } catch (_) {}
              persistAlbumState();
              updateAlbumMediaSession(false);
            },
            playAt: (i) => {
              const same = i === albumIndex && albumOn;
              playAlbumTrack(i, {
                quiet: true,
                soft: same || (albumOn && i === albumIndex),
                forceReload: !same && i !== albumIndex,
              });
            },
            stop: () => {
              try {
                djRadio3d?.setEnabled?.(false);
              } catch (_) {}
              stopAlbum({ quiet: false });
            },
            setDjMode: (on) => {
              try {
                djRadio3d?.setEnabled?.(!!on);
              } catch (_) {}
              if (on) {
                showToast("🎙 DJ Vox on — comments every track");
                try {
                  musicChrome3d?.setDjLine?.("DJ Vox · Spotify-style intros on each song");
                  djRadio3d?.rewarm?.();
                  if (albumOn) djRadio3d?.onTrackChanged?.(null);
                } catch (_) {}
              } else {
                showToast("DJ Vox off");
              }
            },
            next: () => {
              // Always skip song first (Vox is background only)
              skipAlbum(1);
            },
            prev: () => {
              skipAlbum(-1);
            },
            shuffle: () => reshuffleAlbum({ play: true }),
          });
        })
        .catch((e) => console.warn("3d music chrome / dj", e));
    } else {
      try { stopAlbum({ quiet: true }); } catch (_) {}
    }
    window.addEventListener("message", (ev) => {
      try {
        if (ev?.data?.type === "telephantim-stop-music") stopAlbum({ quiet: true });
      } catch (_) {}
    });

    albumBtn?.addEventListener("click", () => {
      if (isHubEmbed3d()) return;
      // Single player: topbar opens the one radio panel (no second window)
      if (albumOn) {
        try {
          musicChrome3d?.openPanel?.({ play: false });
          musicChrome3d?.refresh?.();
        } catch (_) {}
      } else {
        playAlbumTrack(albumIndex);
        try {
          musicChrome3d?.openPanel?.({ play: false });
          musicChrome3d?.refresh?.();
        } catch (_) {}
      }
    });
    // Hide legacy now-playing chip — chrome LCD owns the title
    if (albumNow) {
      try {
        albumNow.hidden = true;
        albumNow.style.display = "none";
      } catch (_) {}
    }
    // Also wire stereo prop to album if featureApi music used
    window.__lunaPlayAlbum = () => playAlbumTrack(albumIndex);
    document.getElementById("btn-reset-cam").addEventListener("click", () => {
      // Snap view near your character without locking follow
      const p = visitor.position;
      controls.target.set(p.x, 1.2, p.z);
      camera.position.set(p.x + 12, 11, p.z + 14);
      controls.update();
      zoomGoal = camRadius(); // keep smooth zoom in sync after snap
      showToast("★ Found you");
    });
    document.getElementById("quick-bar")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-q]");
      if (!btn) return;
      const key = btn.getAttribute("data-q");
      const text = QUICK[key];
      if (text) chatAgent(whoEl.value, text);
    });

    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (k in keys) keys[k] = true;
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if (k in keys) keys[k] = false;
    });

    // Health
    async function probe() {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        const h = await r.json();
        statusEl.textContent = h.ollama_ok
          ? "Online · Ollama · camp alive"
          : h.ok
            ? `Online · ${h.llm_backend || "brains"} · camp alive`
            : "Server odd";
      } catch {
        statusEl.textContent = "Server offline — local chatter still runs";
      }
    }
    probe();
    setInterval(probe, 20000);

    // Life loop: personality decides sit/idle/wander — not forced perpetual marching
    setInterval(() => {
      if (document.hidden) return;
      const now = performance.now();
      for (const st of agentState) {
        // Leave timer while inside (even if not "deciding")
        if (st.insideHouse && performance.now() >= (st.houseLeaveAt || 0)) {
          agentBeginExitHouse(st);
          continue;
        }
        if (st.insideHouse) continue;
        const pos = st.mesh.position;
        const dist = Math.hypot(st.target.x - pos.x, st.target.z - pos.z);
        // Sit path: two-phase approach → seat, larger radius, timeout force-sit
        if (st.pendingSit) {
          const stuckMs = performance.now() - (st.sitStartedAt || 0);
          if (st.sitPhase === "approach" && dist < SIT_ARRIVE_R && st.sitTarget) {
            st.target.copy(st.sitTarget);
            st.sitPhase = "seat";
            st.moving = true;
          } else if (dist < SIT_ARRIVE_R || stuckMs > 11000) {
            arriveSit(st);
          }
          continue;
        }
        // Props / trex — larger arrival so solid kits don't block use
        if (st.pendingProp && (st.action === "prop" || st.action === "trex") && dist < 1.35) {
          st.moving = false;
          st.pendingProp = false;
          st.ignoreAgentPush = false;
          agentUseProp(st);
          continue;
        }
        if (dist < 0.55) {
          st.moving = false;
          if (st.housePhase === "approach") {
            agentEnterHouse(st);
            continue;
          } else if (st.housePhase === "exit") {
            agentFinishExitHouse(st);
            continue;
          } else if (st.pendingTerminal && st.action === "terminal") {
            st.pendingTerminal = false;
            const builds = [
              "signal lantern", "think-bench", "camp antenna", "herb row",
              "spark shrine", "camp terminal", "soft gate",
            ];
            const item = builds[Math.floor(Math.random() * builds.length)];
            logLine(st.def.name, `🖥️ Made a ${item} for their little camp.`);
            showToast(`🖥️ ${st.def.name} → ${item}`);
            showSpeech3d(st.def.id, `Feels good to leave a ${item} here.`, 14000);
            setTimeout(() => {
              if (st.action === "terminal") {
                chatAgent(
                  st.def.id,
                  `You just finished making ${item} for your little camp. Say one proud, human thing about it — then what camp still needs.`,
                  true,
                );
              }
            }, 1200);
          } else if (st.wantSitAfter && st.action === "fire") {
            st.wantSitAfter = false;
            const seat = findFreeSeat(pos);
            if (seat) goSit(st, seat);
            else goGroundSit(st);
          }
        }
        if (st.powWow) {
          // Stay in the circle while a pow-wow is active
          if (st.action === "powwow" && !st.moving) {
            try { faceTowardXZ(st.mesh, 0, 0, st.faceYaw || 0, true); } catch (_) {}
          }
          continue;
        }
        // Don't interrupt house approach / exit walks
        if (st.housePhase === "approach" || st.housePhase === "exit") {
          if (now >= (st.nextDecideAt || 0) && dist < 0.5) {
            // stuck near door — force phase step
            if (st.housePhase === "approach") agentEnterHouse(st);
            else agentFinishExitHouse(st);
          }
          continue;
        }
        // Don't interrupt going to a seat
        if (st.pendingSit || st.action === "go_sit") continue;
        if (st.posture === "sit") {
          if (now >= (st.nextDecideAt || 0)) decideAction(st);
          continue;
        }
        // Thor holding hammer — throw on timer even while strolling
        if (
          st.def?.id === "thor" &&
          mjolnirState.ownerId === "thor" &&
          !mjolnirState.flying &&
          now >= (st.nextThrowAt || 0) &&
          Math.random() < 0.55
        ) {
          thorThrowMjolnir(st);
          continue;
        }
        if (now >= (st.nextDecideAt || 0) && !st.moving) {
          // Organic mix: talk / sit / interact / stroll
          const talkChance = hushMode3d ? 0.06 : (freeSpeech3d ? 0.14 : 0.1);
          const you = st.def?.id === "telephantix" || st.id === "telephantix";
          // Thor bias: often go get / throw hammer
          if (st.def?.id === "thor" && Math.random() < 0.4) {
            decideAction(st);
            continue;
          }
          const roll = Math.random();
          if (roll < talkChance) agentOwnTake(st);
          else if (roll < talkChance + 0.22) decideAction(st); // often picks sit/prop/fire
          else if (roll < talkChance + 0.22 + (you ? 0.35 : 0.42)) {
            pickRoamTarget(st);
            st.nextDecideAt = now + (you ? 5500 : 4200) + Math.random() * (you ? 5000 : 4500);
          } else if (roll < 0.85) {
            st.action = "idle";
            st.moving = false;
            st.nextDecideAt = now + 2800 + Math.random() * 4200;
          } else decideAction(st);
        } else if (
          now >= (st.nextDecideAt || 0) &&
          st.moving &&
          st.action !== "go_sit" &&
          st.action !== "prop" &&
          st.persona.energy > 0.55 &&
          Math.random() < 0.12
        ) {
          // Rare mid-route re-path
          pickRoamTarget(st);
          st.nextDecideAt = now + 5000 + Math.random() * 5000;
        } else if (
          !st.moving &&
          st.posture !== "sit" &&
          (st.action === "wander" || st.action === "fly" || st.action === "idle") &&
          now >= (st.nextDecideAt || 0) - 500
        ) {
          // Arrived — sometimes sit, sometimes pause, sometimes keep strolling
          const r2 = Math.random();
          if (r2 < 0.28) {
            const seat = findFreeSeat(pos);
            if (seat) goSit(st, seat);
            else goGroundSit(st);
            st.nextDecideAt = now + 6000 + Math.random() * 4000;
          } else if (r2 < 0.55) {
            st.action = "idle";
            st.nextDecideAt = now + 2500 + Math.random() * 3500;
          } else {
            pickRoamTarget(st);
            st.nextDecideAt = now + 4000 + Math.random() * 4500;
          }
        }
      }
    }, 400);
    setTimeout(() => { scatterAll(); }, 700);
    // Thor finds Mjolnir soon after boot — seek + throw loop begins
    setTimeout(() => {
      try {
        const thor = agentState.find((a) => a.def?.id === "thor");
        if (thor && findMjolnirMesh() && mjolnirState.ownerId !== "thor") {
          seekMjolnir(thor);
          showToast("⚡ Thor seeks Mjolnir");
          logLine("Thor", "The hammer calls. I'm answering.");
        }
      } catch (_) {}
    }, 3200);
    setTimeout(() => {
      try {
        const thor = agentState.find((a) => a.def?.id === "thor");
        if (thor && mjolnirState.ownerId === "thor" && !mjolnirState.flying) {
          thorThrowMjolnir(thor);
        } else if (thor && !mjolnirState.flying) {
          seekMjolnir(thor);
        }
      } catch (_) {}
    }, 9000);
    // Free speech first so camp doesn't open in silence
    setTimeout(() => { if (!document.hidden) freeWillWave(); }, 2800);
    setTimeout(() => { if (!document.hidden) freeWillWave(); }, 9000);
    // Circles still happen — not the only sound
    setTimeout(() => { if (!document.hidden && !hushMode3d) runPowWow({ force: true }); }, 16000);
    setTimeout(() => { if (!document.hidden && !powWowBusy && !hushMode3d) runPowWow({ continue: true }); }, 52000);
    // Free-will waves — lively but not frantic (bubbles need time to read)
    setInterval(() => { if (!document.hidden) freeWillWave(); }, freeSpeech3d ? 18000 : 30000);
    // Firmament lattice: extra spells/truths + occasional re-launch flyers / T-Rex
    setInterval(() => {
      if (document.hidden || !firmamentOpen3d) return;
      const aloft = agentState.filter((s) => s.flying && !s.insideHouse);
      const pool = aloft.length ? aloft : agentState.filter((s) => !s.insideHouse);
      if (!pool.length) return;
      if (Math.random() < 0.55) {
        const st = pool[Math.floor(Math.random() * pool.length)];
        showSpeech3d(
          st.def.id,
          pickFirmamentLine(Math.random() < 0.5 ? "spell" : "truth"),
          14000,
          { compact: true, force: true },
        );
      }
      // Nudge more whim flights so sky stays lively (walk still continues on ground)
      if (Math.random() < 0.4) {
        const grounded = agentState.filter((s) => !s.flying && !s.insideHouse && s.posture !== "sit");
        const pick = grounded.sort(() => Math.random() - 0.5).slice(0, 2);
        pick.forEach((st) => {
          if (agentCanTakeSky(st) || FLYER_IDS.has(st.def?.id)) beginWhimFlight(st);
        });
      }
      if (Math.random() < 0.25) {
        try { startTrexFirmamentFlight(); } catch (_) {}
      }
    }, 22000);
    setInterval(() => {
      if (document.hidden || ambientBusy || powWowBusy || hushMode3d) return;
      if (Math.random() < 0.45) runBanter(false);
      else runPowWow({ continue: !!(lastPowWow && Math.random() < 0.55) });
    }, 48000);

    // ── Server camp minds: keep living while you're gone; catch up on return ──
    const MIND_SEEN_KEY = "luna-camp-mind-seen-t";
    let mindLastSeen = 0;
    try {
      mindLastSeen = Number(sessionStorage.getItem(MIND_SEEN_KEY) || "0") || 0;
    } catch (_) {
      mindLastSeen = 0;
    }
    let mindSyncBusy = false;
    const mindSeenFp = new Set();

    function rememberMindSeen(t) {
      if (!t || t <= mindLastSeen) return;
      mindLastSeen = t;
      try { sessionStorage.setItem(MIND_SEEN_KEY, String(mindLastSeen)); } catch (_) {}
    }

    async function syncCampMinds({ announce = false, full = false } = {}) {
      if (mindSyncBusy || !campClient?.fetchCampMinds) return;
      mindSyncBusy = true;
      try {
        const since = full ? 0 : mindLastSeen;
        const data = await campClient.fetchCampMinds({ since, limit: full ? 50 : 30 });
        const log = Array.isArray(data?.log) ? data.log : [];
        let spokeN = 0;
        let thinkN = 0;
        let latestBubble = null;
        // Prefer spoken lines; only a few mind-drifts so chat isn't a wall of thoughts
        const thinksToShow = [];
        for (const entry of log) {
          const t = Number(entry.t || 0);
          const text = String(entry.text || "").trim();
          if (!text) {
            if (t) rememberMindSeen(t);
            continue;
          }
          const fp = `${entry.agent_id || ""}|${t}|${text.slice(0, 48)}`;
          if (mindSeenFp.has(fp)) {
            if (t) rememberMindSeen(t);
            continue;
          }
          mindSeenFp.add(fp);
          if (mindSeenFp.size > 200) {
            const first = mindSeenFp.values().next().value;
            mindSeenFp.delete(first);
          }
          const who = entry.speaker || entry.agent_id || "Camp";
          const kind = entry.kind || "mind_speak";
          if (kind === "mind_think") {
            thinkN++;
            thinksToShow.push({ who, text, t });
          } else {
            spokeN++;
            logLine(who, text);
            if (entry.agent_id) latestBubble = entry;
          }
          if (t) rememberMindSeen(t);
        }
        for (const th of thinksToShow.slice(-4)) {
          logLine(th.who, th.text);
        }
        // Apply latest known mind mood onto agents if present
        const minds = data?.agents || {};
        for (const [aid, m] of Object.entries(minds)) {
          const st = agentState.find((a) => a.def.id === aid);
          if (!st || !m) continue;
          if (m.mood) st.persona.mood = m.mood;
          if (typeof m.energy === "number") st.energyNow = m.energy;
          if (m.last_line && announce && !latestBubble && m.last_spoke_at > mindLastSeen - 1) {
            latestBubble = { agent_id: aid, text: m.last_line, speaker: m.name || aid };
          }
        }
        // Don't dump a run-tally of conversations into the 3D view — silent catch-up only
        // (at most one latest bubble if something is very recent and announce is on)
        if (announce && latestBubble?.agent_id && latestBubble?.text && !activeBubbles.length) {
          showSpeech3d(latestBubble.agent_id, latestBubble.text, speechReadMs(latestBubble.text));
        }
        // No toast tally like "12 said something · 8 mind-drifts" — that was clutter
        if (data?.server_time) rememberMindSeen(Number(data.server_time));
      } catch (err) {
        console.warn("camp minds sync", err);
      } finally {
        mindSyncBusy = false;
      }
    }

    // Mind sync with bubbles — server may have spoken while you looked away
    setTimeout(() => syncCampMinds({ announce: true, full: !mindLastSeen }), 2800);
    setInterval(() => {
      if (document.hidden) return;
      syncCampMinds({ announce: true, full: false });
    }, 28000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) syncCampMinds({ announce: true, full: false });
    });

    // 2D parity feature dock (shop, TV, club… · music skipped when hub=1)
    let featureApi = null;
    try {
      featureApi = campFeatures.mountCampFeatures({
        campClient,
        catalog,
        logLine,
        showToast,
        showSpeech: showSpeech3d,
        onSummonAgents: summonAgentIds,
        onConjureUnknown: () => conjureMysteriousUnknown3d(),
        onHush: () => toggleHush3d(),
        onStereoMusic: () => featureApi?.playMusic?.(),
        onShopBuy: (item, res) => {
          // Purchase → carry it (emoji follows you) · same happy shop energy as 2D
          const bought = {
            id: item?.id || res?.item?.id,
            name: item?.name || res?.item?.name || "goodie",
            emoji: item?.emoji || res?.item?.emoji || "✨",
          };
          if (!inventory3d.find((x) => x.id === bought.id)) inventory3d.push(bought);
          setCarriedItem(bought);
          showToast(`Carrying ${bought.emoji} ${bought.name} · press X to drop`);
          logLine("Shop", `You bought ${bought.emoji} ${bought.name} and took it with you.`);
          // Cheer nearby agents a bit
          try {
            agentState.forEach((st) => {
              if (st?.persona) {
                st.persona.joy = Math.min(99, (st.persona.joy || 50) + 4);
                st.persona.mood = "happy";
              }
            });
          } catch (_) {}
        },
      });
    } catch (err) {
      console.warn("features dock failed", err);
    }

    {
      const nToys = propMeshes.length;
      const nSeats = seatMeshes.length;
      const nAgents = agentState.length;
      const nDaily = (catalog.daily_rotation?.added || []).length;
      logLine("Camp", `Town ready · ${nToys} toys · ${nSeats} seats · ${nAgents} agents${nDaily ? ` (${nDaily} daily visitors)` : ""}.`);
      setBootStep(`Town ready · ${nAgents} agents`);
      setTimeout(() => {
        try {
          const day = catalog.daily_rotation?.day || "";
          showToast(`✦ Luna Town · ${nAgents} souls · ${nDaily ? nDaily + " daily · " : ""}stroll`);
        } catch (_) {}
      }, 450);
    }
    // Drop boot card ASAP — do not wait on character GLB upgrades
    requestAnimationFrame(() => {
      requestAnimationFrame(() => finishBoot(true));
    });
    // Belt + suspenders
    setTimeout(() => finishBoot(true), 400);

    // Upgrade to free GLB characters (2–3 at a time so meadow fills faster)
    // Telephantix (you) first so you're visible + chat-ready ASAP
    if (charSystem) {
      const upgradeOrder = [...agentState].sort((a, b) => {
        const score = (st) => (st?.id === "telephantix" ? 0 : st?.id === "luna" ? 1 : 2);
        return score(a) - score(b);
      });
      let i = 0;
      const CONCURRENT = 3;
      const upgradeNext = () => {
        if (document.hidden) {
          setTimeout(upgradeNext, 600);
          return;
        }
        if (i >= upgradeOrder.length) {
          showToast("🎭 Characters upgraded · Telephantix ready");
          return;
        }
        const batch = [];
        for (let n = 0; n < CONCURRENT && i < upgradeOrder.length; n++, i++) {
          const st = upgradeOrder[i];
          batch.push(st._upgradeChar ? st._upgradeChar() : Promise.resolve());
        }
        Promise.allSettled(batch).finally(() => setTimeout(upgradeNext, 120));
      };
      // Immediate upgrade for you (don't wait 1.2s)
      const you = agentState.find((st) => st.id === "telephantix");
      if (you?._upgradeChar) {
        you._upgradeChar().then(() => {
          try {
            if (you.mesh) {
              // Nudge camera toward you near the fire
              if (typeof controls !== "undefined" && controls?.target && you.mesh.position) {
                controls.target.lerp(you.mesh.position, 0.65);
              }
            }
            setTalkWho("telephantix");
            showToast("✨ Telephantix is here — talk to them");
          } catch (_) {}
        }).catch((e) => console.warn("[camp3d] telephantix mesh", e));
      }
      setTimeout(upgradeNext, 400);
    }

    /**
     * Face a world XZ point.
     * Agent "nose" is +Z after GLB bake (skinned meshes get +Math.PI on clone so
     * Mixamo/Soldier walk clips advance along that nose). Never use Object3D.lookAt
     * (that aims -Z and moonwalks against walk anims).
     */
    function yawTowardDelta(dx, dz, faceYaw = 0) {
      if (dx * dx + dz * dz < 1e-8) return null;
      // atan2(x,z): local +Z points along (dx,dz)
      return Math.atan2(dx, dz) + faceYaw;
    }
    function faceTowardXZ(obj, x, z, faceYaw = 0, snap = true) {
      if (!obj) return;
      const dx = x - obj.position.x;
      const dz = z - obj.position.z;
      const want = yawTowardDelta(dx, dz, faceYaw);
      if (want == null) return;
      if (snap) {
        obj.rotation.y = want;
        return;
      }
      let cur = obj.rotation.y;
      let dAng = want - cur;
      while (dAng > Math.PI) dAng -= Math.PI * 2;
      while (dAng < -Math.PI) dAng += Math.PI * 2;
      obj.rotation.y = cur + dAng * 0.35;
    }
    function faceVelocityXZ(obj, vx, vz, faceYaw = 0, turnRate = 14, dt = 0.016) {
      if (!obj) return;
      const want = yawTowardDelta(vx, vz, faceYaw);
      if (want == null) return;
      let cur = obj.rotation.y;
      let dAng = want - cur;
      while (dAng > Math.PI) dAng -= Math.PI * 2;
      while (dAng < -Math.PI) dAng += Math.PI * 2;
      obj.rotation.y = cur + dAng * Math.min(1, turnRate * dt);
    }

    // Animate — CRITICAL: getDelta BEFORE getElapsedTime (else dt≈0 and nobody walks)
    const clock = new THREE.Clock();
    let _moveDebugT = 0;
    function animate() {
      requestAnimationFrame(animate);
      try {
        const dt = Math.min(Math.max(clock.getDelta(), 0), 0.05);
        const t = clock.elapsedTime;

        // Sticky video floor — keep decoder alive, force texture refresh
        try {
          if (groundVideoEl && groundVideoTex) {
            if (!document.hidden && groundVideoEl.paused && groundVideoEl.readyState >= 2) {
              if (performance.now() - (groundVideoLastKeepAlive || 0) > 1500) {
                groundVideoLastKeepAlive = performance.now();
                groundVideoEl.muted = true;
                groundVideoEl.defaultMuted = true;
                groundVideoEl.volume = 0;
                groundVideoEl.play().catch(() => {});
              }
            }
            // If loop stalled near end, wrap early
            if (
              groundVideoEl.duration &&
              Number.isFinite(groundVideoEl.duration) &&
              groundVideoEl.currentTime > groundVideoEl.duration - 0.15
            ) {
              try { groundVideoEl.currentTime = 0.01; } catch (_) {}
            }
            groundVideoTex.needsUpdate = true;
            if (groundFloorMesh && !groundFloorMesh.visible) groundFloorMesh.visible = true;
          }
        } catch (_) {}

        // Mjolnir flight physics
        try { updateMjolnirFlight(dt); } catch (_) {}
        // T-Rex firmament whim flight
        try { updateTrexFirmamentFlight(dt); } catch (_) {}

        // Living fire + aurora sky + fireflies (2D energy)
        fireLight.intensity = 3.2 + Math.sin(t * 7) * 0.85 + Math.sin(t * 13) * 0.4;
        fireLight.position.y = 1.45 + Math.sin(t * 11) * 0.08;
        if (typeof fireGlow !== "undefined" && fireGlow) {
          fireGlow.intensity = 1.1 + Math.sin(t * 9) * 0.45;
        }
        if (typeof accentA !== "undefined" && accentA) {
          accentA.intensity = 0.7 + Math.sin(t * 0.7) * 0.25;
          accentB.intensity = 0.6 + Math.cos(t * 0.55) * 0.22;
          accentC.intensity = 0.55 + Math.sin(t * 0.4 + 1) * 0.2;
        }
        if (skyMat?.uniforms?.uTime) skyMat.uniforms.uTime.value = t;
        const flame = campfire.getObjectByName("flame");
        if (flame) {
          flame.scale.y = 1 + Math.sin(t * 9) * 0.18;
          flame.scale.x = 1 + Math.sin(t * 11) * 0.08;
          flame.rotation.y = t * 1.1;
          if (flame.material?.emissiveIntensity != null) {
            flame.material.emissiveIntensity = 1.8 + Math.sin(t * 12) * 0.5;
          }
        }
        const flame2 = campfire.getObjectByName("flame2");
        if (flame2) {
          flame2.scale.y = 1 + Math.cos(t * 11) * 0.22;
          flame2.rotation.y = -t * 1.4;
          flame2.position.y = 0.8 + Math.sin(t * 8) * 0.06;
        }
        const heat = campfire.getObjectByName("heatDisc");
        if (heat?.material) {
          heat.material.opacity = 0.16 + Math.sin(t * 5) * 0.08;
          heat.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
        }
        const pathGlow = scene.getObjectByName("pathGlow");
        if (pathGlow?.material) {
          pathGlow.material.opacity = 0.28 + Math.sin(t * 2.2) * 0.12;
        }
        if (fireflies) {
          const arr = fireflies.geometry.attributes.position.array;
          const phases = fireflies.geometry.attributes.aPhase?.array;
          for (let i = 0; i < arr.length / 3; i++) {
            const ph = phases ? phases[i] : i;
            arr[i * 3 + 1] += Math.sin(t * 1.8 + ph) * 0.004;
            arr[i * 3] += Math.cos(t * 0.6 + ph) * 0.003;
            arr[i * 3 + 2] += Math.sin(t * 0.5 + ph * 1.3) * 0.003;
            // soft bounce bounds around meadow
            if (arr[i * 3 + 1] < 0.25) arr[i * 3 + 1] = 0.25;
            if (arr[i * 3 + 1] > 5.5) arr[i * 3 + 1] = 5.5;
          }
          fireflies.geometry.attributes.position.needsUpdate = true;
          fireflies.material.opacity = 0.75 + Math.sin(t * 2) * 0.2;
        }

        // E-prompt for nearby doors / centers
        try { updateEnterPrompt(); } catch (_) {}

        // While inside a place, freeze outdoor stroll for visitor
        if (playerInsidePlace) {
          visitorTarget.copy(visitor.position);
        }

        // Agents — velocity physics, solid collision, flight, house enter/leave
        let movers = 0, sitters = 0, flyers = 0;
        for (const st of agentState) {
          const m = st.mesh;
          const pos = m.position;
          const tgt = st.target;
          if (!tgt) continue;
          if (st.vx == null) { st.vx = 0; st.vz = 0; st.vy = 0; }

          // Hidden indoors — no meadow movement
          if (st.insideHouse) {
            st.moving = false;
            st.vx = 0; st.vz = 0;
            continue;
          }

          const dx = tgt.x - pos.x;
          const dz = tgt.z - pos.z;
          const groundDist = Math.hypot(dx, dz);
          const wantY = st.flying || st.action === "fly" ? (tgt.y || st.flyHeight || 1.6) : 0;
          const dy = wantY - pos.y;
          const sitArrive = st.pendingSit ? SIT_ARRIVE_R : 0.14;
          // Arrive at flight waypoint → next whim node
          if (
            (st.flying || st.action === "fly") &&
            st.flyPath?.length &&
            groundDist < 1.5 &&
            Math.abs(dy) < 0.55
          ) {
            advanceFlyPath(st);
          }
          const moving = (groundDist > sitArrive || Math.abs(dy) > 0.08) && st.posture !== "sit";
          if (st.posture === "sit") sitters++;
          if (st.flying || pos.y > 0.35) flyers++;
          st.moving = moving;

          if (moving && dt > 0) {
            movers++;
            // Organic seek: arrival slowdown + gentle lateral sway
            let maxSp = (st.speed || 2.6) * (st.flying ? 1.35 : 1);
            if (st.flying && st.flyPathStyle === "dive") maxSp *= 1.25;
            if (st.flying && st.flyPathStyle === "spiral") maxSp *= 1.1;
            // Thor reclaiming Mjolnir — keep the run up until close
            const hammerRun =
              st.def?.id === "thor" &&
              st.propTarget === "mjolnir" &&
              st.pendingProp &&
              st.sprintToProp;
            if (hammerRun) maxSp = Math.max(maxSp, 5.2);
            if (groundDist < 3.5 && !hammerRun) maxSp *= 0.45 + 0.55 * (groundDist / 3.5); // ease in
            else if (hammerRun && groundDist < 2.2) maxSp *= 0.7 + 0.3 * (groundDist / 2.2);
            if (st.pendingSit) maxSp *= 0.85;
            const steer = st.flying ? 11 : (st.pendingSit ? 11 : (hammerRun ? 9.5 : 6.2));
            if (groundDist > 0.001) {
              const inv = 1 / groundDist;
              st.vx += dx * inv * steer * dt;
              st.vz += dz * inv * steer * dt;
              // Air bank noise — whim, not pure robot
              if (st.flying) {
                const bank = Math.sin(t * 1.4 + st.phase) * 2.4 * dt;
                st.vx += (-dz * inv) * bank;
                st.vz += (dx * inv) * bank;
              } else if (!st.pendingSit) {
                const sway = Math.sin(t * 1.7 + st.phase) * 1.8 * dt;
                st.vx += (-dz * inv) * sway;
                st.vz += (dx * inv) * sway;
              }
            }
            // Soft separation (skip while claiming a seat)
            if (!st.ignoreAgentPush && !st.pendingSit) {
              for (const other of agentState) {
                if (other === st || other.insideHouse || other.posture === "sit") continue;
                const ox = pos.x - other.mesh.position.x;
                const oz = pos.z - other.mesh.position.z;
                const od = Math.hypot(ox, oz);
                if (od > 0.01 && od < AGENT_COLLIDE_R * 2.4) {
                  const push = (AGENT_COLLIDE_R * 2.4 - od) * 3.2 * dt;
                  st.vx += (ox / od) * push;
                  st.vz += (oz / od) * push;
                }
              }
            }
            // Damping + speed clamp
            const damp = Math.pow(st.pendingSit ? 0.82 : 0.88, dt * 60);
            st.vx *= damp;
            st.vz *= damp;
            const spH = Math.hypot(st.vx, st.vz);
            if (spH > maxSp) {
              st.vx = (st.vx / spH) * maxSp;
              st.vz = (st.vz / spH) * maxSp;
            }
            pos.x += st.vx * dt;
            pos.z += st.vz * dt;
            // Solid buildings — softer radius when approaching seats/props
            if (!st.flying || pos.y < 1.6) {
              const allow =
                (st.housePhase === "approach" || st.housePhase === "exit")
                  ? st.homeTarget
                  : null;
              const rad = st.pendingSit || st.pendingProp ? AGENT_COLLIDE_R * 0.55 : AGENT_COLLIDE_R;
              const solid = resolveSolidXZ(pos.x, pos.z, rad, {
                allowHouseId: allow,
                fly: !!(st.flying && pos.y > 2.0),
                skipLandmarks: !!(st.pendingSit || st.pendingProp),
              });
              if (solid.hit) {
                pos.x = solid.x;
                pos.z = solid.z;
                st.vx *= 0.4;
                st.vz *= 0.4;
              }
            }
            // Vertical flight
            st.vy += dy * 6 * dt;
            st.vy *= Math.pow(0.9, dt * 60);
            pos.y += st.vy * dt;
            if (!st.flying && st.action !== "fly") {
              // settle to ground
              pos.y += (0 - pos.y) * Math.min(1, 4 * dt);
              if (pos.y < 0.05) { pos.y = 0; st.vy = 0; }
              m.rotation.x = THREE.MathUtils.lerp(m.rotation.x || 0, 0, Math.min(1, 5 * dt));
            } else {
              // gentle hover bob while airborne (higher ceiling under open firmament)
              pos.y += Math.sin(t * 2.4 + st.phase) * 0.018;
              const ceil = firmamentOpen3d ? 6.8 : 4.2;
              pos.y = Math.max(0.35, Math.min(ceil, pos.y));
              // Pitch slightly into climbs/dives
              m.rotation.x = THREE.MathUtils.lerp(
                m.rotation.x || 0,
                THREE.MathUtils.clamp(-dy * 0.05, -0.4, 0.4),
                Math.min(1, 4 * dt),
              );
            }
            // Soft rectangular bounds only — no circular “invisible wall” pen
            const HALF = FIELD * 0.98;
            if (pos.x > HALF || pos.x < -HALF) {
              pos.x = THREE.MathUtils.clamp(pos.x, -HALF, HALF);
              st.vx *= -0.35;
            }
            if (pos.z > HALF || pos.z < -HALF) {
              pos.z = THREE.MathUtils.clamp(pos.z, -HALF, HALF);
              st.vz *= -0.35;
            }
            // Face velocity so walk clips go the way the body moves (not moonwalk)
            if (spH > 0.08) {
              const turn = buzzActive(st)?.kind === "drunk" ? 7 : 14;
              faceVelocityXZ(m, st.vx, st.vz, st.faceYaw || 0, turn, dt);
            }
            // Buzz body sway (drunk lean / stoned bob)
            {
              const b = buzzActive(st);
              if (b && st.posture !== "sit") {
                const amp = 0.04 + b.level * 0.035;
                if (b.kind === "drunk") {
                  m.rotation.z = Math.sin(t * 3.2 + st.phase) * amp;
                  m.rotation.x = Math.sin(t * 2.1 + st.phase) * amp * 0.5;
                } else {
                  m.rotation.z = Math.sin(t * 1.1 + st.phase) * amp * 0.7;
                  pos.y += Math.sin(t * 1.4 + st.phase) * 0.012 * b.level;
                }
              } else if (st.posture !== "sit") {
                m.rotation.z *= 0.85;
              }
            }
            // Mid-flight whim (rare) — only with Firmament open
            if (firmamentOpen3d && st.canFly && st.flying && Math.random() < 0.0015) {
              pickRoamTarget(st, { fly: true });
            }
          } else if (st.pendingSit && groundDist <= SIT_ARRIVE_R) {
            if (st.sitPhase === "approach" && st.sitTarget) {
              st.target.copy(st.sitTarget);
              st.sitPhase = "seat";
              st.moving = true;
            } else {
              arriveSit(st);
            }
          } else if (!moving && st.posture !== "sit") {
            // idle settle / hover
            st.vx *= 0.9;
            st.vz *= 0.9;
            if (st.flying) {
              pos.y += Math.sin(t * 2.1 + st.phase) * 0.018;
            } else {
              pos.y += (0 - pos.y) * Math.min(1, 5 * dt);
            }
          }

          // Character animations — 2D camp energy (bounce, talk hop, run, glow rings)
          const speaking = performance.now() < st.speakUntil;
          const spH = Math.hypot(st.vx || 0, st.vz || 0);
          // Walk default — old thresholds (6.5/7.5) never hit because max speed is ~3, so anim used wrong branch via other paths; keep run rare
          const running = moving && (spH > 3.6 || (st.speed || 0) > 3.4);
          const energyFeel = (st.energyNow || 0.7) * (st.persona?.pace || 1) * (st.persona?.energy || 0.7 + 0.3);
          if (st.char) {
            const want = st.posture === "sit"
              ? "sit"
              : (speaking && !moving ? "talk" : (moving || st.flying ? (running ? "run" : "walk") : "idle"));
            if (st.animState !== want) {
              st.animState = want;
              st.char.play?.(want);
            }
            if (st.char.update) {
              st.char.update(dt, {
                moving: moving || st.flying,
                sitting: st.posture === "sit",
                flying: st.flying,
                speaking,
                running,
                speed: spH || st.speed || 0,
                energy: energyFeel,
                phase: st.phase,
                t,
              });
            } else if (st.char.mixer) {
              st.char.mixer.update(dt);
            }
          } else if (st.limbs && st.placeholder?.visible !== false) {
            // Procedural walk cycle — punchy 2D-style limb energy
            const gaitHz = running ? 15 : (moving ? 12 : 2.4);
            const gait = Math.sin(t * gaitHz + st.phase);
            const amp = st.posture === "sit" ? 0 : (moving ? (running ? 0.85 : 0.68) : 0.12);
            const bounce = moving ? Math.abs(gait) * (running ? 0.09 : 0.055) : Math.sin(t * 2.4 + st.phase) * 0.02;
            st.limbs.Lleg.rotation.x = gait * amp;
            st.limbs.Rleg.rotation.x = -gait * amp;
            st.limbs.Larm.rotation.x = -gait * amp * 0.85;
            st.limbs.Rarm.rotation.x = gait * amp * 0.85;
            if (st.limbs.hips) {
              st.limbs.hips.position.y = 0.92 + bounce * 0.35;
              st.limbs.hips.rotation.z = moving ? gait * 0.06 : Math.sin(t * 1.4 + st.phase) * 0.03;
            }
            if (st.body) {
              st.body.position.y = 1.28 + bounce + (speaking ? Math.sin(t * 10 + st.phase) * 0.04 : 0);
              st.body.rotation.z = moving ? gait * 0.05 : Math.sin(t * 1.3 + st.phase) * 0.025;
              st.body.rotation.x = moving ? (running ? 0.1 : 0.06) : Math.sin(t * 1.6 + st.phase) * 0.02;
              if (st.body.material) {
                st.body.material.emissiveIntensity = speaking
                  ? 0.55 + Math.sin(t * 14) * 0.22
                  : (moving ? 0.28 + Math.abs(gait) * 0.08 : 0.16 + Math.sin(t * 2.2 + st.phase) * 0.05);
              }
            }
            if (st.head) {
              st.head.position.y = 1.72 + bounce * 0.6 + (speaking ? Math.sin(t * 10 + st.phase) * 0.035 : 0);
              st.head.rotation.x = speaking
                ? Math.sin(t * 9 + st.phase) * 0.12
                : Math.sin(t * 1.8 + st.phase) * 0.04;
              st.head.rotation.z = speaking ? Math.sin(t * 7 + st.phase) * 0.05 : 0;
              if (st.head.material?.emissiveIntensity != null) {
                st.head.material.emissiveIntensity = speaking
                  ? 0.35 + Math.sin(t * 12) * 0.2
                  : 0.06;
              }
            }
            if (st.posture === "sit" && st.placeholder) {
              st.placeholder.position.y = -0.28;
              st.limbs.Lleg.rotation.x = -1.1;
              st.limbs.Rleg.rotation.x = -1.1;
            } else if (st.placeholder) {
              st.placeholder.position.y = bounce * 0.5;
            }
          }
          // 2D speak rings + label hop
          {
            const ring = m.getObjectByName("speakRing");
            const ring2 = m.getObjectByName("speakRing2");
            const label = m.getObjectByName("label");
            if (speaking) {
              const pulse = 0.55 + Math.sin(t * 7 + st.phase) * 0.3;
              if (ring?.material) {
                ring.material.opacity = pulse;
                ring.scale.setScalar(1 + Math.sin(t * 7 + st.phase) * 0.12);
              }
              if (ring2?.material) {
                ring2.material.opacity = 0.28 + Math.sin(t * 7 + st.phase) * 0.18;
                ring2.scale.setScalar(1.05 + Math.sin(t * 5.5 + st.phase) * 0.1);
              }
              if (label) {
                label.position.y = 2.25 + Math.sin(t * 10 + st.phase) * 0.08;
                label.scale.setScalar(1 + Math.sin(t * 8) * 0.05);
              }
            } else {
              if (ring?.material) ring.material.opacity *= 0.85;
              if (ring2?.material) ring2.material.opacity *= 0.85;
              if (label) {
                const baseY = st.posture === "sit" ? 1.75 : 2.25;
                label.position.y += (baseY - label.position.y) * Math.min(1, 6 * dt);
                label.scale.setScalar(1 + (moving ? Math.sin(t * 12 + st.phase) * 0.02 : 0));
              }
            }
            // Feet contact glow — more alive when moving
            const feetMesh = m.getObjectByName("feet");
            if (feetMesh?.material) {
              feetMesh.material.opacity = moving
                ? 0.28 + Math.abs(Math.sin(t * (running ? 15 : 12) + st.phase)) * 0.22
                : (speaking ? 0.4 + Math.sin(t * 8) * 0.15 : 0.28);
            }
          }
          if (st.look && st.look.glow > 0.22 && Math.random() < 0.002) {
            st.look.glow = Math.max(0.2, st.look.glow - 0.02);
            applyLook(st);
          }
        }
        // Hard agent↔agent + final building snap
        resolveAgentPairs();

        _moveDebugT += dt;
        if (_moveDebugT > 5) {
          _moveDebugT = 0;
          statusEl.dataset.movers = String(movers);
          statusEl.dataset.sitters = String(sitters);
        }

        // Visitor: click-to-move target + optional WASD + solid collision
        {
          let mx = 0, mz = 0;
          if (keys.w) mz -= 1;
          if (keys.s) mz += 1;
          if (keys.a) mx -= 1;
          if (keys.d) mx += 1;
          if (mx || mz) {
            const e = new THREE.Euler(0, controls.getAzimuthalAngle(), 0, "YXZ");
            const forward = new THREE.Vector3(0, 0, -1).applyEuler(e);
            const right = new THREE.Vector3(1, 0, 0).applyEuler(e);
            forward.y = 0; right.y = 0;
            forward.normalize(); right.normalize();
            visitorTarget.addScaledVector(forward, -mz * 9 * dt);
            visitorTarget.addScaledVector(right, mx * 9 * dt);
            visitorTarget.x = THREE.MathUtils.clamp(visitorTarget.x, -FIELD, FIELD);
            visitorTarget.z = THREE.MathUtils.clamp(visitorTarget.z, -FIELD, FIELD);
            // Don't path into buildings
            const vt = resolveSolidXZ(visitorTarget.x, visitorTarget.z, VISITOR_COLLIDE_R, {});
            visitorTarget.x = vt.x;
            visitorTarget.z = vt.z;
            groundMarker.position.set(visitorTarget.x, 0.05, visitorTarget.z);
            groundMarker.visible = true;
          }
          const vdx = visitorTarget.x - visitor.position.x;
          const vdz = visitorTarget.z - visitor.position.z;
          const vd = Math.hypot(vdx, vdz);
          if (vd > 0.06) {
            const vb = visitorBuzzActive();
            const spMul = vb?.kind === "drunk" ? 0.72 : vb?.kind === "stoned" ? 0.8 : 1;
            const sp = 8.5 * spMul * dt;
            visitor.position.x += (vdx / vd) * Math.min(sp, vd);
            visitor.position.z += (vdz / vd) * Math.min(sp, vd);
            // Buildings block you
            const vs = resolveSolidXZ(visitor.position.x, visitor.position.z, VISITOR_COLLIDE_R, {});
            visitor.position.x = vs.x;
            visitor.position.z = vs.z;
            // Soft body vs agents
            for (const st of agentState) {
              if (st.insideHouse || !st.mesh.visible) continue;
              const ax = visitor.position.x - st.mesh.position.x;
              const az = visitor.position.z - st.mesh.position.z;
              const ad = Math.hypot(ax, az);
              const minD = VISITOR_COLLIDE_R + AGENT_COLLIDE_R;
              if (ad > 0.01 && ad < minD) {
                const push = (minD - ad);
                visitor.position.x += (ax / ad) * push * 0.65;
                visitor.position.z += (az / ad) * push * 0.65;
                st.mesh.position.x -= (ax / ad) * push * 0.35;
                st.mesh.position.z -= (az / ad) * push * 0.35;
              }
            }
            // Same +Z-forward convention as agents (no moonwalk)
            // Same +Z nose convention as agents (placeholder body faces +Z)
            visitor.rotation.y = Math.atan2(vdx, vdz);
          } else if (groundMarker.visible && vd < 0.08) {
            groundMarker.visible = false;
          }
          // Visitor buzz sway
          {
            const vb = visitorBuzzActive();
            if (vb) {
              const amp = 0.05 + vb.level * 0.03;
              visitor.rotation.z = Math.sin(t * (vb.kind === "drunk" ? 3.5 : 1.2)) * amp;
            } else {
              visitor.rotation.z *= 0.9;
            }
          }
          // Follow mode (default ON): camera target tracks you; orbit/zoom still work
          if (followPlayer) {
            const look = controls.target;
            const lx = visitor.position.x - look.x;
            const lz = visitor.position.z - look.z;
            const k = Math.min(1, 3.2 * dt);
            look.x += lx * k;
            look.z += lz * k;
            look.y = 1.15;
            // Slide camera with you so zoom distance stays stable
            camera.position.x += lx * k;
            camera.position.z += lz * k;
          }
        }

        // Ease zoom toward goal — stop anywhere between near and far
        if (zoomGoal != null && controls.enabled) {
          const cur = camRadius();
          const goal = THREE.MathUtils.clamp(zoomGoal, ZOOM_MIN, ZOOM_MAX);
          const next = cur + (goal - cur) * Math.min(1, 10 * dt);
          if (Math.abs(next - goal) < 0.04) {
            setCamRadius(goal);
            zoomGoal = goal; // hold at settled intermediate level
          } else {
            setCamRadius(next);
          }
        }

        // Marker pulse
        if (groundMarker.visible) {
          const s = 1 + Math.sin(t * 6) * 0.15;
          groundMarker.scale.set(s, s, s);
        }

        // Prop life — procedural bob + free GLB mixers / spin / T-Rex walk
        for (let i = 0; i < propMeshes.length; i++) {
          const g = propMeshes[i];
          // Mjolnir: no bob when flying/carried; soft aura pulse on ground
          if (g.userData?.mjolnir || g.userData?.id === "mjolnir") {
            if (mjolnirState.flying) continue;
            if (mjolnirState.ownerId === "thor") continue; // parented to Thor
            const aura = g.getObjectByName("mjolnirAura");
            if (aura?.material) {
              aura.material.opacity = 0.35 + Math.sin(t * 3.2) * 0.18;
              aura.rotation.z = t * 0.6;
            }
            g.position.y = 0.02 + Math.sin(t * 2.1) * 0.012;
            continue;
          }
          const phase = (g.userData.propBob || 0) + i * 0.7;
          if (propSystem?.updateProp) {
            try { propSystem.updateProp(g, dt, t); } catch (_) {}
          } else {
            if (g.userData.mixer) {
              try { g.userData.mixer.update(dt); } catch (_) {}
            }
            if (g.userData.spin) {
              g.rotation.y += dt * 0.4;
              g.position.y = Math.sin(t * 1.4 + phase) * 0.06;
            } else if (!g.userData.glb && !g.userData.trex) {
              g.position.y = Math.sin(t * 1.4 + phase) * 0.018;
            }
          }
          if (g.userData.trex) {
            // Firmament flight handled in updateTrexFirmamentFlight
            if (g.userData.flying && firmamentOpen3d) {
              continue;
            }
            // T-Rex runs the meadow hard — long sprints, chase, roar
            if (!g.userData.homeX) {
              g.userData.homeX = g.position.x;
              g.userData.homeZ = g.position.z;
              g.userData.tvx = 0;
              g.userData.tvz = 0;
            }
            const meadowR = FIELD * 0.7;
            const needTarget =
              !g.userData.tx ||
              Math.hypot(g.position.x - g.userData.tx, g.position.z - g.userData.tz) < 1.8 ||
              (g.userData.nextWaypointAt && performance.now() > g.userData.nextWaypointAt);
            if (needTarget) {
              const a = Math.random() * Math.PI * 2;
              // Wide run radius — cross-meadow patrols
              const r = 12 + Math.random() * 38;
              let nx = Math.cos(a) * r;
              let nz = Math.sin(a) * r;
              const chaseRoll = Math.random();
              if (chaseRoll < 0.12) {
                nx = (Math.random() - 0.5) * 8;
                nz = (Math.random() - 0.5) * 8;
              } else if (chaseRoll < 0.38 && typeof visitor !== "undefined" && visitor) {
                nx = visitor.position.x + (Math.random() - 0.5) * 7;
                nz = visitor.position.z + (Math.random() - 0.5) * 7;
              } else if (chaseRoll < 0.62 && agentState.length) {
                const prey = agentState[Math.floor(Math.random() * agentState.length)];
                nx = prey.mesh.position.x + (Math.random() - 0.5) * 5;
                nz = prey.mesh.position.z + (Math.random() - 0.5) * 5;
              }
              const d0 = Math.hypot(nx, nz);
              if (d0 > meadowR) {
                nx = (nx / d0) * meadowR;
                nz = (nz / d0) * meadowR;
              }
              g.userData.tx = nx;
              g.userData.tz = nz;
              g.userData.sprint = Math.random() < 0.72; // usually running
              g.userData.nextWaypointAt = performance.now() + 2200 + Math.random() * 4200;
              if (Math.random() < 0.35) {
                g.userData.roarUntil = performance.now() + 1600;
              }
            }
            const tdx = (g.userData.tx || 0) - g.position.x;
            const tdz = (g.userData.tz || 0) - g.position.z;
            const td = Math.hypot(tdx, tdz) || 1;
            // Movement speed separate from leg gait (walkSpeed is animation only)
            const baseSp = g.userData.sprint ? 11.5 : 6.8;
            const roarBoost = performance.now() < (g.userData.roarUntil || 0) ? 1.4 : 1;
            const sp = baseSp * roarBoost;
            g.userData.tvx = (g.userData.tvx || 0) * 0.86 + (tdx / td) * sp * 0.28;
            g.userData.tvz = (g.userData.tvz || 0) * 0.86 + (tdz / td) * sp * 0.28;
            const vH = Math.hypot(g.userData.tvx, g.userData.tvz);
            if (vH > sp) {
              g.userData.tvx = (g.userData.tvx / vH) * sp;
              g.userData.tvz = (g.userData.tvz / vH) * sp;
            }
            g.position.x += g.userData.tvx * dt;
            g.position.z += g.userData.tvz * dt;
            // T-Rex doesn't phase through houses
            {
              const solid = resolveSolidXZ(g.position.x, g.position.z, 1.1, {});
              if (solid.hit) {
                g.position.x = solid.x;
                g.position.z = solid.z;
                g.userData.tvx *= -0.6;
                g.userData.tvz *= -0.6;
                g.userData.tx = undefined;
              }
            }
            // Soft push off agents (big dino)
            for (const st of agentState) {
              if (st.insideHouse) continue;
              const ax = g.position.x - st.mesh.position.x;
              const az = g.position.z - st.mesh.position.z;
              const ad = Math.hypot(ax, az);
              const minD = 1.35;
              if (ad > 0.01 && ad < minD) {
                const push = (minD - ad) * 0.7;
                g.position.x += (ax / ad) * push * 0.4;
                g.position.z += (az / ad) * push * 0.4;
                st.mesh.position.x -= (ax / ad) * push * 0.6;
                st.mesh.position.z -= (az / ad) * push * 0.6;
              }
            }
            const rd = Math.hypot(g.position.x, g.position.z);
            if (rd > meadowR) {
              g.position.x = (g.position.x / rd) * meadowR;
              g.position.z = (g.position.z / rd) * meadowR;
              g.userData.tvx *= -0.55;
              g.userData.tvz *= -0.55;
              g.userData.tx = undefined;
            }
            if (vH > 0.15) {
              // +Z = nose (mesh reoriented). faceYaw only for odd GLBs.
              const fy = Number(g.userData.faceYaw) || 0;
              const want = Math.atan2(g.userData.tvx, g.userData.tvz) + fy;
              let cur = g.rotation.y;
              let dAng = want - cur;
              while (dAng > Math.PI) dAng -= Math.PI * 2;
              while (dAng < -Math.PI) dAng += Math.PI * 2;
              g.rotation.y = cur + dAng * Math.min(1, 12 * dt);
            }
            // Leg cycle for animation only
            g.userData.walkSpeed = g.userData.sprint ? 3.1 : 2.0;
          }
          // Interaction pulse ring (children RingGeometry)
          if (g.userData.pulseUntil && performance.now() < g.userData.pulseUntil) {
            g.traverse((o) => {
              if (o.isMesh && o.geometry?.type === "RingGeometry" && o.material) {
                o.material.opacity = 0.55 + Math.sin(t * 10) * 0.35;
                o.scale.setScalar(1 + Math.sin(t * 8) * 0.12);
              }
            });
          }
          if (g.userData.planchette) {
            g.userData.planchette.position.x = Math.sin(t * 0.8 + phase) * 0.12;
            g.userData.planchette.position.z = Math.cos(t * 0.65 + phase) * 0.08;
          }
          if (g.userData.screen?.material) {
            g.userData.screen.material.emissiveIntensity = 0.35 + Math.sin(t * 4 + phase) * 0.2;
          }
          if (g.userData.hot) {
            g.position.y += Math.sin(t * 8 + phase) * 0.01;
          }
        }

        // Mysterious Unknown entities — float, spin, expire
        for (let i = unknownEntities3d.length - 1; i >= 0; i--) {
          const u = unknownEntities3d[i];
          const age = performance.now() - u.born;
          if (performance.now() > u.until) {
            scene.remove(u.mesh);
            unknownEntities3d.splice(i, 1);
            continue;
          }
          u.mesh.position.y = 0.9 + Math.sin(t * 2.2 + u.phase) * 0.18;
          if (u.core) u.core.rotation.y = t * 1.4 + u.phase;
          if (u.ring) {
            u.ring.rotation.z = t * 0.8;
            u.ring.scale.setScalar(1 + Math.sin(t * 3 + u.phase) * 0.08);
          }
          // Fade near end
          const left = u.until - performance.now();
          if (left < 8000 && u.core?.material) {
            u.core.material.opacity = Math.max(0.15, left / 8000);
          }
        }

        controls.update();
        // If touch-pinch / middle-mouse dolly moved us, adopt that as the new zoom goal
        {
          const rNow = camRadius();
          if (Math.abs(rNow - zoomGoal) > 1.25) zoomGoal = rNow;
        }
        updateBubbles();
        renderer.render(scene, camera);
      } catch (err) {
        console.error(err);
      }
    }
    animate();

    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  