# Immersive Worlds — System + ViceGolfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a data-driven "World System" so entering a planet can open a bespoke immersive scene, and ship World 1 — ViceGolfer "The Golf House" — as the prototype.

**Architecture:** A pure helper module (`world-utils.js`) holds the world registry + manifest validation (node-testable). A DOM renderer (`world-engine.js`) turns a world manifest into a parallax scene with clickable hotspots, a detail panel, an in-world blueprint viewer, and app deep-links. The universe's `openFractalUniverse(project)` becomes an additive dispatcher: planets with a registered world open the world; all others fall through to the existing fractal graph unchanged.

**Tech Stack:** Vanilla JS, Canvas2D + DOM, `node:test` for pure logic, the existing `universe-preview` server (port 8765) for browser verification.

---

## File Structure

- **Create `world-utils.js`** — DOM-free: `WORLD_IDS`, `hasWorld(id)`, `validateWorldManifest(m)`. UMD export (browser `window.WorldUtils` + node `module.exports`). Mirrors the existing `quote-utils.js` pattern.
- **Create `tests/world-utils.test.mjs`** + **`tests/world-manifest.test.mjs`** — node tests.
- **Create `worlds/vicegolfer.json`** — the ViceGolfer world manifest (ambient bg + hotspots).
- **Create `world-engine.js`** — DOM renderer: `window.WorldEngine = { open(manifest, opts), close() }`. Parallax scene, hotspots, detail panel, blueprint iframe, deep-links.
- **Modify `hk23-universe.html`** — include the two scripts; add `#world-overlay` DOM + styles; add `openWorld(project)` / `closeWorld()`; rename the existing `openFractalUniverse` body to `openFractalUniverseRaw` and make `openFractalUniverse` a dispatcher.

Manifest hotspot schema (locked):
```json
{ "x": 0.32, "y": 0.55, "label": "SIMULATOR BAY", "depth": 0.06,
  "blueprint": "golfteiner-blueprint.html",
  "detail": { "title": "GOLFTEINER MODEL 1", "desc": "...", "stats": [{"l":"SIZE","v":"6058mm"}] },
  "appLink": "https://vicegolfer.vercel.app/play" }
```
`blueprint` and `appLink` are optional; `x/y` are 0..1 fractions of the viewport; `depth` (optional, default 0.06) drives parallax strength.

---

## Task 1: `world-utils.js` (TDD)

**Files:**
- Create: `world-utils.js`
- Test: `tests/world-utils.test.mjs`

- [ ] **Step 1: Write the failing test** — Create `tests/world-utils.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const W = require('../world-utils.js');

test('hasWorld knows registered worlds', () => {
  assert.equal(W.hasWorld('vicegolfer'), true);
  assert.equal(W.hasWorld('rugbyvice'), false);
  assert.equal(W.hasWorld(undefined), false);
});

test('validateWorldManifest passes a clean manifest', () => {
  const m = { id:'vicegolfer', title:'THE GOLF HOUSE', accent:'#AAFF00',
    ambient:'assets/golfteiner/golfteiner-render-1.png',
    hotspots:[{ x:0.3, y:0.5, label:'BAY', detail:{ title:'X', desc:'y' } }] };
  assert.deepEqual(W.validateWorldManifest(m), []);
});

test('validateWorldManifest flags missing fields + bad coords', () => {
  const m = { id:'', accent:'#fff', hotspots:[
    { x:2, y:0.5, label:'A' },           // x out of range, missing detail
    { x:0.2, y:0.5, detail:{title:'t',desc:'d'} } // missing label
  ] };
  const e = W.validateWorldManifest(m);
  assert.ok(e.some(s=>s.includes('id')));
  assert.ok(e.some(s=>s.includes('title')));
  assert.ok(e.some(s=>s.includes('x out of range')));
  assert.ok(e.some(s=>s.includes('missing label')));
  assert.ok(e.some(s=>s.includes('missing detail')));
});
```

- [ ] **Step 2: Run to verify it fails** — `cd /Users/hk23neo/vice-os-artifact && node --test tests/world-utils.test.mjs` → FAIL (Cannot find module).

- [ ] **Step 3: Write `world-utils.js`**:

