// world-engine.js — renders a world manifest into a parallax scene with
// clickable hotspots, a detail panel, an in-world blueprint viewer, and
// app deep-links. Browser-only. API: window.WorldEngine.open(manifest, opts) / .close()
(function () {
  'use strict';
  var stage, onExitCb, pointerHandler, accent, stationAnimId, stationResize;

  function el(tag, css, parent) {
    var d = document.createElement(tag);
    if (css) d.style.cssText = css;
    if (parent) parent.appendChild(d);
    return d;
  }

  function open(manifest, opts) {
    opts = opts || {};
    onExitCb = opts.onExit || function () {};
    accent = manifest.accent || '#AAFF00';
    stage = document.getElementById('world-stage');
    stage.innerHTML = '';

    if (Array.isArray(manifest.gallery)) { openGallery(manifest); return; }
    if (manifest.station && Array.isArray(manifest.station.modules)) { openStation(manifest); return; }

    // ambient background (parallax depth 0.02) — image if given, else themed gradient
    var bgStyle = manifest.ambient
      ? 'background:#000 center/cover no-repeat;background-image:url(' + manifest.ambient + ');filter:brightness(.62) contrast(1.05);'
      : 'background:radial-gradient(circle at 50% 32%, ' + accent + '22 0%, #06060a 62%);';
    var bg = el('div', 'position:absolute;inset:-6%;' + bgStyle + 'transition:transform .15s ease-out;', stage);
    bg.dataset.depth = '0.02';
    // dark vignette for mood + legibility
    el('div', 'position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 40%,transparent 30%,rgba(0,0,0,.78) 100%);pointer-events:none;', stage);

    // optional parallax layers
    (manifest.layers || []).forEach(function (l) {
      var ly = el('div', 'position:absolute;inset:-6%;background:center/cover no-repeat;' +
        'background-image:url(' + l.src + ');transition:transform .15s ease-out;pointer-events:none;', stage);
      ly.dataset.depth = String(l.depth || 0.08);
    });

    // HUD: title + EXIT
    var hud = el('div', 'position:absolute;top:0;left:0;right:0;display:flex;align-items:center;' +
      'justify-content:space-between;padding:22px 26px;z-index:5;pointer-events:none;', stage);
    el('div', "font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:20px;letter-spacing:1px;color:#fff;", hud)
      .textContent = manifest.title;
    var exit = el('button', "pointer-events:auto;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:2px;" +
      'background:none;border:1px solid ' + accent + '66;color:' + accent + ';padding:9px 16px;cursor:pointer;', hud);
    exit.textContent = '✕ EXIT';
    exit.onclick = close;

    // hotspots
    manifest.hotspots.forEach(function (h) {
      var hs = el('button', 'position:absolute;transform:translate(-50%,-50%);z-index:4;cursor:pointer;' +
        'background:none;border:none;display:flex;flex-direction:column;align-items:center;gap:7px;' +
        'transition:transform .15s ease-out;', stage);
      hs.style.left = (h.x * 100) + '%';
      hs.style.top = (h.y * 100) + '%';
      hs.dataset.depth = String(h.depth || 0.06);
      el('span', 'width:14px;height:14px;border-radius:50%;background:' + accent +
        ';box-shadow:0 0 0 4px ' + accent + '33,0 0 22px ' + accent + ';animation:worldPulse 2s infinite;', hs);
      el('span', "font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2px;color:#fff;" +
        'background:rgba(0,0,0,.55);padding:3px 8px;white-space:nowrap;', hs).textContent = h.label;
      hs.onclick = function () { showDetail(h); };
    });

    // parallax on pointer move
    pointerHandler = function (ev) {
      var cx = (ev.clientX / window.innerWidth - 0.5);
      var cy = (ev.clientY / window.innerHeight - 0.5);
      stage.querySelectorAll('[data-depth]').forEach(function (node) {
        var d = parseFloat(node.dataset.depth) * 60;
        var base = node.tagName === 'BUTTON' ? 'translate(-50%,-50%) ' : '';
        node.style.transform = base + 'translate(' + (-cx * d) + 'px,' + (-cy * d) + 'px)';
      });
    };
    window.addEventListener('pointermove', pointerHandler);
  }

  function showDetail(h) {
    closeDetail();
    var panel = el('div', 'position:absolute;right:26px;bottom:26px;width:340px;z-index:8;' +
      'background:rgba(7,7,12,.94);border:1px solid ' + accent + '55;padding:22px;', stage);
    panel.id = 'world-detail';
    el('div', "font-family:'Space Mono',monospace;font-size:9px;letter-spacing:3px;color:" + accent + ";margin-bottom:8px;", panel)
      .textContent = '◈ ' + h.label;
    el('div', "font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:18px;color:#fff;margin-bottom:10px;", panel)
      .textContent = h.detail.title;
    el('div', "font-family:'Space Grotesk',sans-serif;font-size:13px;line-height:1.55;color:#9a9aa8;", panel)
      .textContent = h.detail.desc || '';
    if (h.detail.stats && h.detail.stats.length) {
      var grid = el('div', 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;', panel);
      h.detail.stats.forEach(function (s) {
        var cell = el('div', 'border:1px solid #1c1c26;padding:8px 10px;', grid);
        el('div', "font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px;color:" + accent + ";", cell).textContent = s.v;
        el('div', "font-family:'Space Mono',monospace;font-size:7px;letter-spacing:2px;color:#666;margin-top:3px;", cell).textContent = s.l;
      });
    }
    var row = el('div', 'display:flex;gap:8px;margin-top:18px;', panel);
    if (h.blueprint) {
      var bp = el('button', "flex:1;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:2px;" +
        'background:none;border:1px solid ' + accent + '55;color:' + accent + ';padding:11px;cursor:pointer;', row);
      bp.textContent = 'VIEW BLUEPRINT';
      bp.onclick = function () { showBlueprint(h.blueprint); };
    }
    if (h.appLink) {
      var app = el('a', "flex:1;text-align:center;text-decoration:none;font-family:'Space Mono',monospace;font-size:10px;" +
        'letter-spacing:2px;background:' + accent + ';color:#080808;padding:11px;', row);
      app.textContent = 'ENTER APP →';
      app.href = h.appLink; app.target = '_blank';
    }
    var cl = el('div', 'position:absolute;top:10px;right:14px;color:#555;cursor:pointer;font-size:14px;', panel);
    cl.textContent = '✕'; cl.onclick = closeDetail;
  }

  function closeDetail() { var d = document.getElementById('world-detail'); if (d) d.remove(); }

  function showBlueprint(src) {
    closeBlueprint();
    var wrap = el('div', 'position:absolute;inset:0;z-index:12;background:rgba(0,0,0,.92);', stage);
    wrap.id = 'world-blueprint';
    var cl = el('button', "position:absolute;top:18px;right:20px;z-index:2;font-family:'Space Mono',monospace;" +
      'font-size:11px;letter-spacing:2px;background:none;border:1px solid ' + accent + ';color:' + accent + ';padding:9px 16px;cursor:pointer;', wrap);
    cl.textContent = '✕ CLOSE'; cl.onclick = closeBlueprint;
    var f = el('iframe', 'width:100%;height:100%;border:none;', wrap);
    f.src = src;
  }
  function closeBlueprint() { var b = document.getElementById('world-blueprint'); if (b) b.remove(); }

  // Gallery world: a scrollable wall of art over a dark backdrop + lightbox.
  function openGallery(manifest) {
    el('div', 'position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 0%,#14060a 0%,#000 70%);', stage);

    var scroll = el('div', 'position:absolute;inset:0;overflow-y:auto;padding:96px 26px 60px;', stage);
    var grid = el('div', 'max-width:1200px;margin:0 auto;display:grid;gap:14px;' +
      'grid-template-columns:repeat(auto-fill,minmax(180px,1fr));', scroll);

    manifest.gallery.forEach(function (g) {
      var cell = el('button', 'border:1px solid #1c1c26;background:#0a0a0e;cursor:pointer;padding:0;' +
        'aspect-ratio:1/1;overflow:hidden;position:relative;transition:border-color .15s,transform .15s;', grid);
      cell.onmouseenter = function () { cell.style.borderColor = (g.color || accent); cell.style.transform = 'scale(1.02)'; };
      cell.onmouseleave = function () { cell.style.borderColor = '#1c1c26'; cell.style.transform = 'scale(1)'; };
      var img = el('img', 'width:100%;height:100%;object-fit:cover;display:block;', cell);
      img.src = g.file; img.loading = 'lazy';
      if (g.forSale) {
        el('span', 'position:absolute;top:7px;right:7px;font-family:\'Space Mono\',monospace;font-size:8px;' +
          'letter-spacing:1px;background:' + accent + ';color:#080808;padding:2px 6px;font-weight:700;', cell)
          .textContent = '$' + g.price;
      }
      cell.onclick = function () { showLightbox(g); };
    });

    // HUD over the gallery
    var hud = el('div', 'position:absolute;top:0;left:0;right:0;display:flex;align-items:center;' +
      'justify-content:space-between;padding:22px 26px;z-index:5;pointer-events:none;' +
      'background:linear-gradient(#000 30%,transparent);', stage);
    el('div', "font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:20px;letter-spacing:1px;color:#fff;", hud)
      .textContent = manifest.title;
    var exit = el('button', "pointer-events:auto;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:2px;" +
      'background:none;border:1px solid ' + accent + '66;color:' + accent + ';padding:9px 16px;cursor:pointer;', hud);
    exit.textContent = '✕ EXIT';
    exit.onclick = close;
  }

  function showLightbox(g) {
    var lb = el('div', 'position:absolute;inset:0;z-index:14;background:rgba(0,0,0,.93);' +
      'display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:40px;', stage);
    var img = el('img', 'max-width:90%;max-height:' + (g.forSale ? '66%' : '78%') + ';object-fit:contain;border:1px solid #222;', lb);
    img.src = g.file;
    if (g.forSale) {
      var shop = el('div', 'text-align:center;max-width:560px;', lb);
      el('div', "font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14px;color:#cfcfcf;line-height:1.4;", shop)
        .textContent = g.listingTitle || g.title;
      var row = el('div', 'display:flex;align-items:center;justify-content:center;gap:14px;margin-top:12px;', shop);
      el('div', "font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:22px;color:" + accent + ";", row)
        .textContent = '$' + g.price;
      el('div', "font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2px;color:#666;", row)
        .textContent = g.type || 'DIGITAL PRINT';
      var btn = el('a', "display:inline-block;margin-top:14px;text-decoration:none;font-family:'Space Mono',monospace;" +
        'font-size:11px;letter-spacing:2px;background:' + accent + ';color:#080808;padding:11px 22px;', shop);
      if (g.etsyUrl) { btn.textContent = 'VIEW ON ETSY →'; btn.href = g.etsyUrl; btn.target = '_blank'; }
      else { btn.textContent = 'PUBLISHING SOON'; btn.style.opacity = '0.55'; btn.style.cursor = 'default'; btn.href = 'javascript:void(0)'; }
    } else if (g.title) {
      el('div', "font-family:'Space Mono',monospace;font-size:11px;letter-spacing:3px;color:#888;", lb).textContent = g.title;
    }
    // Turn this piece into universe swarm art
    if (typeof window !== 'undefined' && window.swarmFromImage) {
      var sw = el('button', "font-family:'Space Mono',monospace;font-size:10px;letter-spacing:2px;" +
        'background:none;border:1px solid ' + accent + ';color:' + accent + ';padding:10px 20px;cursor:pointer;margin-top:6px;', lb);
      sw.textContent = '◉ SWARM THIS';
      sw.onclick = function () { window.swarmFromImage(g.file); };
    }
    var cl = el('button', "position:absolute;top:18px;right:20px;font-family:'Space Mono',monospace;font-size:11px;" +
      'letter-spacing:2px;background:none;border:1px solid ' + accent + ';color:' + accent + ';padding:9px 16px;cursor:pointer;', lb);
    cl.textContent = '✕ CLOSE'; cl.onclick = function () { lb.remove(); };
    lb.onclick = function (e) { if (e.target === lb) lb.remove(); };
  }

  // ── Mothership: isometric neon Agent Station ──
  function openStation(manifest) {
    var st = manifest.station;
    var canvas = el('canvas', 'position:absolute;inset:0;width:100%;height:100%;display:block;', stage);
    var ctx = canvas.getContext('2d');
    var W, H, ox, oy;
    var TW = 130, TH = 66, ELEV = 46;
    var grid = st.grid || [5, 5];

    function proj(gx, gy) {
      return { x: ox + (gx - gy) * TW / 2, y: oy + (gx + gy - (grid[0] + grid[1]) / 2 + 1) * TH / 2 };
    }
    function resize() {
      W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight;
      ox = W / 2; oy = H * 0.30;
    }
    resize();
    stationResize = resize; window.addEventListener('resize', stationResize);

    // starfield
    var stars = [];
    for (var i = 0; i < 140; i++) stars.push({ x: Math.random(), y: Math.random(), a: 0.1 + Math.random() * 0.5, s: Math.random() * 1.4 + 0.3 });

    function diamond(p, w, h) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - h / 2); ctx.lineTo(p.x + w / 2, p.y);
      ctx.lineTo(p.x, p.y + h / 2); ctx.lineTo(p.x - w / 2, p.y); ctx.closePath();
    }
    function quad(a, b, c, d) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); }

    var t = 0;
    function frame() {
      t += 0.02;
      // space backdrop
      var g = ctx.createRadialGradient(W / 2, H * 0.25, 0, W / 2, H * 0.25, H);
      g.addColorStop(0, '#0b0b1e'); g.addColorStop(1, '#04040a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      stars.forEach(function (s) {
        var tw = 0.5 + 0.5 * Math.sin(t * 1.5 + s.x * 30);
        ctx.fillStyle = 'rgba(255,255,255,' + (s.a * tw).toFixed(3) + ')';
        ctx.fillRect(s.x * W, s.y * H, s.s, s.s);
      });

      // base grid (faint glowing diamonds)
      for (var gx = 0; gx < grid[0]; gx++) for (var gy = 0; gy < grid[1]; gy++) {
        var p = proj(gx, gy);
        diamond(p, TW, TH);
        ctx.strokeStyle = 'rgba(99,102,241,0.14)'; ctx.lineWidth = 1; ctx.stroke();
      }

      // modules (raised neon blocks), back-to-front
      var mods = st.modules.slice().sort(function (a, b) { return (a.gx + a.gy) - (b.gx + b.gy); });
      mods.forEach(function (m, idx) {
        var col = m.color || accent;
        var float = Math.sin(t + idx) * 4;
        var p = proj(m.gx, m.gy); p.y += float;
        var top = { x: p.x, y: p.y - ELEV };
        var topL = { x: p.x - TW / 2, y: p.y - ELEV }, topR = { x: p.x + TW / 2, y: p.y - ELEV };
        var topB = { x: p.x, y: p.y - ELEV + TH / 2 }, gndB = { x: p.x, y: p.y + TH / 2 };
        var gndL = { x: p.x - TW / 2, y: p.y }, gndR = { x: p.x + TW / 2, y: p.y };
        // faces
        quad(topL, topB, gndB, gndL); ctx.fillStyle = hexA(col, 0.18); ctx.fill(); ctx.strokeStyle = hexA(col, 0.55); ctx.stroke();
        quad(topR, topB, gndB, gndR); ctx.fillStyle = hexA(col, 0.10); ctx.fill(); ctx.strokeStyle = hexA(col, 0.45); ctx.stroke();
        // top
        var pulse = m.status === 'active' ? (0.55 + 0.35 * Math.abs(Math.sin(t * 2))) : 0.32;
        diamond(top, TW, TH); ctx.fillStyle = hexA(col, pulse); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
        // glow core
        var cg = ctx.createRadialGradient(top.x, top.y, 0, top.x, top.y, 40);
        cg.addColorStop(0, hexA(col, 0.5)); cg.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(top.x, top.y, 40, 0, Math.PI * 2); ctx.fill();
        m._screen = top;
      });

      // position DOM labels over modules
      st.modules.forEach(function (m) {
        if (m._el && m._screen) { m._el.style.left = m._screen.x + 'px'; m._el.style.top = (m._screen.y - 30) + 'px'; }
      });

      stationAnimId = requestAnimationFrame(frame);
    }

    // DOM labels + click targets
    st.modules.forEach(function (m) {
      var col = m.color || accent;
      var b = el('button', 'position:absolute;transform:translate(-50%,-50%);z-index:4;cursor:pointer;background:none;' +
        'border:none;display:flex;flex-direction:column;align-items:center;gap:3px;white-space:nowrap;', stage);
      el('span', "font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1px;font-weight:700;color:" + col + ";" +
        'background:rgba(0,0,0,.55);padding:2px 7px;', b).textContent = m.label;
      el('span', "font-family:'Space Mono',monospace;font-size:7px;letter-spacing:1px;color:" + (m.status === 'active' ? col : '#666') + ";", b)
        .textContent = m.status === 'active' ? '● ACTIVE' : '○ IDLE';
      b.onclick = function () { showDetail({ label: m.label, blueprint: null, appLink: null, detail: { title: m.label + ' AGENT', desc: m.role, stats: [{ l: 'STATUS', v: m.status === 'active' ? 'ACTIVE 24/7' : 'IDLE · DOCKED' }, { l: 'DOCK', v: m.gx + '·' + m.gy }] } }); };
      m._el = b;
    });

    // HUD
    var hud = el('div', 'position:absolute;top:0;left:0;right:0;display:flex;align-items:center;' +
      'justify-content:space-between;padding:22px 26px;z-index:6;pointer-events:none;', stage);
    el('div', "font-family:'Space Grotesk',sans-serif;font-weight:900;font-size:20px;letter-spacing:1px;color:#fff;", hud)
      .textContent = manifest.title;
    var exit = el('button', "pointer-events:auto;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:2px;" +
      'background:none;border:1px solid ' + accent + '66;color:' + accent + ';padding:9px 16px;cursor:pointer;', hud);
    exit.textContent = '✕ EXIT'; exit.onclick = close;

    frame();
  }

  // hex + alpha → rgba string
  function hexA(hex, a) {
    var h = hex.replace('#', '');
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function close() {
    if (pointerHandler) window.removeEventListener('pointermove', pointerHandler);
    pointerHandler = null;
    if (stationAnimId) { cancelAnimationFrame(stationAnimId); stationAnimId = null; }
    if (stationResize) { window.removeEventListener('resize', stationResize); stationResize = null; }
    if (stage) stage.innerHTML = '';
    onExitCb();
  }

  window.WorldEngine = { open: open, close: close };
})();
