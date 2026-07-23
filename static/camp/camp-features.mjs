/**
 * 2D-parity feature panels for Three.js — real content, not empty shells.
 * Uses APIs when live; always has offline fallback data so panels never blank out.
 */

const FALLBACK_MUSIC = [
  { id: "flowing-free", title: "Flowing Free", src: "/static/camp/music/flowing-free.mp3" },
  { id: "loud-and-clear", title: "Loud and Clear", src: "/static/camp/music/loud-and-clear.mp3" },
  { id: "holy-ghosts", title: "Holy Ghosts", src: "/static/camp/music/holy-ghosts.mp3" },
  { id: "pull-me-under", title: "Pull Me Under", src: "/static/camp/music/pull-me-under.mp3" },
  { id: "marijane", title: "Marijane", src: "/static/camp/music/marijane.mp3" },
  { id: "mountain-clouds", title: "Mountain Clouds", src: "/static/camp/music/mountain-clouds.mp3" },
  { id: "abracadabra", title: "Abracadabra", src: "/static/camp/music/abracadabra.mp3" },
  { id: "pulverised-dust", title: "Pulverised Dust", src: "/static/camp/music/pulverised-dust.mp3" },
];

const FALLBACK_SHOP = [
  { id: "cookies", name: "Cookie crate", emoji: "🍪", cost: 3, desc: "Sweet fuel for camp chatter." },
  { id: "beer", name: "Aurora lager", emoji: "🍺", cost: 4, desc: "Cold beer — Hermes approves." },
  { id: "herbs", name: "Herb bundle", emoji: "🌿", cost: 5, desc: "Mellow camp chill." },
  { id: "aura_charm", name: "Aurora charm", emoji: "✨", cost: 8, desc: "Psychic shimmer boost." },
  { id: "weird_hat", name: "Trippy hat", emoji: "🎩", cost: 6, desc: "Impossible geometry drip." },
  { id: "stereo_boost", name: "Stereo boost", emoji: "🔊", cost: 7, desc: "Jukebox hits harder." },
];

const FALLBACK_PULSE = [
  "AI agents are the new group chat",
  "Everyone's debating the same headline in three moods",
  "Touch grass — unironically recommended",
  "New phone dropped; camp already has opinions",
  "Climate report → meme in under ten minutes",
];

/**
 * @param {object} opts
 */