```js
// world-utils.js — DOM-free world registry + manifest validation.
// Consumed by hk23-universe.html, world-engine.js, and node tests.
(function (root) {
  'use strict';

  // Planets that have a bespoke immersive world. Others use the fractal graph.
  var WORLD_IDS = ['vicegolfer'];

  function hasWorld(id) { return WORLD_IDS.indexOf(id) !== -1; }

  function validateWorldManifest(m) {
    var e = [];
    if (!m || typeof m !== 'object') return ['manifest must be an object'];
    if (!m.id) e.push('manifest missing id');
    if (!m.title) e.push('manifest missing title');
    if (!m.accent) e.push('manifest missing accent');
    if (!Array.isArray(m.hotspots)) { e.push('manifest hotspots must be an array'); return e; }
    m.hotspots.forEach(function (h, i) {
      var ref = h && h.label ? h.label : '#' + i;
      if (typeof h.x !== 'number' || h.x < 0 || h.x > 1) e.push('hotspot[' + ref + '] x out of range');
      if (typeof h.y !== 'number' || h.y < 0 || h.y > 1) e.push('hotspot[' + ref + '] y out of range');
      if (!h.label) e.push('hotspot[' + i + '] missing label');
      if (!h.detail || !h.detail.title) e.push('hotspot[' + ref + '] missing detail.title');
    });
    return e;
  }

  var api = { WORLD_IDS: WORLD_IDS, hasWorld: hasWorld, validateWorldManifest: validateWorldManifest };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WorldUtils = api;
})(typeof window !== 'undefined' ? window : this);
```

- [ ] **Step 4: Run to verify it passes** — `node --test tests/world-utils.test.mjs` → `# pass 3`.

- [ ] **Step 5: Commit**:
```bash
cd /Users/hk23neo/vice-os-artifact
git add world-utils.js tests/world-utils.test.mjs
git commit -m "feat: world-utils — world registry + manifest validation + tests"
```

---

## Task 2: `worlds/vicegolfer.json` manifest (TDD)

**Files:**
- Create: `worlds/vicegolfer.json`
- Test: `tests/world-manifest.test.mjs`

- [ ] **Step 1: Write the failing test** — Create `tests/world-manifest.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const W = require('../world-utils.js');
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const m = JSON.parse(readFileSync(join(root, 'worlds', 'vicegolfer.json'), 'utf8'));

test('vicegolfer manifest is valid', () => {
  assert.deepEqual(W.validateWorldManifest(m), []);
});

test('every referenced image + blueprint file exists', () => {
  if (m.ambient) assert.ok(existsSync(join(root, m.ambient)), 'missing ambient ' + m.ambient);
  (m.layers || []).forEach(l => assert.ok(existsSync(join(root, l.src)), 'missing layer ' + l.src));
  m.hotspots.forEach(h => {
    if (h.blueprint) assert.ok(existsSync(join(root, h.blueprint)), 'missing blueprint ' + h.blueprint);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test tests/world-manifest.test.mjs` → FAIL (ENOENT worlds/vicegolfer.json).

- [ ] **Step 3: Write `worlds/vicegolfer.json`** (uses existing assets + existing blueprints):

