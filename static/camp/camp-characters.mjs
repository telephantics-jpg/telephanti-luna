/**
 * Free character embeds for Luna 3D camp — GLB humanoids + animation.
 * Sources (free for this use):
 *  - static/avatars/brunette.glb (Luna / feminine cast)
 *  - three.js Soldier / Xbot / RobotExpressive (MIT)
 *
 * When a mesh has few clips (e.g. brunette), we still drive lifelike
 * root sway / bob / lean so they never look frozen.
 * Motion energy aims at the 2D camp feel: bouncey walk, talk hop, glow pulse.
 */

const CHAR_BASE = "/static/avatars/characters";
const LUNA_GLB = "/static/avatars/brunette.glb";
const XBOT = `${CHAR_BASE}/xbot.glb`;
const SOLDIER = `${CHAR_BASE}/soldier.glb`;
const ROBOT = `${CHAR_BASE}/robot.glb`;

/**
 * Prefer specific models per agent — free Three.js / Mixamo-style GLBs.
 * Drop more .glb files in static/avatars/characters/ and map them here
 * (or set visual.glb on the catalog agent).
 */
export const MODEL_FOR_AGENT = {
  // Feminine / luminous cast
  luna: LUNA_GLB,
  aurora: LUNA_GLB,
  violet: LUNA_GLB,
  seraph: LUNA_GLB,
  ambrosia: LUNA_GLB,
  rhea: LUNA_GLB,
  mika: LUNA_GLB,
  // Warriors / thunder / hall
  sentinel: ROBOT,
  thor: SOLDIER,
  zeus: SOLDIER,
  michael: SOLDIER,
  odin: SOLDIER,
  // Messengers / seers / healers — Xbot walk cycles
  hermes: XBOT,
  oracle: XBOT,
  caduceus: XBOT,
  jesus: XBOT,
  dionysus: XBOT,
  gabriel: XBOT,
  raphael: XBOT,
  uriel: XBOT,
  ara: XBOT,
  // Extra ids (heaven / future summons)
  wanderer: XBOT,
  // Custom guest GLBs (drop files in static/avatars/characters/)
  // Telephantix = you (studio mesh → telephantix.glb)
  telephantix: `${CHAR_BASE}/telephantix.glb`,
  stood: `${CHAR_BASE}/telephantix.glb`, // alias → same mesh
  // Telephanthantim = D4 gold armor (Meshy export)
  telephanthantim: `${CHAR_BASE}/telephanthantim.glb`,
};

export function modelUrlForAgent(def) {
  // Always prefer explicit GLB path (you / guests) — strip nothing; keep ?v= cache bust
  if (def?.visual?.glb) return String(def.visual.glb);
  if (def?.id && MODEL_FOR_AGENT[def.id]) return MODEL_FOR_AGENT[def.id];
  const arch = String(def?.visual?.archetype || "").toLowerCase();
  const faction = String(def?.faction || def?.visual?.faction || "").toLowerCase();
  // Do NOT map telephantix/stood by archetype (that wrongly used Luna body)
  const id = String(def?.id || "").toLowerCase();
  if (id === "telephantix" || id === "stood") return `${CHAR_BASE}/telephantix.glb?v=you-wireframe-2`;
  // Daily town visitors by faction
  if (faction === "demon") return ROBOT;
  if (faction === "angel") return LUNA_GLB;
  if (faction === "god") return SOLDIER;
  if (faction === "clever") return XBOT;
  if (["moon_host", "lights", "reveler"].includes(arch)) return LUNA_GLB;
  if (["thunder", "guardian", "allfather"].includes(arch)) return SOLDIER;
  if (arch === "guardian" && def?.id === "sentinel") return ROBOT;
  return XBOT;
}

/**
 * @param {typeof import('three')} THREE
 * @param {import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader} GLTFLoader
 * @param {typeof import('three/examples/jsm/utils/SkeletonUtils.js')} SkeletonUtils
 */
