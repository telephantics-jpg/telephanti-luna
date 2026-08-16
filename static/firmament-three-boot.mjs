/**
 * Progressive 3D boot — paint WebGL first, then load the full camp app.
 * Keeps the boot card honest: never depends on parsing a 400KB+ inline script
 * before Three.js can start.
 */
import * as THREE from "three";

const BUILD = "2026-08-16-heaven-talk";

function $(id) {
  return document.getElementById(id);
}

function setStep(msg) {
  const el = $("boot-step");
  if (el) el.textContent = msg;
  console.info("[camp3d-boot]", msg);
}

function clearBoot() {
  const ov = $("boot-overlay");
  if (!ov) return;
  ov.classList.add("done");
  ov.classList.remove("fail");
  ov.style.opacity = "0";
  ov.style.visibility = "hidden";
  ov.style.pointerEvents = "none";
  ov.style.display = "none";
  try {
    ov.setAttribute("aria-hidden", "true");
  } catch (_) {}
  console.info("[camp3d-boot] boot cleared — meadow canvas live");
}

function failBoot(msg) {
  const ov = $("boot-overlay");
  const el = $("boot-step");
  const text = String(msg && msg.message ? msg.message : msg);
  console.error("[camp3d-boot]", text);
  if (ov) {
    ov.classList.add("fail");
    ov.classList.remove("done");
    ov.style.display = "";
    ov.style.opacity = "";
    ov.style.visibility = "";
  }
  if (el) el.textContent = "3D failed — " + text.slice(0, 180);
  const err = $("boot-error");
  if (err) {
    err.hidden = false;
    err.textContent = text;
  }
}

// Expose for the full app (avoids double WebGLRenderer when possible)
const host = $("canvas-host");
if (!host) {
  failBoot("#canvas-host missing");
  throw new Error("#canvas-host missing");
}

setStep("Starting WebGL meadow…");
let renderer;
try {
  if (!THREE.WebGLRenderer) throw new Error("WebGLRenderer missing from Three.js");
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
  // One frame of clear color so the meadow isn't a white flash
  try {
    renderer.render(new THREE.Scene(), new THREE.PerspectiveCamera());
  } catch (_) {}
  setStep("Meadow canvas ready — loading camp…");
  clearBoot();
} catch (err) {
  failBoot(err);
  throw err;
}

window.__LUNA_THREE_BOOT__ = {
  BUILD,
  THREE,
  renderer,
  host,
  clearBoot,
  setStep,
};

setStep("Loading full camp app…");
try {
  await import(`/static/firmament-three-app.mjs?v=${encodeURIComponent(BUILD)}`);
  setStep("Camp app loaded");
  // App should call its own finishBoot; belt + suspenders
  clearBoot();
} catch (err) {
  console.error("[camp3d-boot] app import failed", err);
  // Canvas is already up — keep meadow visible, surface a toast-level message
  setStep("Camp app slow/failed — canvas is up. Ctrl+Shift+R if empty.");
  const errEl = $("boot-error");
  if (errEl) {
    errEl.hidden = false;
    errEl.innerHTML =
      "<b>Camp app failed to load</b><br>" +
      String(err && err.message ? err.message : err).replace(/</g, "&lt;") +
      "<br><br>Meadow canvas is still up. Hard-refresh or check :8767.";
  }
}
