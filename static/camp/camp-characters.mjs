/**
 * Free character embeds for Luna 3D camp — GLB humanoids + animation.
 * Sources (free for this use):
 *  - static/avatars/brunette.glb (Luna / feminine cast)
 *  - three.js Soldier / Xbot / RobotExpressive (MIT)
 *
 * When a mesh has few clips (e.g. brunette), we still drive lifelike
 * root sway / bob / lean so they never look frozen.
 */

const CHAR_BASE = "/static/avatars/characters";
const LUNA_GLB = "/static/avatars/brunette.glb";
const XBOT = `${CHAR_BASE}/xbot.glb`;
const SOLDIER = `${CHAR_BASE}/soldier.glb`;
const ROBOT = `${CHAR_BASE}/robot.glb`;

/** Prefer specific models per agent / archetype */
export const MODEL_FOR_AGENT = {
  luna: LUNA_GLB,
  aurora: LUNA_GLB,
  violet: LUNA_GLB,
  seraph: LUNA_GLB,
  ambrosia: LUNA_GLB,
  rhea: LUNA_GLB,
  mika: LUNA_GLB,
  // warriors / patrol — soldier has solid walk/run/idle
  sentinel: ROBOT,
  thor: SOLDIER,
  zeus: SOLDIER,
  michael: SOLDIER,
  odin: SOLDIER,
  // mixamo-style humanoids (good walk cycles)
  hermes: XBOT,
  oracle: XBOT,
  caduceus: XBOT,
  jesus: XBOT,
  dionysus: XBOT,
  gabriel: XBOT,
  raphael: XBOT,
  uriel: XBOT,
  ara: XBOT,
};

export function modelUrlForAgent(def) {
  if (def?.visual?.glb) return def.visual.glb;
  if (def?.id && MODEL_FOR_AGENT[def.id]) return MODEL_FOR_AGENT[def.id];
  const arch = String(def?.visual?.archetype || "").toLowerCase();
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

    const targetH = 1.72;
    const s = targetH / entry.height;
    clone.scale.setScalar(s);
    const box = new THREE.Box3().setFromObject(clone);
    clone.position.y = -box.min.y * s;
    clone.rotation.y = Math.PI;
    clone.name = "skinned";

    const tint = new THREE.Color(colorHex || 0xcccccc);
    clone.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (!o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const next = mats.map((m) => {
        const cm = m.clone();
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
        cm.envMapIntensity = cm.envMapIntensity != null ? cm.envMapIntensity : 0.85;
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

    function play(kind, fade = 0.28) {
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
      const speed = kind === "walk" || kind === "run" ? 1.05 : kind === "talk" ? 1.15 : 0.9;
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
            m.emissive.copy(c).multiplyScalar(0.35);
            m.emissiveIntensity = glow;
          }
        }
      });
    }

    /**
     * Per-frame: mixer + lifelike procedural motion when clips are weak/missing.
     * @param {number} dt
     * @param {{ moving?: boolean, sitting?: boolean, flying?: boolean, speaking?: boolean, phase?: number, t?: number }} state
     */
    function update(dt, state = {}) {
      const moving = !!state.moving;
      const sitting = !!state.sitting;
      const flying = !!state.flying;
      const speaking = !!state.speaking;
      const phase = state.phase || 0;
      const t = state.t || performance.now() * 0.001;

      if (mixer) mixer.update(dt);

      // Procedural life on the root (works even with full skeleton clips)
      let bob = 0;
      let sway = 0;
      let lean = 0;
      if (sitting) {
        bob = Math.sin(t * 1.4 + phase) * 0.008;
        root.position.y = -0.32 + bob;
        root.rotation.x = 0.12;
        root.rotation.z = Math.sin(t * 0.9 + phase) * 0.02;
      } else if (flying) {
        bob = Math.sin(t * 3.2 + phase) * 0.045;
        sway = Math.sin(t * 2.1 + phase) * 0.04;
        root.position.y = 0.08 + bob;
        root.rotation.z = sway;
        root.rotation.x = -0.08 + Math.sin(t * 2.4 + phase) * 0.03;
      } else if (moving) {
        // gait bob — more visible if mesh has no walk clip
        const gait = Math.sin(t * 11 + phase);
        bob = Math.abs(gait) * 0.04;
        lean = 0.06;
        root.position.y = bob;
        root.rotation.x = lean + gait * 0.02;
        root.rotation.z = Math.sin(t * 11 + phase) * 0.035;
      } else {
        // breathing idle
        bob = Math.sin(t * 2.0 + phase) * 0.012;
        sway = Math.sin(t * 1.1 + phase) * 0.018;
        root.position.y = bob;
        root.rotation.z = sway;
        root.rotation.x = Math.sin(t * 1.6 + phase) * 0.015;
      }

      if (speaking) {
        // soft glow pulse while talking
        const pulse = 0.12 + Math.sin(t * 14 + phase) * 0.08;
        setTint(colorHex || 0xffffff, pulse);
        // tiny head nod (root nod reads as engagement)
        root.rotation.x += Math.sin(t * 9 + phase) * 0.025;
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
    };
  }

  async function createCharacter(def, colorHex) {
    const url = modelUrlForAgent(def);
    try {
      const entry = await loadTemplate(url);
      return spawnFromTemplate(entry, def, colorHex);
    } catch (err) {
      console.warn("[camp-characters] load failed", url, err);
      return null;
    }
  }

  function preloadAll(agentDefs) {
    const urls = new Set(agentDefs.map((d) => modelUrlForAgent(d)));
    return Promise.allSettled([...urls].map((u) => loadTemplate(u)));
  }

  return { createCharacter, preloadAll, loadTemplate, modelUrlForAgent };
}