export function createCharacterSystem(THREE, GLTFLoader, SkeletonUtils) {
  const loader = new GLTFLoader();
  const templates = new Map(); // url -> { scene, animations, height }

  async function loadTemplate(url) {
    if (templates.has(url)) return templates.get(url);
    const gltf = await loader.loadAsync(url);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const height = Math.max(size.y, 0.01);
    const entry = { gltf, height, animations: gltf.animations || [] };
    templates.set(url, entry);
    return entry;
  }

  function spawnFromTemplate(entry, def, colorHex) {
    const root = new THREE.Group();
    root.name = `char_${def.id}`;

    const clone = SkeletonUtils && SkeletonUtils.clone
      ? SkeletonUtils.clone(entry.gltf.scene)
      : entry.gltf.scene.clone(true);

    const idLow = String(def?.id || "").toLowerCase();
    // Custom photo / studio meshes: keep look faithful, fix ground + visibility
    const isCustomYou =
      idLow === "telephantix" ||
      idLow === "stood" ||
      String(def?.visual?.glb || "").includes("telephantix.glb") ||
      String(def?.visual?.glb || "").includes("stood.glb");

    const targetH = isCustomYou ? 1.85 : 1.72;
    const s = targetH / Math.max(entry.height, 0.01);
    clone.scale.setScalar(s);
    // Box is already in scaled space — do NOT multiply by s again (that buried/hid custom GLBs)
    const box = new THREE.Box3().setFromObject(clone);
    clone.position.y = -box.min.y;
    // Keep model local +Z as "forward" so walk clips match group facing.
    // (Math.PI here used to flip them — they moonwalked: feet one way, body the other.)
    clone.rotation.y = 0;
    clone.name = "skinned";

    const tint = new THREE.Color(colorHex || 0xcccccc);
    clone.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      o.visible = true;
      // Geometry color attribute → force vertexColors on (studio exports)
      const hasColorAttr = !!(o.geometry && o.geometry.attributes && o.geometry.attributes.color);
      if (!o.material) {
        o.material = new THREE.MeshStandardMaterial({
          color: isCustomYou ? 0xc4a494 : 0xcccccc,
          roughness: 0.65,
          metalness: 0.05,
          side: THREE.DoubleSide,
          vertexColors: hasColorAttr,
        });
        return;
      }
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const next = mats.map((m) => {
        const cm = m.clone();
        cm.side = THREE.DoubleSide;
        cm.visible = true;
        cm.transparent = false;
        cm.opacity = 1;
        cm.depthWrite = true;
        if (hasColorAttr || m.vertexColors) cm.vertexColors = true;
        if (isCustomYou) {
          // Real body mesh — no brand wash, readable on dark meadow
          if (cm.color) cm.color.setHex(0xffffff);
          if (cm.emissive) {
            cm.emissive.setHex(0x2a221c);
            cm.emissiveIntensity = 0.18;
          }
          if (cm.roughness != null) cm.roughness = 0.62;
          if (cm.metalness != null) cm.metalness = 0.02;
        } else {
          if (cm.color) {
            const base = cm.color.clone();
            cm.color = base.lerp(tint, 0.28);
          }
          if (cm.emissive) {
            cm.emissive = tint.clone().multiplyScalar(0.15);
            cm.emissiveIntensity = 0.06;
          }
          if (cm.roughness != null) cm.roughness = Math.min(0.92, Math.max(0.35, cm.roughness));
          if (cm.metalness != null) cm.metalness = Math.min(0.45, cm.metalness);
        }
        cm.envMapIntensity = cm.envMapIntensity != null ? cm.envMapIntensity : 0.85;
        cm.needsUpdate = true;
        return cm;
      });
      o.material = Array.isArray(o.material) ? next : next[0];
    });

    root.add(clone);

    let mixer = null;
    const actions = {};
    let current = "";
    let currentKind = "";

    if (entry.animations.length) {
      mixer = new THREE.AnimationMixer(clone);
      for (const clip of entry.animations) {
        const raw = clip.name || "clip";
        const low = raw.toLowerCase();
        const act = mixer.clipAction(clip);
        act.clampWhenFinished = false;
        actions[low] = act;
        actions[raw] = act;
        // strip mixamo prefixes for matching
        const short = low.replace(/^armature\|/, "").replace(/mixamo\.com\|?/g, "").replace(/\|/g, " ");
        actions[short] = act;
      }
    }

    function pickAction(kind) {
      const keys = Object.keys(actions);
      if (!keys.length) return null;
      const find = (...needles) =>
        keys.find((k) => needles.some((n) => k.toLowerCase().includes(n)));
      if (kind === "walk" || kind === "run") {
        return (
          find("walk", "walking", "run", "running", "jog", "trot") ||
          find("locomotion") ||
          keys[0]
        );
      }
      if (kind === "sit") {
        return find("sit", "sitting", "crouch", "idle") || keys[0];
      }
      if (kind === "dance" || kind === "talk") {
        return (
          find("talk", "speak", "wave", "gesture", "dance", "yes", "thumbs", "punch") ||
          find("idle", "stand") ||
          keys[0]
        );
      }
      // idle
      return (
        find("idle", "stand", "breath", "neutral", "tpose", "rest") ||
        keys[0]
      );
    }

    function play(kind, fade = 0.22) {
      if (!mixer) {
        currentKind = kind;
        return;
      }
      const key = pickAction(kind);
      if (!key) {
        currentKind = kind;
        return;
      }
      if (key === current && currentKind === kind) return;
      const next = actions[key];
      if (!next) return;
      if (current && actions[current] && actions[current] !== next) {
        actions[current].fadeOut(fade);
      }
      // Snappier than stock Mixamo — 2D camp energy
      const speed =
        kind === "run" ? 1.55 :
        kind === "walk" ? 1.32 :
        kind === "talk" || kind === "dance" ? 1.28 :
        0.95;
      next.reset()
        .setEffectiveTimeScale(speed)
        .setEffectiveWeight(1)
        .fadeIn(fade)
        .play();
      next.setLoop(THREE.LoopRepeat, Infinity);
      current = key;
      currentKind = kind;
    }

    if (mixer) play("idle", 0);

    function setTint(hex, glow = 0.1) {
      const c = new THREE.Color(hex);
      clone.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m.emissive) {
            m.emissive.copy(c).multiplyScalar(0.42);
            m.emissiveIntensity = glow;
          }
        }
      });
    }

    /**
     * Per-frame: mixer + 2D-camp energy (bounce, talk hop, glow).
     * @param {number} dt
     * @param {{ moving?: boolean, sitting?: boolean, flying?: boolean, speaking?: boolean, phase?: number, t?: number, speed?: number, running?: boolean, energy?: number }} state
     */
    function update(dt, state = {}) {
      const moving = !!state.moving;
      const sitting = !!state.sitting;
      const flying = !!state.flying;
      const speaking = !!state.speaking;
      const running = !!state.running || (moving && (state.speed || 0) > 3.5);
      const phase = state.phase || 0;
      const t = state.t || performance.now() * 0.001;
      const energy = Math.max(0.35, Math.min(1.35, state.energy != null ? state.energy : 0.85));
      const vel = Math.max(0, state.speed || 0);

      if (mixer) {
        mixer.update(dt);
        // Match clip cadence to real move speed (alive, not slideshow)
        if (current && actions[current] && (currentKind === "walk" || currentKind === "run")) {
          const base = currentKind === "run" ? 1.45 : 1.2;
          const ts = base * (0.85 + Math.min(1.4, vel / 8) * 0.55) * (0.9 + energy * 0.2);
          actions[current].setEffectiveTimeScale(ts);
        }
      }

      // Procedural life on the root — readable even when GLB clips are stiff
      let bob = 0;
      let sway = 0;
      let lean = 0;
      let squash = 1;
      if (sitting) {
        bob = Math.sin(t * 1.8 + phase) * 0.014 * energy;
        root.position.y = -0.32 + bob;
        root.rotation.x = 0.12;
        root.rotation.z = Math.sin(t * 1.2 + phase) * 0.03;
        root.scale.set(1, 1, 1);
      } else if (flying) {
        bob = Math.sin(t * 4.2 + phase) * 0.07 * energy;
        sway = Math.sin(t * 2.8 + phase) * 0.06 * energy;
        root.position.y = 0.1 + bob;
        root.rotation.z = sway;
        root.rotation.x = -0.1 + Math.sin(t * 3.1 + phase) * 0.045;
        root.scale.set(1.02, 0.98 + Math.sin(t * 5 + phase) * 0.02, 1.02);
      } else if (moving) {
        // 2D-style bouncey gait — bigger hop when running
        const gaitHz = running ? 16 : 12.5;
        const gait = Math.sin(t * gaitHz + phase);
        const amp = (running ? 0.085 : 0.055) * energy;
        bob = Math.abs(gait) * amp;
        lean = running ? 0.12 : 0.08;
        root.position.y = bob;
        root.rotation.x = lean + gait * (running ? 0.04 : 0.028);
        root.rotation.z = Math.sin(t * gaitHz + phase) * (running ? 0.055 : 0.04);
        // Subtle squash-stretch on footfalls
        squash = 1 + Math.abs(gait) * (running ? 0.04 : 0.025);
        root.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      } else {
        // Breathing idle — visible chest/sway like 2D glow figures
        bob = Math.sin(t * 2.4 + phase) * 0.022 * energy;
        sway = Math.sin(t * 1.35 + phase) * 0.028 * energy;
        root.position.y = bob;
        root.rotation.z = sway;
        root.rotation.x = Math.sin(t * 1.9 + phase) * 0.022;
        const breath = 1 + Math.sin(t * 2.4 + phase) * 0.018 * energy;
        root.scale.set(1 / Math.sqrt(breath), breath, 1 / Math.sqrt(breath));
      }

      if (speaking) {
        // 2D talkBob + talkScale energy
        const talkHop = Math.sin(t * 10 + phase) * 0.05 * energy;
        const talkScale = 1 + Math.sin(t * 8 + phase) * 0.045;
        root.position.y += talkHop;
        root.scale.multiplyScalar(talkScale);
        const pulse = 0.22 + Math.sin(t * 14 + phase) * 0.14;
        setTint(colorHex || 0xffffff, pulse);
        root.rotation.x += Math.sin(t * 9 + phase) * 0.04;
        root.rotation.z += Math.sin(t * 7 + phase) * 0.02;
      }
    }

    return {
      root,
      model: clone,
      mixer,
      actions,
      play,
      setTint,
      update,
      height: targetH,
      hasClips: entry.animations.length > 0,
      /** Added to mesh.rotation.y so +Z faces velocity (0 = walk forward correctly) */
      faceYaw: 0,
    };
  }

  async function createCharacter(def, colorHex) {
    const url = modelUrlForAgent(def);
    const id = String(def?.id || "");
    const isYou = id === "telephantix" || id === "stood" || def?.visual?.forceCustomMesh;
    // YOU: only your file — never silent Xbot/Luna fallback (that looked like "username only")
    const tryUrls = isYou
      ? [
          url,
          `${CHAR_BASE}/telephantix.glb?v=you-wireframe-2`,
          `${CHAR_BASE}/telephantix.glb`,
          `${CHAR_BASE}/stood.glb`,
        ]
      : [url];
    if (id === "telephanthantim" && url.includes("telephanthantim.glb")) {
      tryUrls.push(SOLDIER);
    }
    if (!isYou && id !== "telephanthantim") {
      // generic soft fallback for missing guest files only
    }
    let lastErr = null;
    for (const u of tryUrls) {
      try {
        const entry = await loadTemplate(u);
        console.info("[camp-characters] mesh OK", id, "→", u, "h=", entry.height.toFixed(2));
        return spawnFromTemplate(entry, def, colorHex);
      } catch (err) {
        lastErr = err;
        console.warn("[camp-characters] load failed", u, err?.message || err);
      }
    }
    console.warn("[camp-characters] all loads failed", def?.id, lastErr);
    return null;
  }

  function preloadAll(agentDefs) {
    const urls = new Set(agentDefs.map((d) => modelUrlForAgent(d)));
    return Promise.allSettled([...urls].map((u) => loadTemplate(u)));
  }

  return { createCharacter, preloadAll, loadTemplate, modelUrlForAgent };
}
