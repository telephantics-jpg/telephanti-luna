/**
 * Free character embeds for Luna 3D camp.
 * Sources (all free for this use):
 *  - static/avatars/brunette.glb (your Luna mesh)
 *  - three.js example Soldier / Xbot / RobotExpressive (MIT, mrdoob/three.js)
 *
 * Later you can drop Ready Player Me / Mixamo GLBs into static/avatars/characters/
 * and map agent ids in MODEL_FOR_AGENT.
 */

const CHAR_BASE = "/static/avatars/characters";
const LUNA_GLB = "/static/avatars/brunette.glb";

/** Prefer specific models per agent / archetype */
export const MODEL_FOR_AGENT = {
  luna: LUNA_GLB,
  aurora: LUNA_GLB,
  violet: LUNA_GLB,
  seraph: LUNA_GLB,
  ambrosia: LUNA_GLB,
  rhea: LUNA_GLB,
  mika: LUNA_GLB,
  // warriors / patrol
  sentinel: `${CHAR_BASE}/robot.glb`,
  thor: `${CHAR_BASE}/soldier.glb`,
  zeus: `${CHAR_BASE}/soldier.glb`,
  michael: `${CHAR_BASE}/soldier.glb`,
  odin: `${CHAR_BASE}/soldier.glb`,
  // default humanoids
  hermes: `${CHAR_BASE}/xbot.glb`,
  oracle: `${CHAR_BASE}/xbot.glb`,
  caduceus: `${CHAR_BASE}/xbot.glb`,
  jesus: `${CHAR_BASE}/xbot.glb`,
  dionysus: `${CHAR_BASE}/xbot.glb`,
  gabriel: `${CHAR_BASE}/xbot.glb`,
  raphael: `${CHAR_BASE}/xbot.glb`,
  uriel: `${CHAR_BASE}/xbot.glb`,
  ara: `${CHAR_BASE}/xbot.glb`,
};

export function modelUrlForAgent(def) {
  if (def?.visual?.glb) return def.visual.glb;
  if (def?.id && MODEL_FOR_AGENT[def.id]) return MODEL_FOR_AGENT[def.id];
  const arch = String(def?.visual?.archetype || "").toLowerCase();
  if (["moon_host", "lights", "reveler"].includes(arch)) return LUNA_GLB;
  if (["thunder", "guardian", "allfather"].includes(arch)) return `${CHAR_BASE}/soldier.glb`;
  if (arch === "guardian" && def?.id === "sentinel") return `${CHAR_BASE}/robot.glb`;
  return `${CHAR_BASE}/xbot.glb`;
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
    // normalize height ~1.7m standing
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const height = Math.max(size.y, 0.01);
    const entry = { gltf, height, animations: gltf.animations || [] };
    templates.set(url, entry);
    return entry;
  }

  /**
   * Clone a free character, tint meshes toward agent color, set up mixer.
   * @returns {{ root: THREE.Group, mixer: THREE.AnimationMixer|null, actions: object, play: fn, setTint: fn }}
   */
  function spawnFromTemplate(entry, def, colorHex) {
    const root = new THREE.Group();
    root.name = `char_${def.id}`;

    // Deep clone skinned meshes correctly
    const clone = SkeletonUtils && SkeletonUtils.clone
      ? SkeletonUtils.clone(entry.gltf.scene)
      : entry.gltf.scene.clone(true);

    // Scale to ~1.65–1.85m
    const targetH = 1.7;
    const s = targetH / entry.height;
    clone.scale.setScalar(s);
    // feet on ground
    const box = new THREE.Box3().setFromObject(clone);
    clone.position.y = -box.min.y * s;
    // Face +Z like our walk system uses atan2(dx,dz)
    clone.rotation.y = Math.PI;

    const tint = new THREE.Color(colorHex || 0xcccccc);
    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          const next = mats.map((m) => {
            const cm = m.clone();
            // soft tint clothes/skin toward agent identity color
            if (cm.color) {
              const base = cm.color.clone();
              cm.color = base.lerp(tint, 0.35);
            }
            if (cm.emissive) {
              cm.emissive = tint.clone();
              cm.emissiveIntensity = 0.08;
            }
            cm.roughness = cm.roughness != null ? cm.roughness : 0.55;
            return cm;
          });
          o.material = Array.isArray(o.material) ? next : next[0];
        }
      }
    });

    root.add(clone);

    let mixer = null;
    const actions = {};
    let current = "";

    if (entry.animations.length) {
      mixer = new THREE.AnimationMixer(clone);
      for (const clip of entry.animations) {
        const name = (clip.name || "clip").toLowerCase();
        actions[name] = mixer.clipAction(clip);
        // also store raw
        actions[clip.name] = actions[name];
      }
    }

    function pickAction(kind) {
      // map our states → clip name fuzzy match
      const keys = Object.keys(actions);
      const find = (...needles) =>
        keys.find((k) => needles.some((n) => k.toLowerCase().includes(n)));
      if (kind === "walk" || kind === "run") {
        return find("walk", "run", "jog") || keys[0];
      }
      if (kind === "sit") {
        return find("sit", "idle") || keys[0];
      }
      if (kind === "dance") {
        return find("dance", "wave", "jump") || find("idle") || keys[0];
      }
      return find("idle", "stand", "tpose") || keys[0];
    }

    function play(kind, fade = 0.25) {
      if (!mixer) return;
      const key = pickAction(kind);
      if (!key || key === current) return;
      const next = actions[key];
      if (!next) return;
      if (current && actions[current]) {
        actions[current].fadeOut(fade);
      }
      next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
      // loop
      next.setLoop(THREE.LoopRepeat, Infinity);
      current = key;
    }

    // start idle if available
    if (mixer) play("idle", 0);

    function setTint(hex, glow = 0.12) {
      const c = new THREE.Color(hex);
      clone.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m.emissive) {
            m.emissive.copy(c);
            m.emissiveIntensity = glow;
          }
        }
      });
    }

    return { root, model: clone, mixer, actions, play, setTint, height: targetH };
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