```json
{
  "id": "vicegolfer",
  "title": "THE GOLF HOUSE",
  "accent": "#AAFF00",
  "ambient": "assets/golfteiner/golfteiner-render-1.png",
  "layers": [],
  "hotspots": [
    { "x": 0.30, "y": 0.58, "label": "SIMULATOR BAY", "depth": 0.07,
      "blueprint": "golfteiner-blueprint.html",
      "detail": { "title": "GOLFTEINER · MODEL 1", "desc": "Modular golf container simulator. 4K short-throw projection, impact screen 3660×2110, rooftop deck lounge. Built as a product — replicable, sellable, licensable, franchisable.",
        "stats": [{"l":"FOOTPRINT","v":"6058×2438×2896mm"},{"l":"SCREEN","v":"3660×2110"},{"l":"DECK","v":"ROOFTOP"},{"l":"MODE","v":"PRODUCT"}] },
      "appLink": "https://vicegolfer.vercel.app/play" },
    { "x": 0.52, "y": 0.42, "label": "PUTTING LAB", "depth": 0.05,
      "blueprint": "dynamic-putting-lab-blueprint.html",
      "detail": { "title": "DYNAMIC PUTTING LAB · VICE P1", "desc": "Dual-axis motion platform with dynamic slope, real-time data and immersive visual feedback. 1 real hole + unlimited virtual.",
        "stats": [{"l":"SIZE","v":"8×12ft"},{"l":"SLOPE","v":"3% / 5%"},{"l":"ACTUATORS","v":"4 LINEAR"},{"l":"CONTROL","v":"TABLET"}] },
      "appLink": "https://vicegolfer.vercel.app/putting" },
    { "x": 0.72, "y": 0.62, "label": "OUTDOOR GREEN", "depth": 0.06,
      "blueprint": "putting-green-blueprint.html",
      "detail": { "title": "OUTDOOR PUTTING GREEN · ZONE 07", "desc": "16.63m² tour-grade outdoor green, 6 holes, layered turf/sand/base/drainage build. Not the Lab — the real-grass complement.",
        "stats": [{"l":"AREA","v":"16.63m²"},{"l":"HOLES","v":"6"},{"l":"BUILD","v":"4-LAYER"},{"l":"ZONE","v":"07"}] },
      "appLink": "https://vicegolfer.vercel.app/putting" },
    { "x": 0.16, "y": 0.40, "label": "PERFORMANCE DATA", "depth": 0.04,
      "detail": { "title": "PERFORMANCE DNA", "desc": "Your 5-axis golf radar built from real rounds: Driver, Irons, Short Game, Putting, Mental.",
        "stats": [{"l":"DRIVER","v":"78"},{"l":"IRONS","v":"65"},{"l":"SHORT","v":"82"},{"l":"PUTT","v":"71"}] },
      "appLink": "https://vicegolfer.vercel.app/dashboard" },
    { "x": 0.85, "y": 0.34, "label": "THE BUSINESS", "depth": 0.05,
      "detail": { "title": "GOLF HOUSE · BUSINESS", "desc": "Self-managed Golf House Simulator. Hourly sim rental, memberships, coaching, data sessions, events. Pioneer in its zone.",
        "stats": [{"l":"HOUR","v":"$50–60K CLP"},{"l":"MEMBER","v":"$170–300K"},{"l":"BREAK-EVEN","v":"6–8 MO"},{"l":"INVEST","v":"$30M CLP"}] } }
  ]
}
```

- [ ] **Step 4: Run to verify it passes** — `node --test tests/world-manifest.test.mjs` → `# pass 2`. (If a blueprint/asset path is wrong the test names it — fix the path.)

- [ ] **Step 5: Commit**:
```bash
cd /Users/hk23neo/vice-os-artifact
git add worlds/vicegolfer.json tests/world-manifest.test.mjs
git commit -m "feat: ViceGolfer world manifest (Golf House) + integrity test"
```

---

## Task 3: `world-engine.js` renderer

**Files:**
- Create: `world-engine.js`

- [ ] **Step 1: Create `world-engine.js`** (complete):

```js
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
      var dot = el('span', 'width:14px;height:14px;border-radius:50%;background:' + accent +
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

  function close() {
    if (pointerHandler) window.removeEventListener('pointermove', pointerHandler);
    pointerHandler = null;
    if (stage) stage.innerHTML = '';
    onExitCb();
  }

  window.WorldEngine = { open: open, close: close };
})();
```

- [ ] **Step 2: Syntax check** — Run:
```bash
cd /Users/hk23neo/vice-os-artifact
node --check world-engine.js && echo "world-engine.js OK"
```
Expected: `world-engine.js OK`.

- [ ] **Step 3: Commit**:
```bash
cd /Users/hk23neo/vice-os-artifact
git add world-engine.js
git commit -m "feat: world-engine — parallax scene renderer w/ hotspots, detail panel, blueprint viewer"
```

---

## Task 4: Wire the World System into the universe

**Files:**
- Modify: `hk23-universe.html`

- [ ] **Step 1: Include the two scripts** — In `hk23-universe.html`, find the line `<script src="quote-utils.js"></script>` and add immediately AFTER it:

```html
<script src="world-utils.js"></script>
<script src="world-engine.js"></script>
```

- [ ] **Step 2: Add the world overlay DOM + styles** — Find the `<canvas id="swarm-live-canvas"` line (near line 1401) and insert immediately BEFORE it:

```html
<div id="world-overlay" style="display:none;opacity:0;transition:opacity .5s;position:fixed;inset:0;z-index:250;background:#000;">
  <div id="world-stage" style="position:absolute;inset:0;overflow:hidden;"></div>
</div>
<style>@keyframes worldPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.6}}</style>
```

- [ ] **Step 3: Make `openFractalUniverse` a dispatcher** — Find this exact line (near line 4500):

```js
function openFractalUniverse(project) {
  fractalStack = [{
```

Replace ONLY that function header line `function openFractalUniverse(project) {` with the dispatcher + the renamed raw function. I.e. change:

