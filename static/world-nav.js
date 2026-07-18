/**
 * Compact world switcher for Luna Camp (2D + 3D) and any page that loads this script.
 * Tabs: Relics (telephantim.com) · Luna 2D · Luna 3D
 * - Top-level: navigates normally
 * - Inside telephantim.com iframe: postMessage so the hub swaps the main scene
 */
(function () {
  "use strict";

  var HUB = "https://telephantim.com/";
  var TABS = [
    { id: "telephantim", label: "Relics", title: "Telephantim — Mjolnir + Caduceus", href: HUB },
    { id: "luna-2d", label: "2D", title: "Luna Camp 2D", href: "/firmament/play" },
    { id: "luna-3d", label: "3D", title: "Luna Camp 3D", href: "/firmament/3d" },
  ];

  function currentId() {
    var p = (location.pathname || "").toLowerCase();
    if (p.indexOf("/firmament/3d") !== -1 || p.indexOf("firmament-three") !== -1) return "luna-3d";
    if (p.indexOf("/firmament/play") !== -1 || p.indexOf("firmament-play") !== -1) return "luna-2d";
    if (location.hostname.indexOf("telephantim") !== -1) return "telephantim";
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
    location.href = href;
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
