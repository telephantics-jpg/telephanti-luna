# Free camp graphics

## Characters (agents)
Folder: `static/avatars/characters/` + `static/avatars/brunette.glb`

| File | Source | Used for |
|------|--------|----------|
| brunette.glb | Free feminine cast | Luna, Aurora, Violet, … |
| xbot.glb | Three.js / Mixamo-style (MIT) | Hermes, Oracle, Caduceus, … |
| soldier.glb | Three.js examples (MIT) | Thor, Zeus, Odin, Michael |
| robot.glb | Three.js RobotExpressive (MIT) | Sentinel |

**Add more:** drop a `.glb` into `static/avatars/characters/`, then map the agent id in `camp-characters.mjs` → `MODEL_FOR_AGENT`, **or** set `visual.glb` on the agent in the catalog.

## Props / wildlife
Folder: `static/camp/props/`

| File | Source |
|------|--------|
| flamingo.glb, parrot.glb | Three.js examples |
| duck.glb, avocado.glb, water_bottle.glb, truck.glb | Khronos glTF Sample Models |
| **T-Rex** | Procedural (`buildTrexMesh`) — replaced horse.glb (endless run loop) |

Mapped in `camp-props.mjs` → `PROP_GLB` / `buildTrexMesh`. Catalog props without a GLB still use improved procedural meshes in `firmament-three.html`.

### Interactions (3D camp)
- **Tap prop** → walk to it + use
- **T-Rex** → roar (jaw + nearby agents react)
- **Flamingo / parrot / duck** → pet
- **Food / drinks** → pick up & carry (press **X** to drop)
- **Stereo** → music

## Free packs to download yourself
- [Kenney.nl](https://kenney.nl/assets) — CC0 nature / furniture
- [Quaternius](https://quaternius.com) — characters
- [Mixamo](https://www.mixamo.com) — animated people (export FBX → GLB)
- [Poly Haven](https://polyhaven.com) — ground textures / HDR skies