```js
function openFractalUniverse(project) {
  fractalStack = [{
```

to:

```js
function openFractalUniverse(project) {
  if (project && window.WorldUtils && WorldUtils.hasWorld(project.id)) { openWorld(project); return; }
  openFractalUniverseRaw(project);
}

function openFractalUniverseRaw(project) {
  fractalStack = [{
```

(Everything below the original header — the `fractalStack = [{ ... startFractalAnimation(); }` body — now belongs to `openFractalUniverseRaw`. You are only inserting the dispatcher above it and renaming.)

- [ ] **Step 4: Add `openWorld` / `closeWorld`** — Immediately AFTER the new `openFractalUniverse` dispatcher (before `openFractalUniverseRaw`), add:

```js
function openWorld(project) {
  fetch('worlds/' + project.id + '.json')
    .then(function (r) { return r.json(); })
    .then(function (m) {
      var ov = document.getElementById('world-overlay');
      ov.style.display = 'block';
      requestAnimationFrame(function () { ov.style.opacity = '1'; });
      WorldEngine.open(m, { onExit: closeWorld });
    })
    .catch(function () { openFractalUniverseRaw(project); }); // manifest missing → fractal fallback
}

function closeWorld() {
  var ov = document.getElementById('world-overlay');
  ov.style.opacity = '0';
  setTimeout(function () { ov.style.display = 'none'; }, 500);
}
```

- [ ] **Step 5: Syntax check**:
```bash
cd /Users/hk23neo/vice-os-artifact
node -e "const h=require('fs').readFileSync('hk23-universe.html','utf8');const s=h.match(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/g)||[];let e=0;s.forEach((x,i)=>{try{new Function(x.replace(/<\/?script[^>]*>/g,''))}catch(err){console.log('ERR',i,err.message);e++}});console.log(e?'FAIL':'OK '+s.length+' scripts')"
```
Expected: `OK 1 scripts`.

- [ ] **Step 6: Commit**:
```bash
cd /Users/hk23neo/vice-os-artifact
git add hk23-universe.html
git commit -m "feat(universe): World System dispatcher — open ViceGolfer world, fractal fallback for the rest"
```

---

## Task 5: Integration verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**
```bash
cd /Users/hk23neo/vice-os-artifact && node --test tests/*.mjs 2>&1 | grep -E "ℹ (tests|pass|fail)"
```
Expected: `fail 0`.

- [ ] **Step 2: Browser verification** — With the `universe-preview` server running (port 8765), via preview eval:
  1. Navigate to `http://localhost:8765/hk23-universe`.
  2. Run: `goTo('map'); openFractalUniverse(PROJECTS.find(p=>p.id==='vicegolfer'))`.
  3. Assert: `document.getElementById('world-overlay').style.display === 'block'`, `document.getElementById('world-stage').querySelectorAll('button').length >= 6` (5 hotspots + EXIT), and the console has no errors.
  4. Regression: `closeWorld(); openFractalUniverse(PROJECTS.find(p=>p.id==='cryptovice'))` → the fractal overlay (`#fractal-overlay`) shows (`display:block`), confirming non-world planets are unaffected.
  5. Click a hotspot via eval (`document.querySelector('#world-stage button:not([style*="EXIT"])')... ` or call `showDetail` indirectly) and confirm `#world-detail` appears; confirm a `VIEW BLUEPRINT` button loads `#world-blueprint` iframe.

- [ ] **Step 3: Commit (if any fixes)**:
```bash
cd /Users/hk23neo/vice-os-artifact
git add -A && git commit -m "chore: immersive worlds integration verified" || echo "nothing to commit"
```

---

## Notes & deferred
- **Mothership** and **Arte World** are out of scope here (separate passes once their Midjourney art is processed to web size into `assets/worlds/<id>/`). Adding a world later = drop its `assets/worlds/<id>/`, author `worlds/<id>.json`, and add its id to `WORLD_IDS` in `world-utils.js`.
- **Parallax depth** uses pointer movement; gyro/mobile tilt is deferred.
- **Layered foreground PNGs** (transparent cutouts) would deepen the parallax; v1 uses the ambient render + hotspot parallax, which is enough to prove the pattern. Drop cutout PNGs into `worlds/vicegolfer.json` `layers[]` later.
- The ViceGolfer ambient currently uses `assets/golfteiner/golfteiner-render-1.png`; swap for a wider Golf House composite when available.
