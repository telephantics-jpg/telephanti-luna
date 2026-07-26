/**
 * Camp prop visuals — free GLB props when available, rich procedural fallback.
 * Free models: Three.js examples + Khronos glTF Sample Models (permissive).
 *
 * Horse GLB removed from live camp (endless run loop looked broken) →
 * procedural T-Rex with a calm walk + roar on interact.
 */

const PROP_BASE = "/static/camp/props";

/** Map catalog kit / prop id → optional GLB (scaled in world units). */
export const PROP_GLB = {
  // Wildlife / atmosphere (Three.js examples — free)
  flamingo: { url: `${PROP_BASE}/flamingo.glb`, scale: 0.012, y: 1.2, spin: true },
  parrot: { url: `${PROP_BASE}/parrot.glb`, scale: 0.018, y: 1.4, spin: true },
  // horse.glb intentionally NOT mapped — used to gallop forever in place
  duck: { url: `${PROP_BASE}/duck.glb`, scale: 0.35, y: 0.05, spin: false },
  // Food / tableware samples
  avocado: { url: `${PROP_BASE}/avocado.glb`, scale: 8, y: 0.15, spin: false },
  water_bottle: { url: `${PROP_BASE}/water_bottle.glb`, scale: 1.2, y: 0, spin: false },
  water: { url: `${PROP_BASE}/water_bottle.glb`, scale: 1.2, y: 0, spin: false },
  fruit: { url: `${PROP_BASE}/avocado.glb`, scale: 6, y: 0.2, spin: false },
};

/**
 * Procedural camp T-Rex — readable silhouette, calm walk cycle (no runaway gallop).
 * @param {typeof import('three')} THREE
 * @returns {THREE.Group}
 */
export function buildTrexMesh(THREE) {
  const g = new THREE.Group();
  g.name = "prop_trex";
  const hide = 0x3f7a3a;
  const belly = 0x8fbc6b;
  const dark = 0x2a4a28;
  const tooth = 0xf5f5f4;
  const mat = (c, rough = 0.55, metal = 0.05, em = 0.04) =>
    new THREE.MeshStandardMaterial({
      color: c,
      roughness: rough,
      metalness: metal,
      emissive: new THREE.Color(c).multiplyScalar(0.15),
      emissiveIntensity: em,
    });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.85, 6, 12), mat(hide, 0.6, 0.04, 0.05));
  body.rotation.z = Math.PI / 2.4;
  body.position.set(0.05, 1.15, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 12), mat(belly, 0.55, 0.03, 0.06));
  chest.scale.set(1.1, 0.95, 0.85);
  chest.position.set(0.15, 1.05, 0.12);
  chest.castShadow = true;
  g.add(chest);

  // Head + jaw (jaw animates on roar)
  const headRoot = new THREE.Group();
  headRoot.position.set(0.72, 1.45, 0);
  g.add(headRoot);

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.42, 0.48), mat(hide, 0.5, 0.05, 0.05));
  skull.position.set(0.12, 0.05, 0);
  skull.castShadow = true;
  headRoot.add(skull);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 0.36), mat(hide, 0.5, 0.05, 0.05));
  snout.position.set(0.55, 0.0, 0);
  snout.castShadow = true;
  headRoot.add(snout);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.32), mat(dark, 0.55, 0.04, 0.04));
  jaw.position.set(0.52, -0.18, 0);
  jaw.castShadow = true;
  headRoot.add(jaw);

  // teeth nubs
  for (let i = 0; i < 4; i++) {
    const tth = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 5), mat(tooth, 0.35, 0.1, 0.02));
    tth.rotation.z = Math.PI;
    tth.position.set(0.4 + i * 0.08, -0.08, (i % 2 ? 0.08 : -0.08));
    headRoot.add(tth);
  }

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), mat(0xfbbf24, 0.3, 0.2, 0.35));
  eyeL.position.set(0.35, 0.18, 0.2);
  headRoot.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.z = -0.2;
  headRoot.add(eyeR);

  // Tiny arms
  const armGeo = new THREE.CapsuleGeometry(0.05, 0.22, 4, 6);
  const armL = new THREE.Mesh(armGeo, mat(hide));
  armL.position.set(0.25, 1.05, 0.32);
  armL.rotation.z = 0.6;
  armL.castShadow = true;
  g.add(armL);
  const armR = armL.clone();
  armR.position.z = -0.32;
  armR.rotation.z = -0.6;
  g.add(armR);

  // Legs (walk cycle)
  function makeLeg(side) {
    const leg = new THREE.Group();
    leg.position.set(-0.05, 0.72, side * 0.22);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.38, 5, 8), mat(hide, 0.55));
    thigh.position.y = -0.12;
    thigh.castShadow = true;
    leg.add(thigh);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.32, 5, 8), mat(dark, 0.55));
    shin.position.y = -0.48;
    shin.castShadow = true;
    leg.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.18), mat(dark, 0.6));
    foot.position.set(0.06, -0.72, 0);
    foot.castShadow = true;
    leg.add(foot);
    g.add(leg);
    return leg;
  }
  const legL = makeLeg(1);
  const legR = makeLeg(-1);

  // Tail
  const tail = new THREE.Group();
  tail.position.set(-0.55, 1.1, 0);
  g.add(tail);
  const t1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.55, 5, 8), mat(hide, 0.55));
  t1.rotation.z = Math.PI / 2.1;
  t1.position.set(-0.25, 0, 0);
  t1.castShadow = true;
  tail.add(t1);
  const t2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.45, 4, 8), mat(dark, 0.55));
  t2.rotation.z = Math.PI / 2.05;
  t2.position.set(-0.7, -0.05, 0);
  t2.castShadow = true;
  tail.add(t2);

  // Back plates
  for (let i = 0; i < 4; i++) {
    const plate = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 5), mat(0x4ade80, 0.45, 0.05, 0.08));
    plate.position.set(-0.15 + i * 0.18, 1.55 + (i % 2) * 0.04, 0);
    plate.castShadow = true;
    g.add(plate);
  }

  g.userData.trex = true;
  g.userData.trexParts = { headRoot, jaw, legL, legR, tail, armL, armR };
  g.userData.walkSpeed = 2.0; // base run gait (sprint bumps this higher in 3D loop)
  g.userData.roarUntil = 0;
  g.userData.pulseUntil = 0;
  g.userData.interactKind = "wildlife";
  return g;
}

