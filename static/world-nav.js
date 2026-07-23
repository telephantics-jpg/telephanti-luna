/**
 * Compact world switcher for Luna Camp (2D + 3D) and any page that loads this script.
 * Tabs: Relics (telephantim.com) · Luna 2D · Luna 3D
 * - Top-level: navigates normally
 * - Inside telephantim.com iframe: postMessage so the hub swaps the main scene
 */
(function () {
  "use strict";

  var HUB = "https://telephantim.com/";
  // Always absolute Luna host — relative /firmament/* breaks on telephantim.com (wrong origin)
  var LUNA = "https://telephanti.com";
  function lunaPath(path) {
    var p = path.charAt(0) === "/" ? path : "/" + path;
    var host = (location.hostname || "").toLowerCase();
    // Local workshop: stay on this host (127.0.0.1 / localhost)
    if (host === "127.0.0.1" || host === "localhost" || host.indexOf("192.168.") === 0) {
      return p;
    }
    // Already on telephanti.com (or Render service URL)
    if (host.indexOf("telephanti.com") !== -1 || host.indexOf("onrender.com") !== -1) {
      return p;
    }
    // Hub, other sites, iframes: full live path
    return LUNA + p;
  }
  var TABS = [
    { id: "telephantim", label: "Relics", title: "Telephantim — Mjolnir + Caduceus", href: HUB },
    { id: "luna-2d", label: "2D", title: "Luna Camp 2D", href: lunaPath("/firmament/play") },
    { id: "luna-3d", label: "3D", title: "Luna Camp 3D", href: lunaPath("/firmament/3d") },
  ];

  function currentId() {
    var p = (location.pathname || "").toLowerCase();
    var host = (location.hostname || "").toLowerCase();
    if (p.indexOf("/firmament/3d") !== -1 || p.indexOf("/firmament/three") !== -1 || p.indexOf("firmament-three") !== -1) return "luna-3d";
    if (p.indexOf("/firmament/play") !== -1 || p.indexOf("firmament-play") !== -1) return "luna-2d";
    if (host.indexOf("telephantim") !== -1) return "telephantim";
    return "";
  }

  function inIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  function parentLooksLikeHub() {
    try {
      var ref = document.referrer || "";
      return /telephantim\.com/i.test(ref) || /telephantim/i.test(ref);
    } catch (e) {
      return false;
    }
  }

  function go(id, href) {
    // Snapshot dialogue so the next scene feels continuous
    try {
      var tapeKey = "telephantix-dialogue-tape-v1";
      // no-op read to ensure storage still available; camp-bridge writes live
      void localStorage.getItem(tapeKey);
    } catch (e) {}
    // Prefer hub scene swap when embedded
    if (inIframe()) {
      try {
        window.parent.postMessage(
          { source: "telephantim-world-nav", type: "set-scene", scene: id },
          "*"
        );
        // If parent handled it, stay; also set top for hard nav fallback after short delay only if still same
        return;
      } catch (e) {}
      // Cross-origin fallback: break out
      try {
        if (id === "telephantim") {
          window.top.location.href = HUB;
        } else {
          window.top.location.href = href;
        }
      } catch (e2) {
        location.href = href;
      }
      return;
    }
    if (id === currentId()) return;
    // Recompute live href at click time (tabs built once at load)
    var live = href;
    if (id === "luna-2d") live = lunaPath("/firmament/play");
    if (id === "luna-3d") live = lunaPath("/firmament/3d");
    if (id === "telephantim") live = HUB;
    location.href = live;
  }

  function injectStyles() {
    if (document.getElementById("world-nav-css")) return;
    var s = document.createElement("style");
    s.id = "world-nav-css";
    s.textContent = [
      "#world-nav{position:fixed;z-index:2147483000;top:max(4px,env(safe-area-inset-top,0px));",
      "left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:2px;",
    // when iframed under hub bar, nudge down slightly so both tiny bars stack cleanly
    "html.world-nav-embed #world-nav{top:max(38px,calc(env(safe-area-inset-top,0px) + 34px));}",
      "padding:3px;border-radius:999px;border:1px solid rgba(201,162,39,.5);",
      "background:rgba(6,10,18,.92);box-shadow:0 6px 20px rgba(0,0,0,.45);",
      "backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);",
      "max-width:calc(100vw - 10px);pointer-events:auto;}",
      "#world-nav button{appearance:none;border:0;cursor:pointer;font:inherit;",
      "font-size:11px;font-weight:800;letter-spacing:.02em;line-height:1;",
      "padding:7px 10px;min-height:30px;min-width:44px;border-radius:999px;",
      "color:#d7deea;background:transparent;white-space:nowrap;}",
      "#world-nav button:active{transform:scale(.97)}",
      "#world-nav button.active{color:#0b1220;background:linear-gradient(135deg,#f0d060,#c9a227);",
      "box-shadow:0 0 12px rgba(201,162,39,.35)}",
      "#world-nav button[data-id='luna-2d'].active,",
      "#world-nav button[data-id='luna-3d'].active{color:#e8f6ff;",
      "background:linear-gradient(135deg,#1a4a7a,#0c2848)}",
      "@media (max-width:380px){#world-nav button{font-size:10px;padding:6px 8px;min-width:40px}}",
    ].join("");
    document.head.appendChild(s);
  }

  function mount() {
    if (document.getElementById("world-nav")) return;

    // Full-page Luna: show Relics | 2D | 3D.
    // Inside telephantim.com iframe: skip — the hub already draws the same tiny bar on top.
    if (inIframe()) {
      return;
    }

    injectStyles();
    var nav = document.createElement("nav");
    nav.id = "world-nav";
    nav.setAttribute("aria-label", "Switch world");
    var cur = currentId();
    TABS.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-id", t.id);
      b.textContent = t.label;
      b.title = t.title;
      if (t.id === cur) {
        b.className = "active";
        b.setAttribute("aria-current", "true");
      }
      b.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        go(t.id, t.href);
      });
      nav.appendChild(b);
    });
    document.body.appendChild(nav);

    if (inIframe()) {
      try {
        document.documentElement.classList.add("world-nav-embed");
      } catch (e) {}
      nav.title = "Switch world";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