export function mountCampFeatures(opts) {
  const {
    campClient,
    catalog,
    logLine = () => {},
    showToast = () => {},
    showSpeech = () => {},
    onSummonAgents,
  } = opts;

  const features = catalog?.features || {};
  let musicTracks = (catalog?.music && catalog.music.length)
    ? catalog.music
    : FALLBACK_MUSIC.slice();
  // Full Telephantix queue (same as hub / 2D) when API available
  import("/static/camp-bridge.mjs?v=301")
    .then(async (mod) => {
      try {
        const tracks = await mod.loadSunoCatalog();
        if (tracks?.length) {
          musicTracks = tracks.map((t) => ({
            id: t.id,
            title: t.title,
            src: t.src || t.audio_url,
          }));
        }
      } catch (_) {}
    })
    .catch(() => {});

  // Remove old root if hot-reloaded
  document.getElementById("camp-feature-root")?.remove();

  const root = document.createElement("div");
  root.id = "camp-feature-root";
  root.innerHTML = `
    <style>
      /* Above meadow UI, below speech bubbles (200) */
      #camp-feature-root { position: fixed; inset: 0; pointer-events: none; z-index: 55; }
      /* ALWAYS-VISIBLE hot tools — center under topbar (2D free-tools parity) */
      #camp-feature-root .feat-hotbar {
        pointer-events: auto; position: fixed; left: 50%; transform: translateX(-50%);
        top: max(54px, calc(env(safe-area-inset-top, 0px) + 46px));
        z-index: 56; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
        max-width: min(96vw, 760px); padding: 8px 10px;
        background: rgba(6, 10, 22, 0.92); border: 1px solid rgba(196, 181, 253, 0.55);
        border-radius: 16px; box-shadow: 0 8px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(103,232,249,0.12);
      }
      #camp-feature-root .feat-hotbar button {
        background: linear-gradient(135deg, rgba(76,29,149,0.92), rgba(30,27,75,0.96));
        border: 2px solid rgba(196,181,253,0.85); color: #f5f3ff;
        border-radius: 999px; padding: 9px 14px; font: inherit; font-size: 0.8rem; font-weight: 800;
        cursor: pointer; line-height: 1.2; white-space: nowrap;
        box-shadow: 0 0 0 0 rgba(167,139,250,0.45), 0 4px 14px rgba(0,0,0,0.4);
        animation: feat-hot-pulse 2.6s ease-in-out infinite;
      }
      #camp-feature-root .feat-hotbar button.feat-unknown {
        border-color: rgba(251,191,36,0.9); color: #fffbeb;
        background: linear-gradient(135deg, rgba(120,53,15,0.95), rgba(76,29,149,0.9));
        animation: feat-hot-pulse 1.8s ease-in-out infinite;
      }
      #camp-feature-root .feat-hotbar button.feat-heaven {
        border-color: rgba(253,230,138,0.85); color: #fef3c7;
        background: linear-gradient(135deg, rgba(66,32,6,0.95), rgba(253,230,138,0.28));
      }
      #camp-feature-root .feat-hotbar button:hover {
        border-color: #fde68a; filter: brightness(1.1); animation: none;
      }
      @keyframes feat-hot-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(167,139,250,0.5), 0 4px 14px rgba(0,0,0,0.4); }
        50% { box-shadow: 0 0 0 7px rgba(167,139,250,0), 0 4px 14px rgba(0,0,0,0.4); }
      }
      #camp-feature-root .feat-dock-wrap {
        pointer-events: auto; position: fixed;
        left: max(8px, env(safe-area-inset-left, 0px));
        top: max(118px, calc(env(safe-area-inset-top, 0px) + 108px));
        transform: none;
        display: flex; flex-direction: column; align-items: flex-start; gap: 6px; z-index: 54;
      }
      #camp-feature-root .feat-dock-toggle {
        background: linear-gradient(135deg, rgba(14,116,144,0.95), rgba(30,41,59,0.95));
        border: 1px solid rgba(103,232,249,0.55); color: #e0f2fe;
        border-radius: 999px; padding: 7px 12px; font: inherit; font-size: 0.72rem; font-weight: 700;
        cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        min-width: 0; line-height: 1.2;
      }
      #camp-feature-root .feat-dock-toggle:hover { border-color: #fde68a; filter: brightness(1.08); }
      #camp-feature-root .feat-dock-toggle[aria-expanded="true"] {
        border-color: #67e8f9; color: #a5f3fc;
      }
      #camp-feature-root .feat-dock {
        display: flex; flex-direction: column; gap: 5px; max-height: min(55vh, 420px); overflow-y: auto;
        padding: 6px; background: rgba(6,10,20,0.94); border: 1px solid rgba(103,232,249,0.35);
        border-radius: 14px; box-shadow: 0 8px 24px rgba(0,0,0,0.45);
      }
      #camp-feature-root .feat-dock.collapsed { display: none !important; }
      #camp-feature-root .feat-dock button {
        background: rgba(8,14,28,0.96); border: 1px solid rgba(103,232,249,0.45); color: #e0f2fe;
        border-radius: 999px; padding: 7px 12px; font: inherit; font-size: 0.74rem; font-weight: 700; cursor: pointer;
        text-align: left; min-width: 0; max-width: 168px; box-shadow: 0 2px 10px rgba(0,0,0,0.35);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25;
      }
      #camp-feature-root .feat-dock button:hover { border-color: #67e8f9; background: rgba(15,30,50,0.98); color: #67e8f9; }
      #camp-feature-root .feat-dock button.feat-hot {
        border-color: rgba(196,181,253,0.85); color: #f5f3ff;
        background: linear-gradient(135deg, rgba(76,29,149,0.75), rgba(30,27,75,0.95));
      }
      #camp-feature-root .feat-panel {
        pointer-events: auto; display: none; position: fixed; left: 50%; top: 50%;
        transform: translate(-50%,-50%); width: min(440px, 94vw); max-height: 78vh; overflow: auto;
        background: rgba(6,10,22,0.98); border: 1px solid rgba(103,232,249,0.45); border-radius: 16px;
        padding: 16px 16px 18px; color: #e2e8f0; font-size: 0.86rem; line-height: 1.45;
        box-shadow: 0 24px 60px rgba(0,0,0,0.55); z-index: 60;
      }
      #camp-feature-root .feat-panel.open { display: block; }
      #camp-feature-root .feat-panel h3 { color: #67e8f9; margin: 0 0 6px; font-size: 1.05rem; }
      #camp-feature-root .feat-panel .sub { color: #94a3b8; font-size: 0.72rem; margin-bottom: 10px; }
      #camp-feature-root .feat-panel .row {
        display: flex; gap: 10px; align-items: center; justify-content: space-between;
        padding: 10px 0; border-bottom: 1px solid rgba(148,163,184,0.18);
      }
      #camp-feature-root .feat-panel .row .meta { flex: 1; min-width: 0; }
      #camp-feature-root .feat-panel .row .meta b { display: block; color: #f1f5f9; }
      #camp-feature-root .feat-panel .row .meta .d { font-size: 0.72rem; color: #94a3b8; margin-top: 2px; }
      #camp-feature-root .feat-panel button.act {
        background: linear-gradient(135deg, rgba(67,56,202,0.9), rgba(14,116,144,0.95));
        border: 1px solid rgba(103,232,249,0.45); color: #ecfeff; border-radius: 10px;
        padding: 8px 12px; font: inherit; cursor: pointer; flex-shrink: 0;
      }
      #camp-feature-root .feat-close {
        float: right; background: transparent; border: 1px solid rgba(248,113,113,0.55);
        color: #fca5a5; border-radius: 8px; padding: 4px 10px; cursor: pointer; font: inherit;
      }
      #camp-feature-root .feat-body { clear: both; margin-top: 6px; white-space: normal; }
      #camp-feature-root .tv-frame {
        width: 100%; aspect-ratio: 16/9; border: 0; border-radius: 10px; background: #000;
        margin: 8px 0 12px;
      }
      #camp-feature-root .pulse-line {
        padding: 8px 0; border-bottom: 1px solid rgba(148,163,184,0.15);
        color: #e2e8f0; font-size: 0.84rem;
      }
      #camp-feature-root .pulse-line a { color: #7dd3fc; }
      #camp-feature-root .err { color: #fca5a5; }
      #camp-feature-root .ok { color: #86efac; }
      @media (max-width: 640px) {
        #camp-feature-root .feat-hotbar {
          top: max(96px, calc(env(safe-area-inset-top, 0px) + 88px));
          gap: 5px; padding: 6px;
        }
        #camp-feature-root .feat-hotbar button { font-size: 0.68rem; padding: 7px 10px; }
        #camp-feature-root .feat-dock-wrap { left: 6px; top: max(160px, calc(env(safe-area-inset-top, 0px) + 150px)); }
        #camp-feature-root .feat-dock button { font-size: 0.6rem; padding: 3px 8px; max-width: 96px; }
      }
    </style>
    <div class="feat-hotbar" id="feat-hotbar" role="toolbar" aria-label="Camp hot tools"></div>
    <div class="feat-dock-wrap" id="feat-dock-wrap">
      <button type="button" class="feat-dock-toggle" id="feat-dock-toggle"
        aria-expanded="false" aria-controls="feat-dock" title="More camp tools — Shop, TV, Club…">✦ More tools</button>
      <div class="feat-dock collapsed" id="feat-dock" role="group" aria-label="More camp actions"></div>
    </div>
    <div class="feat-panel" id="feat-panel" role="dialog" aria-modal="true">
      <button type="button" class="feat-close" id="feat-close">Close</button>
      <h3 id="feat-title">Feature</h3>
      <div class="sub" id="feat-sub"></div>
      <div class="feat-body" id="feat-body"></div>
    </div>
  `;
  document.body.appendChild(root);

  const hotbar = root.querySelector("#feat-hotbar");
  const dock = root.querySelector("#feat-dock");
  const dockToggle = root.querySelector("#feat-dock-toggle");
  const panel = root.querySelector("#feat-panel");
  const titleEl = root.querySelector("#feat-title");
  const subEl = root.querySelector("#feat-sub");
  const bodyEl = root.querySelector("#feat-body");
  root.querySelector("#feat-close").onclick = () => panel.classList.remove("open");

  // Extra tools dock can stay collapsed — hot tools are always on the center strip
  const DOCK_KEY = "luna-3d-feat-dock-open-v3";
  function setDockOpen(open) {
    dock.classList.toggle("collapsed", !open);
    dockToggle.setAttribute("aria-expanded", open ? "true" : "false");
    dockToggle.textContent = open ? "✕ Hide extra" : "✦ More tools";
    dockToggle.title = open
      ? "Hide Shop / TV / Club / Pulse"
      : "Shop, Lucid TV, Club, Pulse, music…";
    try { localStorage.setItem(DOCK_KEY, open ? "1" : "0"); } catch (_) {}
  }
  let startOpen = false;
  try {
    if (localStorage.getItem(DOCK_KEY) === "1") startOpen = true;
  } catch (_) {}
  setDockOpen(startOpen);

  dockToggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDockOpen(dock.classList.contains("collapsed"));
  });

  function openPanel(title, sub, html) {
    titleEl.textContent = title;
    subEl.textContent = sub || "";
    bodyEl.innerHTML = html || "";
    panel.classList.add("open");
  }

  function makeBtn(label, onClick, extraClass = "") {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = label;
    if (extraClass) b.className = extraClass;
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  /** Always-visible center strip (2D free-tools parity) */
  function addHotBtn(label, onClick, extraClass = "") {
    const b = makeBtn(label, onClick, extraClass);
    hotbar.appendChild(b);
    return b;
  }

  /** Secondary tools in left “More tools” list */
  function addBtn(label, onClick, show = true, hot = false) {
    if (!show) return null;
    const b = makeBtn(label, onClick, hot ? "feat-hot" : "");
    dock.appendChild(b);
    return b;
  }

  // ── HOTBAR first (always on screen — no menu needed) ──
  function runMysteriousUnknown() {
    showToast("❓ Frequency opens…");
    if (typeof opts.onConjureUnknown === "function") {
      openPanel(
        "Mysterious Unknown",
        "Not evil — ancient & curious",
        "<p>Tearing a hole in the meadow… agents turning to look.</p>",
      );
      return Promise.resolve()
        .then(() => opts.onConjureUnknown())
        .then((result) => {
          const name = result?.name || "Unknown";
          const line = result?.line || "";
          bodyEl.innerHTML =
            `<p><b>${escapeHtml(result?.glyph || "❓")} ${escapeHtml(name)}</b></p>` +
            (line ? `<p>${escapeHtml(line)}</p>` : "<p class='sub'>Manifesting…</p>") +
            `<p class="sub">Nearby agents are reacting on the meadow.</p>`;
          if (line) {
            logLine(name, line);
            if (result?.speakId) showSpeech(result.speakId, line, 14000);
          }
        })
        .catch((err) => {
          bodyEl.innerHTML = `<p class="err">${escapeHtml(err.message || "conjure failed")}</p>`;
        });
    }
    openPanel("Mysterious Unknown", "Not evil — ancient & curious", "<p>Calling Oracle…</p>");
    return campClient
      .agentChat(
        "oracle",
        "A Mysterious Unknown just arrived at camp (not evil — ancient, curious). React as Oracle in 2-4 sentences, then invite Hermes to notice the ripple.",
        { ambient: true },
      )
      .then((data) => {
        const t = data.reply || data.text || "…";
        bodyEl.innerHTML = `<p><b>Oracle</b></p><p>${escapeHtml(t)}</p>`;
        logLine("Oracle", t);
        showSpeech("oracle", t, 10000);
      })
      .catch((err) => {
        bodyEl.innerHTML = `<p class="err">${escapeHtml(err.message)}</p><p>You opened a frequency sealed long ago…</p>`;
      });
  }

  if (features.mysterious_unknown !== false) {
    addHotBtn("❓ Mysterious Unknown", () => { void runMysteriousUnknown(); }, "feat-unknown");
  }
  addHotBtn("✦ Heaven", () => {
    showToast("✦ Summoning Heaven…");
    logLine("Camp", "Heaven wave — Jesus & archangels inbound");
    if (typeof opts.onSummonAgents === "function") {
      opts.onSummonAgents([]); // empty = default heaven crew in host
    } else {
      showToast("Summon hook missing — refresh");
    }
  }, "feat-heaven");
  addHotBtn("🍷 Dionysus", () => {
    showToast("🍷 Calling Dionysus…");
    logLine("Camp", "Dionysus wave — vineyard energy inbound");
    if (typeof opts.onSummonAgents === "function") {
      opts.onSummonAgents(["dionysus"]);
    } else {
      showToast("Summon hook missing — refresh");
    }
  });
  addHotBtn("🤫 Hush", () => {
    if (typeof opts.onHush === "function") {
      opts.onHush();
    } else {
      showToast("🤫 Hush — ask camp to slow down (wire onHush for full effect)");
      logLine("Camp", "Visitor asked for hush — leave room between lines.");
    }
  });

  // ── Music ──
  let audio = null;
  let trackIndex = 0;
  function ensureAudio() {
    if (!audio) {
      audio = new Audio();
      audio.volume = 0.55;
    }
    return audio;
  }
  function playTrack(i) {
    // Prefer the top-bar Album player so one shared background stream
    if (typeof window.__lunaPlayAlbum === "function" && (i === 0 || i === trackIndex)) {
      try { window.__lunaPlayAlbum(); return; } catch (_) {}
    }
    if (!musicTracks.length) musicTracks = FALLBACK_MUSIC.slice();
    trackIndex = ((i % musicTracks.length) + musicTracks.length) % musicTracks.length;
    const t = musicTracks[trackIndex];
    const a = ensureAudio();
    a.loop = false;
    a.src = t.src;
    a.play()
      .then(() => {
        showToast(`🎵 ${t.title}`);
        logLine("Camp", `Jukebox: ${t.title}`);
      })
      .catch(() => showToast("Tap Play again (browser blocked autoplay)"));
  }

  addBtn("♪ Play music", () => {
    if (!musicTracks.length) musicTracks = FALLBACK_MUSIC.slice();
    openPanel("Play music", `${musicTracks.length} Telephantix tracks · hub queue`, "");
    const frag = document.createDocumentFragment();
    const controls = document.createElement("div");
    controls.className = "row";
    controls.innerHTML = `<span class="meta"><b>Now</b><div class="d" id="m-now">—</div></span>`;
    const next = document.createElement("button");
    next.type = "button";
    next.className = "act";
    next.textContent = "Next";
    next.onclick = () => {
      playTrack(trackIndex + 1);
      const n = bodyEl.querySelector("#m-now");
      if (n) n.textContent = musicTracks[trackIndex]?.title || "";
    };
    const stop = document.createElement("button");
    stop.type = "button";
    stop.className = "act";
    stop.textContent = "Stop";
    stop.onclick = () => {
      if (audio) { audio.pause(); audio.currentTime = 0; }
      showToast("Music stopped");
    };
    controls.appendChild(next);
    controls.appendChild(stop);
    frag.appendChild(controls);
    musicTracks.forEach((t, i) => {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `<span class="meta"><b>${t.title}</b><div class="d">${t.id || ""}</div></span>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "act";
      btn.textContent = "Play";
      btn.onclick = () => {
        playTrack(i);
        const n = bodyEl.querySelector("#m-now");
        if (n) n.textContent = t.title;
      };
      row.appendChild(btn);
      frag.appendChild(row);
    });
    bodyEl.appendChild(frag);
  }, features.music !== false);

  // ── Shop ──
  addBtn("🏪 Shop", async () => {
    openPanel("Aurora Shop", "Tokens · same economy as 2D", "<p class='sub'>Loading shop…</p>");
    let items = [];
    let walletNote = "";
    try {
      const data = await campClient.fetchShop();
      items = data.items || data.catalog || data || [];
      if (!Array.isArray(items)) items = [];
      try {
        const w = await fetch(`/api/firmament/wallet?visitor_id=${encodeURIComponent(campClient.getVisitorId())}`, { cache: "no-store" })
          .then((r) => r.json());
        if (w && (w.tokens != null || w.balance != null)) {
          walletNote = ` · balance ${w.tokens ?? w.balance} tok`;
        }
      } catch (_) {}
    } catch (err) {
      items = FALLBACK_SHOP.slice();
      walletNote = " · offline catalog";
      logLine("Shop", `API offline, showing fallback (${err.message})`);
    }
    if (!items.length) items = FALLBACK_SHOP.slice();
    subEl.textContent = `${items.length} items${walletNote}`;
    bodyEl.innerHTML = "";
    items.forEach((it) => {
      const row = document.createElement("div");
      row.className = "row";
      const name = it.name || it.id || "item";
      const price = it.cost ?? it.price ?? "?";
      row.innerHTML = `<span class="meta"><b>${it.emoji || "✦"} ${name}</b><div class="d">${it.desc || it.description || ""} · <span class="ok">${price} tok</span></div></span>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "act";
      btn.textContent = "Buy";
      btn.onclick = async () => {
        try {
          const r = await campClient.buyShopItem(it.id || it.item_id);
          const msg = r.message || r.detail || `Bought ${name}`;
          showToast(typeof msg === "string" ? msg : `Bought ${name}`);
          logLine("Shop", typeof msg === "string" ? msg : `Bought ${name}`);
        } catch (err) {
          showToast(err.message || "Buy failed");
          logLine("Shop", err.message || "Buy failed");
        }
      };
      row.appendChild(btn);
      bodyEl.appendChild(row);
    });
  }, features.shop !== false);

  // ── Lucid TV ──
  async function renderTvChannel(data) {
    const ch = data?.channel || data || {};
    const title = ch.title || ch.name || "Lucid channel";
    const thought = ch.thought || ch.subtitle || ch.text || "Static with personality.";
    const embed = ch.embed || (ch.video_id ? `https://www.youtube-nocookie.com/embed/${ch.video_id}?autoplay=0` : "");
    const watch = ch.watch || (ch.video_id ? `https://www.youtube.com/watch?v=${ch.video_id}` : "");
    bodyEl.innerHTML = "";
    const head = document.createElement("p");
    head.innerHTML = `<b>${escapeHtml(title)}</b> ${ch.emoji || "📺"}`;
    bodyEl.appendChild(head);
    const th = document.createElement("p");
    th.style.color = "#c4b5fd";
    th.textContent = thought;
    bodyEl.appendChild(th);
    if (embed) {
      const iframe = document.createElement("iframe");
      iframe.className = "tv-frame";
      iframe.src = embed;
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      bodyEl.appendChild(iframe);
    }
    if (watch) {
      const a = document.createElement("p");
      a.innerHTML = `<a href="${watch}" target="_blank" rel="noopener">Open on YouTube ↗</a>`;
      bodyEl.appendChild(a);
    }
    const next = document.createElement("button");
    next.type = "button";
    next.className = "act";
    next.textContent = "Another channel";
    next.onclick = async () => {
      try {
        const d2 = await campClient.fetchLucidFeed("random");
        await renderTvChannel(d2);
        logLine("Lucid TV", (d2.channel || d2).title || "channel");
      } catch (err) {
        bodyEl.innerHTML += `<p class="err">${escapeHtml(err.message)}</p>`;
      }
    };
    bodyEl.appendChild(next);
    logLine("Lucid TV", `${title} — ${thought}`);
  }

  addBtn("📺 Lucid TV", async () => {
    openPanel("Lucid Mind TV", "Dream channels · real embeds", "<p class='sub'>Tuning…</p>");
    try {
      const data = await campClient.fetchLucidFeed("random");
      await renderTvChannel(data);
      showToast("📺 Lucid TV");
    } catch (err) {
      bodyEl.innerHTML = `<p class="err">TV offline: ${escapeHtml(err.message)}</p>
        <p>Server needs /api/firmament/lucid-feed — restart Luna server.</p>`;
    }
  }, features.lucid_tv !== false);

  // ── Club ──
  addBtn("💃 Club", async () => {
    openPanel("Aurora Velvet", "Neon · dance optional", `
      <p>Bass under the aurora. Agents with high social/energy may wander over.</p>
      <div class="row"><span class="meta"><b>Drop vibe</b><div class="d">AI line from the club</div></span>
      <button type="button" class="act" id="club-vibe">Vibe</button></div>
      <div class="row"><span class="meta"><b>Play club track</b><div class="d">Loud and Clear</div></span>
      <button type="button" class="act" id="club-music">Play</button></div>
      <div id="club-log" class="sub"></div>
    `);
    showToast("💃 Aurora Velvet");
    bodyEl.querySelector("#club-vibe").onclick = async () => {
      const log = bodyEl.querySelector("#club-log");
      try {
        const ev = await campClient.useStructure("aurora-velvet");
        const line = (ev.lines && ev.lines[0]) || null;
        if (log) log.textContent = line ? `${line.name}: ${line.text}` : (ev.message || "Vibe dropped");
        campClient.applyCampEvent(ev, {
          onNarration: (m) => { showToast(m); logLine("Club", m); },
          onLine: (ln) => { logLine(ln.name, ln.text); showSpeech(ln.agent_id, ln.text, 8000); },
        });
      } catch (err) {
        if (log) log.innerHTML = `<span class="err">${escapeHtml(err.message)}</span>`;
      }
    };
    bodyEl.querySelector("#club-music").onclick = () => {
      const i = musicTracks.findIndex((t) => /loud/i.test(t.title));
      playTrack(i >= 0 ? i : 1);
    };
  }, features.club !== false);

  // ── X Pulse ──
  addBtn("𝕏 Pulse", async () => {
    openPanel("X Pulse", "Headline energy for banter", "<p class='sub'>Fetching pulse…</p>");
    try {
      const data = await campClient.fetchXPulse(true);
      const items = data.items || data.headlines || data.signals || [];
      const lines = [];
      if (data.hint) lines.push({ text: data.hint, source: "hint" });
      if (Array.isArray(items)) {
        for (const h of items.slice(0, 12)) {
          if (typeof h === "string") lines.push({ text: h, source: "" });
          else lines.push({
            text: h.text || h.title || h.headline || "",
            source: h.source || "",
            url: h.url || "",
          });
        }
      }
      if (!lines.length) {
        FALLBACK_PULSE.forEach((t) => lines.push({ text: t, source: "camp" }));
      }
      bodyEl.innerHTML = "";
      if (data.label) {
        const lab = document.createElement("p");
        lab.className = "ok";
        lab.textContent = `${data.label} · ${data.count ?? lines.length} signals`;
        bodyEl.appendChild(lab);
      }
      lines.forEach((L) => {
        if (!L.text) return;
        const div = document.createElement("div");
        div.className = "pulse-line";
        if (L.url) {
          div.innerHTML = `${escapeHtml(L.text)} ${L.source ? `<small>(${escapeHtml(L.source)})</small>` : ""} — <a href="${L.url}" target="_blank" rel="noopener">link</a>`;
        } else {
          div.textContent = L.text + (L.source ? ` (${L.source})` : "");
        }
        bodyEl.appendChild(div);
      });
      const banterBtn = document.createElement("button");
      banterBtn.type = "button";
      banterBtn.className = "act";
      banterBtn.style.marginTop = "12px";
      banterBtn.textContent = "Banter this pulse";
      banterBtn.onclick = async () => {
        const topic = lines.find((l) => l.source !== "hint")?.text || lines[0]?.text || "today's headlines";
        try {
          const ev = await campClient.campBanter({
            topic: `riff on this headline in character: ${topic}`,
            rounds: 2,
          });
          campClient.applyCampEvent(ev, {
            onLine: (ln) => { logLine(ln.name, ln.text); showSpeech(ln.agent_id, ln.text, 9000); },
          });
          showToast("💬 Pulse banter");
        } catch (err) {
          showToast(err.message);
        }
      };
      bodyEl.appendChild(banterBtn);
      logLine("Pulse", lines.find((l) => l.source !== "hint")?.text || "Pulse checked");
      showToast("𝕏 Pulse");
    } catch (err) {
      bodyEl.innerHTML = `<p class="err">${escapeHtml(err.message)}</p>`;
      FALLBACK_PULSE.forEach((t) => {
        const div = document.createElement("div");
        div.className = "pulse-line";
        div.textContent = t;
        bodyEl.appendChild(div);
      });
    }
  }, features.x_pulse !== false);

  // Hot tools live on the always-visible center strip (feat-hotbar) above.

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return {
    playMusic: () => playTrack(trackIndex),
    openShop: () => {
      const btns = dock.querySelectorAll("button");
      for (const b of btns) {
        if (b.textContent.includes("Shop")) { b.click(); break; }
      }
    },
    dispose: () => root.remove(),
  };
}