/**
 * Try resolve a GLB entry for a prop catalog row.
 */
export function propGlbFor(prop) {
  if (!prop) return null;
  if (prop.visual?.glb) {
    return {
      url: prop.visual.glb,
      scale: prop.visual.scale ?? 1,
      y: prop.visual.y ?? 0,
      spin: !!prop.visual.spin,
    };
  }
  const id = String(prop.id || "").toLowerCase();
  const kit = String(prop.visual?.kit || "").toLowerCase();
  return PROP_GLB[id] || PROP_GLB[kit] || null;
}

/**
 * @param {typeof import('three')} THREE
 * @param {import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader} GLTFLoader
 */
export function createPropSystem(THREE, GLTFLoader) {
  const loader = new GLTFLoader();
  const cache = new Map();

  async function loadGlb(url) {
    if (cache.has(url)) return cache.get(url);
    const gltf = await loader.loadAsync(url);
    cache.set(url, gltf);
    return gltf;
  }

  /**
   * Build mesh group for a prop. Returns { group, hot?, animate? } or null if GLB only failed
   * and caller should use procedural.
   */
  async function createPropMesh(prop, proceduralBuilder) {
    const id = String(prop?.id || "").toLowerCase();
    const kit = String(prop?.visual?.kit || "").toLowerCase();
    // T-Rex replaces the old runaway horse GLB
    if (id === "trex" || id === "t-rex" || id === "horse" || kit === "trex" || kit === "horse") {
      const trex = buildTrexMesh(THREE);
      trex.userData.propBob = Math.random() * Math.PI * 2;
      const contact = new THREE.Mesh(
        new THREE.CircleGeometry(0.85, 24),
        new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
        }),
      );
      contact.rotation.x = -Math.PI / 2;
      contact.position.y = 0.02;
      trex.add(contact);
      return trex;
    }

    const spec = propGlbFor(prop);
    const g = new THREE.Group();
    g.name = `prop_${prop.id || "x"}`;
    g.userData.propBob = Math.random() * Math.PI * 2;

    // Contact shadow always
    const contact = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 24),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.02;
    g.add(contact);

    if (spec?.url) {
      try {
        const gltf = await loadGlb(spec.url);
        const model = gltf.scene.clone(true);
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const target = 1.1;
        const s = (spec.scale != null ? spec.scale : target / Math.max(size.y, size.x, 0.01));
        model.scale.setScalar(s);
        const box2 = new THREE.Box3().setFromObject(model);
        model.position.y = (spec.y ?? 0) - box2.min.y * (s === spec.scale ? 1 : 1);
        // If scale was absolute, re-floor
        if (spec.scale != null) {
          const b3 = new THREE.Box3().setFromObject(model);
          model.position.y = (spec.y ?? 0) - b3.min.y;
        }
        model.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        g.add(model);
        g.userData.glb = true;
        g.userData.spin = !!spec.spin;
        g.userData.mixer = null;
        if (gltf.animations?.length) {
          const mixer = new THREE.AnimationMixer(model);
          const clip = gltf.animations[0];
          const act = mixer.clipAction(clip);
          act.play();
          g.userData.mixer = mixer;
        }
        return g;
      } catch (err) {
        console.warn("[camp-props] GLB failed", prop.id, spec.url, err);
        // fall through to procedural
        while (g.children.length) g.remove(g.children[0]);
        g.add(contact);
      }
    }

    if (typeof proceduralBuilder === "function") {
      const built = proceduralBuilder(prop);
      if (built) {
        // merge children from procedural into g
        while (built.children.length) {
          g.add(built.children[0]);
        }
        Object.assign(g.userData, built.userData || {});
      }
    }
    return g;
  }

  function updateProp(group, dt, t) {
    if (!group) return;
    if (group.userData.mixer) group.userData.mixer.update(dt);
    if (group.userData.spin) {
      group.rotation.y += dt * 0.35;
    }
    // gentle bob for non-grounded flair
    if (group.userData.glb && group.userData.spin) {
      const phase = group.userData.propBob || 0;
      group.position.y = Math.sin(t * 1.4 + phase) * 0.08;
    }
    // T-Rex run gait + roar chomp (walkSpeed = leg cadence from 3D sprint loop)
    if (group.userData.trex && group.userData.trexParts) {
      const p = group.userData.trexParts;
      const speed = group.userData.walkSpeed || 2.0;
      const phase = (group.userData.propBob || 0) + t * speed * 2.6;
      const strut = Math.sin(phase);
      const amp = 0.48 + Math.min(0.32, (speed - 1) * 0.14);
      if (p.legL) p.legL.rotation.x = strut * amp;
      if (p.legR) p.legR.rotation.x = -strut * amp;
      if (p.tail) p.tail.rotation.y = Math.sin(phase * 0.85) * 0.28;
      if (p.armL) p.armL.rotation.x = Math.sin(phase * 1.1) * 0.22;
      if (p.armR) p.armR.rotation.x = -Math.sin(phase * 1.1) * 0.22;
      if (p.headRoot) p.headRoot.rotation.y = Math.sin(phase * 0.4) * 0.1;
      const roaring = performance.now() < (group.userData.roarUntil || 0);
      if (p.jaw) {
        p.jaw.rotation.x = roaring
          ? 0.55 + Math.sin(t * 18) * 0.08
          : 0.05 + Math.sin(phase * 0.5) * 0.04;
      }
      if (p.headRoot && roaring) {
        p.headRoot.rotation.x = -0.12 + Math.sin(t * 14) * 0.05;
      } else if (p.headRoot) {
        p.headRoot.rotation.x = Math.sin(phase * 0.6) * 0.04;
      }
      // Run bounce
      group.position.y = roaring
        ? Math.sin(t * 20) * 0.04
        : Math.abs(strut) * 0.06 * Math.min(1.4, speed / 1.5);
    }
  }

  return { createPropMesh, loadGlb, updateProp, propGlbFor, buildTrexMesh };
}
