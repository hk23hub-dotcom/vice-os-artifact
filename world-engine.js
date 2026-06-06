// world-engine.js — renders a world manifest into a parallax scene with
// clickable hotspots, a detail panel, an in-world blueprint viewer, and
// app deep-links. Browser-only. API: window.WorldEngine.open(manifest, opts) / .close()
(function () {
  'use strict';
  var stage, onExitCb, pointerHandler, accent;

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

    // ambient background (parallax depth 0.02)
    var bg = el('div', 'position:absolute;inset:-6%;background:#000 center/cover no-repeat;' +
      'background-image:url(' + manifest.ambient + ');filter:brightness(.62) contrast(1.05);' +
      'transition:transform .15s ease-out;', stage);
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
    var img = el('img', 'max-width:90%;max-height:78%;object-fit:contain;border:1px solid #222;', lb);
    img.src = g.file;
    if (g.title) el('div', "font-family:'Space Mono',monospace;font-size:11px;letter-spacing:3px;color:#888;", lb).textContent = g.title;
    var cl = el('button', "position:absolute;top:18px;right:20px;font-family:'Space Mono',monospace;font-size:11px;" +
      'letter-spacing:2px;background:none;border:1px solid ' + accent + ';color:' + accent + ';padding:9px 16px;cursor:pointer;', lb);
    cl.textContent = '✕ CLOSE'; cl.onclick = function () { lb.remove(); };
    lb.onclick = function (e) { if (e.target === lb) lb.remove(); };
  }

  function close() {
    if (pointerHandler) window.removeEventListener('pointermove', pointerHandler);
    pointerHandler = null;
    if (stage) stage.innerHTML = '';
    onExitCb();
  }

  window.WorldEngine = { open: open, close: close };
})();
