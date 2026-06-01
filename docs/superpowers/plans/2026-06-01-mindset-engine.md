# Mindset Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generate-and-approve social quote system whose cards link back into the Vice OS universe (deep-link to the matching planet + unlock the collectible), driven by a single `quotes.json` source.

**Architecture:** A DOM-free shared util (`quote-utils.js`) holds the link/validation logic and is consumed by three browser pages and by node tests. `quotes.json` is the single source of truth. The universe loads it to build its floating quote portals and gains a URL deep-link handler. A standalone `quote-studio.html` renders 1080×1080 cards (with a locally-generated QR so PNG export works) and a `daily.html` link-in-bio page lists posted quotes.

**Tech Stack:** Vanilla HTML/JS, Canvas 2D, `qrcode-generator@1.4.4` (CDN, client-side QR → same-origin data URL), node's built-in `node:test` for unit tests. Served locally via the existing `universe-preview` server (port 8765).

---

## File Structure

- **Create `quote-utils.js`** — DOM-free pure functions: `PLANET_IDS`, `quoteDeepLink()`, `resolveTargetKind()`, `validateQuotes()`. UMD-style export (works in browser via `window.QuoteUtils` and in node via `module.exports`). One responsibility: shared quote logic.
- **Create `tests/quote-utils.test.mjs`** — node unit tests for the util + a `quotes.json` integrity test.
- **Create `quotes.json`** — the single source of truth (array of quote objects).
- **Modify `hk23-universe.html`** — add `UNIVERSE_URL`, include `quote-utils.js`, load `quotes.json` into `QUOTE_PORTALS` (with inline fallback), extract `navigateToQuoteTarget()`, add `handleDeepLink()`.
- **Create `quote-studio.html`** — the card generator (queue → canvas card + QR → download PNG + copy caption).
- **Create `daily.html`** — link-in-bio landing page.

Quote id scheme: explicit `q01`, `q02`, … in `quotes.json` (replaces the old `'quote_'+i` generation). The collectible id IS the quote id.

---

## Task 1: Shared util `quote-utils.js` (TDD)

**Files:**
- Create: `quote-utils.js`
- Test: `tests/quote-utils.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/quote-utils.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const QU = require('../quote-utils.js');

test('quoteDeepLink builds universe URL with quote param', () => {
  assert.equal(
    QU.quoteDeepLink('https://hk23neo.github.io/vice-os', 'q01'),
    'https://hk23neo.github.io/vice-os/hk23-universe.html?quote=q01'
  );
});

test('quoteDeepLink trims trailing slashes on base', () => {
  assert.equal(
    QU.quoteDeepLink('https://x.dev/', 'q02'),
    'https://x.dev/hk23-universe.html?quote=q02'
  );
});

test('resolveTargetKind: planet vs zone', () => {
  assert.equal(QU.resolveTargetKind('vicegolfer'), 'planet');
  assert.equal(QU.resolveTargetKind('projects_pl'), 'planet');
  assert.equal(QU.resolveTargetKind('lore'), 'zone');
  assert.equal(QU.resolveTargetKind('ecosystem'), 'zone');
});

test('validateQuotes flags missing/duplicate/unknown', () => {
  const bad = [
    { id: 'q01', text: 'a', target: 'vicegolfer', rarity: 'common' },
    { id: 'q01', text: 'b', target: 'nope',       rarity: 'common' }, // dup id + bad target
    { id: 'q03', text: '',  target: 'lore',        rarity: 'mythic' }, // empty text + bad rarity
  ];
  const errs = QU.validateQuotes(bad);
  assert.ok(errs.some(e => e.includes('duplicate id')));
  assert.ok(errs.some(e => e.includes('unknown target')));
  assert.ok(errs.some(e => e.includes('missing text')));
  assert.ok(errs.some(e => e.includes('invalid rarity')));
});

test('validateQuotes passes a clean set', () => {
  const ok = [{ id: 'q01', text: 'a', target: 'vicegolfer', rarity: 'common' }];
  assert.deepEqual(QU.validateQuotes(ok), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/hk23neo/vice-os-artifact && node --test tests/quote-utils.test.mjs`
Expected: FAIL — `Cannot find module '../quote-utils.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `quote-utils.js`:

```js
// quote-utils.js — DOM-free helpers for the Mindset Engine.
// Consumed by hk23-universe.html, quote-studio.html, daily.html, and node tests.
(function (root) {
  'use strict';

  // Drillable project planets (vs. zone screens reached via goTo()).
  var PLANET_IDS = ['vicegolfer','rugbyvice','laiglesia','arteworld','projects_pl',
                    'cryptovice','hk23hub','teeclub','viceai','marketplace'];
  // Non-planet screens that quotes may target.
  var ZONE_IDS = ['lore','flow','agents','systems','ecosystem','arte','viceos','trap','gates'];

  function quoteDeepLink(baseUrl, quoteId) {
    var base = String(baseUrl).replace(/\/+$/, '');
    return base + '/hk23-universe.html?quote=' + encodeURIComponent(quoteId);
  }

  function resolveTargetKind(targetId, planetIds) {
    var ids = planetIds || PLANET_IDS;
    return ids.indexOf(targetId) !== -1 ? 'planet' : 'zone';
  }

  function validateQuotes(quotes, planetIds) {
    var errors = [];
    if (!Array.isArray(quotes)) return ['quotes must be an array'];
    var ids = planetIds || PLANET_IDS;
    var seen = {};
    quotes.forEach(function (q, i) {
      var ref = q && q.id ? q.id : '#' + i;
      if (!q.id) errors.push('quote[' + i + '] missing id');
      else if (seen[q.id]) errors.push('duplicate id: ' + q.id);
      else seen[q.id] = true;
      if (!q.text) errors.push('quote[' + ref + '] missing text');
      if (!q.target) errors.push('quote[' + ref + '] missing target');
      else if (ids.indexOf(q.target) === -1 && ZONE_IDS.indexOf(q.target) === -1)
        errors.push('quote[' + ref + '] unknown target: ' + q.target);
      if (['common','rare','legendary'].indexOf(q.rarity) === -1)
        errors.push('quote[' + ref + '] invalid rarity: ' + q.rarity);
    });
    return errors;
  }

  var api = { PLANET_IDS: PLANET_IDS, ZONE_IDS: ZONE_IDS,
              quoteDeepLink: quoteDeepLink, resolveTargetKind: resolveTargetKind,
              validateQuotes: validateQuotes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuoteUtils = api;
})(typeof window !== 'undefined' ? window : this);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/hk23neo/vice-os-artifact && node --test tests/quote-utils.test.mjs`
Expected: PASS — `# pass 5`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /Users/hk23neo/vice-os-artifact
git add quote-utils.js tests/quote-utils.test.mjs
git commit -m "feat: quote-utils shared helpers + tests"
```

---

## Task 2: `quotes.json` source of truth (TDD)

**Files:**
- Create: `quotes.json`
- Test: `tests/quotes-data.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/quotes-data.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const QU = require('../quote-utils.js');

const here = dirname(fileURLToPath(import.meta.url));
const quotes = JSON.parse(readFileSync(join(here, '..', 'quotes.json'), 'utf8'));

test('quotes.json is a non-empty array', () => {
  assert.ok(Array.isArray(quotes) && quotes.length >= 10);
});

test('quotes.json passes schema + target integrity', () => {
  assert.deepEqual(QU.validateQuotes(quotes), []);
});

test('every quote has header and hashtags', () => {
  for (const q of quotes) {
    assert.equal(typeof q.header, 'string');
    assert.ok(Array.isArray(q.hashtags) && q.hashtags.length > 0);
    assert.equal(typeof q.posted, 'boolean');
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/hk23neo/vice-os-artifact && node --test tests/quotes-data.test.mjs`
Expected: FAIL — `ENOENT ... quotes.json`.

- [ ] **Step 3: Write the data file**

Create `quotes.json` (migrates the 10 existing `QUOTE_PORTALS` + adds the Arnold Palmer reference quote):

```json
[
  { "id": "q01", "text": "Putting is like wisdom — partly a natural gift and partly the accumulation of experience.", "author": "Arnold Palmer", "target": "vicegolfer", "color": "#AAFF00", "rarity": "common", "header": "DAILY MINDSET", "hashtags": ["#golf","#mindset","#putting","#performance","#hk23","#viceos","#dailymindset"], "posted": true },
  { "id": "q02", "text": "Perfection lives in the putting.", "author": null, "target": "vicegolfer", "color": "#AAFF00", "rarity": "common", "header": "DAILY MINDSET", "hashtags": ["#golf","#putting","#hk23","#viceos","#dailymindset"], "posted": true },
  { "id": "q03", "text": "Own the kick zone.", "author": null, "target": "rugbyvice", "color": "#00F0FF", "rarity": "common", "header": "DAILY MINDSET", "hashtags": ["#rugby","#kicking","#hk23","#viceos","#dailymindset"], "posted": false },
  { "id": "q04", "text": "A vice is not a hobby.", "author": null, "target": "lore", "color": "#FFD200", "rarity": "rare", "header": "DAILY MINDSET", "hashtags": ["#mindset","#discipline","#hk23","#viceos","#dailymindset"], "posted": false },
  { "id": "q05", "text": "The mine never lies.", "author": null, "target": "laiglesia", "color": "#FFD200", "rarity": "rare", "header": "DAILY MINDSET", "hashtags": ["#gold","#mining","#hk23","#viceos","#dailymindset"], "posted": false },
  { "id": "q06", "text": "Ideas born like stars.", "author": null, "target": "ecosystem", "color": "#F0EDE8", "rarity": "legendary", "header": "DAILY MINDSET", "hashtags": ["#ideas","#vision","#hk23","#viceos","#dailymindset"], "posted": false },
  { "id": "q07", "text": "Be impeccable with your words.", "author": null, "target": "lore", "color": "#FFD200", "rarity": "common", "header": "DAILY MINDSET", "hashtags": ["#mindset","#words","#hk23","#viceos","#dailymindset"], "posted": false },
  { "id": "q08", "text": "Everything has a price.", "author": null, "target": "flow", "color": "#FFD200", "rarity": "common", "header": "DAILY MINDSET", "hashtags": ["#business","#value","#hk23","#viceos","#dailymindset"], "posted": false },
  { "id": "q09", "text": "The system never sleeps.", "author": null, "target": "agents", "color": "#00F0FF", "rarity": "rare", "header": "DAILY MINDSET", "hashtags": ["#ai","#systems","#hk23","#viceos","#dailymindset"], "posted": false },
  { "id": "q10", "text": "Controlled chaos is art.", "author": null, "target": "arte", "color": "#FF3A1F", "rarity": "common", "header": "DAILY MINDSET", "hashtags": ["#art","#chaos","#hk23","#viceos","#dailymindset"], "posted": false },
  { "id": "q11", "text": "The map is not the territory.", "author": null, "target": "systems", "color": "#B84DFF", "rarity": "rare", "header": "DAILY MINDSET", "hashtags": ["#systems","#strategy","#hk23","#viceos","#dailymindset"], "posted": false }
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/hk23neo/vice-os-artifact && node --test tests/quotes-data.test.mjs`
Expected: PASS — `# pass 3`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /Users/hk23neo/vice-os-artifact
git add quotes.json tests/quotes-data.test.mjs
git commit -m "feat: quotes.json single source of truth + integrity test"
```

---

## Task 3: Universe loads `quotes.json` into `QUOTE_PORTALS`

**Files:**
- Modify: `hk23-universe.html` (the `<head>` for the script include; `QUOTE_PORTALS` definition near line 2671–2692; add `UNIVERSE_URL` near the `VICEGOLFER_URL` constant ~line 2129)

- [ ] **Step 1: Include `quote-utils.js` before the main script**

Find the existing app script. Add this line immediately BEFORE the opening `<script>` that contains `const PROJECTS` (i.e., right after the closing `</style>` or any earlier `<script src>` block, before inline app logic). Search for the first inline `<script>` after the `<body>` content and insert above it:

```html
<script src="quote-utils.js"></script>
```

Verify placement: `grep -n 'quote-utils.js' hk23-universe.html` returns one line that appears BEFORE the line from `grep -n 'const PROJECTS' hk23-universe.html`.

- [ ] **Step 2: Add the `UNIVERSE_URL` constant**

Find (near line 2129):

```js
// ─── LIVE APP URLS ───
// ViceGolfer app is deployed on Vercel. Swap this one line when the
// custom domain (vicegolfer.com) goes live and routes resolve.
const VICEGOLFER_URL = 'https://vicegolfer.vercel.app';
```

Replace with (append the new constant):

```js
// ─── LIVE APP URLS ───
// ViceGolfer app is deployed on Vercel. Swap this one line when the
// custom domain (vicegolfer.com) goes live and routes resolve.
const VICEGOLFER_URL = 'https://vicegolfer.vercel.app';

// Public base URL of THIS universe. Used to build the deep-link a social
// QR points back to. Swap when GitHub Pages (or a custom domain) goes live.
const UNIVERSE_URL = 'https://hk23neo.github.io/vice-os';
```

- [ ] **Step 3: Replace the inline `QUOTE_PORTALS` with a builder + loader**

Find (lines ~2670–2692):

```js
// ─── FLOATING QUOTE PORTALS ───
const QUOTE_PORTALS = [
  { text: 'Perfection lives in the putting.', target: 'vicegolfer', color: '#AAFF00', rarity: 'common' },
  { text: 'Own the kick zone.', target: 'rugbyvice', color: '#00F0FF', rarity: 'common' },
  { text: 'A vice is not a hobby.', target: 'lore', color: '#FFD200', rarity: 'rare' },
  { text: 'The mine never lies.', target: 'laiglesia', color: '#FFD200', rarity: 'rare' },
  { text: 'Ideas born like stars.', target: 'ecosystem', color: '#F0EDE8', rarity: 'legendary' },
  { text: 'Be impeccable with your words.', target: 'lore', color: '#FFD200', rarity: 'common' },
  { text: 'Everything has a price.', target: 'flow', color: '#FFD200', rarity: 'common' },
  { text: 'The system never sleeps.', target: 'agents', color: '#00F0FF', rarity: 'rare' },
  { text: 'Controlled chaos is art.', target: 'arte', color: '#FF3A1F', rarity: 'common' },
  { text: 'The map is not the territory.', target: 'systems', color: '#B84DFF', rarity: 'rare' },
].map((q, i) => ({
  ...q,
  id: 'quote_' + i,
  x: 0.08 + Math.random() * 0.84,
  y: 0.08 + Math.random() * 0.80,
  vx: (0.00006 + Math.random() * 0.0001) * (Math.random() > 0.5 ? 1 : -1),
  vy: (0.00003 + Math.random() * 0.00005) * (Math.random() > 0.5 ? 1 : -1),
  collected: false,
  hovered: false,
  width: 0, // computed at draw time
}));
```

Replace with:

```js
// ─── FLOATING QUOTE PORTALS ───
// Inline fallback used if quotes.json fails to load (e.g. opened via file://).
// Ids MUST match quotes.json so deep-links resolve either way.
const INLINE_QUOTE_DEFAULTS = [
  { id: 'q01', text: 'Putting is like wisdom — partly a natural gift and partly the accumulation of experience.', target: 'vicegolfer', color: '#AAFF00', rarity: 'common' },
  { id: 'q02', text: 'Perfection lives in the putting.', target: 'vicegolfer', color: '#AAFF00', rarity: 'common' },
  { id: 'q03', text: 'Own the kick zone.', target: 'rugbyvice', color: '#00F0FF', rarity: 'common' },
  { id: 'q04', text: 'A vice is not a hobby.', target: 'lore', color: '#FFD200', rarity: 'rare' },
  { id: 'q05', text: 'The mine never lies.', target: 'laiglesia', color: '#FFD200', rarity: 'rare' },
  { id: 'q06', text: 'Ideas born like stars.', target: 'ecosystem', color: '#F0EDE8', rarity: 'legendary' },
  { id: 'q07', text: 'Be impeccable with your words.', target: 'lore', color: '#FFD200', rarity: 'common' },
  { id: 'q08', text: 'Everything has a price.', target: 'flow', color: '#FFD200', rarity: 'common' },
  { id: 'q09', text: 'The system never sleeps.', target: 'agents', color: '#00F0FF', rarity: 'rare' },
  { id: 'q10', text: 'Controlled chaos is art.', target: 'arte', color: '#FF3A1F', rarity: 'common' },
  { id: 'q11', text: 'The map is not the territory.', target: 'systems', color: '#B84DFF', rarity: 'rare' },
];

function buildQuotePortals(list) {
  return list.map(function (q) {
    return Object.assign({}, q, {
      x: 0.08 + Math.random() * 0.84,
      y: 0.08 + Math.random() * 0.80,
      vx: (0.00006 + Math.random() * 0.0001) * (Math.random() > 0.5 ? 1 : -1),
      vy: (0.00003 + Math.random() * 0.00005) * (Math.random() > 0.5 ? 1 : -1),
      collected: false,
      hovered: false,
      width: 0, // computed at draw time
    });
  });
}

let QUOTE_PORTALS = buildQuotePortals(INLINE_QUOTE_DEFAULTS);

// Load the canonical quotes; overwrite the portals, then run the deep-link
// handler (defined later) once data has settled.
function loadQuotesThen(cb) {
  fetch('quotes.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (Array.isArray(data) && data.length) QUOTE_PORTALS = buildQuotePortals(data);
    })
    .catch(function () { /* keep inline defaults */ })
    .finally(function () { if (typeof cb === 'function') cb(); });
}
```

Note: `QUOTE_PORTALS` changes from `const` to `let`. The id now comes from data (no more `'quote_'+i`).

- [ ] **Step 4: Verify the universe still loads and JS is valid**

Run:
```bash
cd /Users/hk23neo/vice-os-artifact
node -e "const h=require('fs').readFileSync('hk23-universe.html','utf8');const s=h.match(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/g)||[];let e=0;s.forEach((x,i)=>{try{new Function(x.replace(/<\/?script[^>]*>/g,''))}catch(err){console.log('ERR',i,err.message);e++}});console.log(e?'FAIL':'OK '+s.length+' scripts')"
```
Expected: `OK 1 scripts`.

Then open `http://localhost:8765/hk23-universe.html`, click ENTER, confirm floating quotes still appear on the map (visual). The `loadQuotesThen` call is wired in Task 4 — at this point the portals render from the inline defaults.

- [ ] **Step 5: Commit**

```bash
cd /Users/hk23neo/vice-os-artifact
git add hk23-universe.html
git commit -m "feat(universe): load quotes.json into QUOTE_PORTALS w/ inline fallback + UNIVERSE_URL"
```

---

## Task 4: Universe deep-link handler (`?quote=`, `?planet=`)

**Files:**
- Modify: `hk23-universe.html` (the quote-click block ~line 4178–4188; add `navigateToQuoteTarget` + `handleDeepLink`; call `loadQuotesThen(handleDeepLink)` at boot)

- [ ] **Step 1: Extract `navigateToQuoteTarget` and DRY the click handler**

Find (lines ~4178–4188):

```js
  } else if (hoveredQuote) {
    const q = QUOTE_PORTALS.find(q => q.id === hoveredQuote);
    addCollectible(q.id, q.rarity);
    // Navigate to the target
    const projTargets = ['vicegolfer','rugbyvice','laiglesia','arteworld','projects_pl','cryptovice','hk23hub','teeclub','viceai','marketplace'];
    if (projTargets.includes(q.target)) {
      const proj = PROJECTS.find(p => p.id === q.target);
      if (proj) openFractalUniverse(proj);
    } else {
      goTo(q.target);
    }
  } else if (hoveredIdeaMoonIdx >= 0) {
```

Replace with:

```js
  } else if (hoveredQuote) {
    const q = QUOTE_PORTALS.find(q => q.id === hoveredQuote);
    addCollectible(q.id, q.rarity);
    navigateToQuoteTarget(q);
  } else if (hoveredIdeaMoonIdx >= 0) {
```

- [ ] **Step 2: Add `navigateToQuoteTarget` and `handleDeepLink`**

Insert these two functions immediately AFTER the `addCollectible` function (which ends at ~line 3352, `}` after the toast). Locate it with `grep -n 'function addCollectible' hk23-universe.html` and insert after its closing brace:

```js
// Route a quote (or its target id) to the right destination: drillable
// planets open the fractal universe; zone screens use goTo().
function navigateToQuoteTarget(q) {
  if (QuoteUtils.resolveTargetKind(q.target) === 'planet') {
    const proj = PROJECTS.find(p => p.id === q.target);
    if (proj) openFractalUniverse(proj); else goTo(q.target);
  } else {
    goTo(q.target);
  }
}

// On load, honor ?quote=<id> (fly + unlock collectible) or ?planet=<id> (fly).
function handleDeepLink() {
  const params = new URLSearchParams(location.search);
  const quoteId = params.get('quote');
  const planetId = params.get('planet');
  if (!quoteId && !planetId) return;

  goTo('map');
  setTimeout(function () {
    if (quoteId) {
      const q = QUOTE_PORTALS.find(x => x.id === quoteId);
      if (q) { addCollectible(q.id, q.rarity); navigateToQuoteTarget(q); return; }
    }
    if (planetId) {
      const proj = PROJECTS.find(p => p.id === planetId);
      if (proj) openFractalUniverse(proj); else goTo(planetId);
    }
  }, 700); // let the map canvas spin up before navigating
}
```

- [ ] **Step 3: Call the loader+handler at boot**

Find the bottom of the main inline script, just before `</script>` (line ~5519). Add:

```js
// ─── MINDSET ENGINE: quotes + inbound deep-links ───
loadQuotesThen(handleDeepLink);
```

- [ ] **Step 4: Verify JS validity**

Run:
```bash
cd /Users/hk23neo/vice-os-artifact
node -e "const h=require('fs').readFileSync('hk23-universe.html','utf8');const s=h.match(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/g)||[];let e=0;s.forEach((x,i)=>{try{new Function(x.replace(/<\/?script[^>]*>/g,''))}catch(err){console.log('ERR',i,err.message);e++}});console.log(e?'FAIL':'OK '+s.length+' scripts')"
```
Expected: `OK 1 scripts`.

- [ ] **Step 5: Verify deep-link behavior in the browser**

With the preview server running:
- Open `http://localhost:8765/hk23-universe.html?quote=q01` → after ~1s it should jump to the map, fly into the **VICEGOLFER** fractal universe, and show the "✦ COLECCIONABLE DESBLOQUEADO" toast.
- Open `http://localhost:8765/hk23-universe.html?planet=cryptovice` → flies into the CRYPTO VICE universe, no collectible toast.
- Open `http://localhost:8765/hk23-universe.html?quote=zzz` (unknown) → loads normally to the portal screen, no error.
- Open `http://localhost:8765/hk23-universe.html` (no params) → normal portal screen.

Check the browser console (preview console logs) shows no uncaught errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/hk23neo/vice-os-artifact
git add hk23-universe.html
git commit -m "feat(universe): inbound deep-link handler (?quote / ?planet) + DRY quote nav"
```

---

## Task 5: `quote-studio.html` card generator

**Files:**
- Create: `quote-studio.html`

The studio renders to a 1080×1080 canvas. The QR is generated client-side with `qrcode-generator` (outputs a same-origin data URL → drawn onto the canvas → PNG export is NOT tainted). Do NOT use a remote QR image: it taints the canvas and breaks `toDataURL()`.

- [ ] **Step 1: Create the file**

Create `quote-studio.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HK23 — Quote Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"></script>
<script src="quote-utils.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0c0c12; color:#ddd; font-family:'Space Mono',monospace; padding:28px; }
  h1 { font-family:'Space Grotesk',sans-serif; font-weight:900; font-size:20px; letter-spacing:1px; margin-bottom:4px; }
  h1 span { color:#AAFF00; }
  .sub { color:#555; font-size:10px; letter-spacing:3px; margin-bottom:22px; }
  .wrap { display:flex; gap:28px; flex-wrap:wrap; align-items:flex-start; }
  .left { width:540px; }
  #card { width:540px; height:540px; background:#000; display:block; box-shadow:0 20px 60px rgba(0,0,0,.6); }
  .controls { display:flex; gap:10px; margin-top:14px; }
  button { background:none; border:1px solid #333; color:#aaa; font-family:'Space Mono',monospace; font-size:11px; letter-spacing:2px; padding:11px 16px; cursor:pointer; border-radius:3px; }
  button:hover { border-color:#AAFF00; color:#AAFF00; }
  .right { flex:1; min-width:300px; }
  .qlabel { font-size:9px; letter-spacing:3px; color:#555; margin:0 0 10px; }
  .queue { display:flex; flex-direction:column; gap:6px; max-height:300px; overflow:auto; }
  .qitem { text-align:left; border:1px solid #1e1e2a; background:#0a0a12; padding:10px 12px; cursor:pointer; }
  .qitem:hover { border-color:#444; }
  .qitem.active { border-color:#AAFF00; }
  .qitem .t { font-family:'Space Grotesk',sans-serif; color:#ccc; font-size:13px; }
  .qitem .m { color:#555; font-size:9px; margin-top:3px; letter-spacing:1px; }
  .caption { margin-top:20px; background:#08080e; border:1px solid #1e1e2a; border-radius:6px; padding:16px; }
  .caption h4 { font-size:9px; letter-spacing:3px; color:#555; margin-bottom:10px; }
  .caption pre { white-space:pre-wrap; font-family:'Space Grotesk',sans-serif; color:#cfcfcf; font-size:13px; line-height:1.6; }
</style>
</head>
<body>
  <h1>QUOTE <span>STUDIO</span></h1>
  <div class="sub">MINDSET ENGINE · GENERATE → APPROVE → POST</div>

  <div class="wrap">
    <div class="left">
      <canvas id="card" width="1080" height="1080"></canvas>
      <div class="controls">
        <button id="dl">↓ DOWNLOAD PNG</button>
        <button id="cp">⧉ COPY CAPTION</button>
      </div>
      <div class="caption">
        <h4>CAPTION</h4>
        <pre id="caption-text"></pre>
      </div>
    </div>
    <div class="right">
      <p class="qlabel">QUEUE · click to render</p>
      <div class="queue" id="queue"></div>
    </div>
  </div>

<script>
const UNIVERSE_URL = 'https://hk23neo.github.io/vice-os';
const canvas = document.getElementById('card');
const ctx = canvas.getContext('2d');
let QUOTES = [];
let current = null;

function buildCaption(q) {
  const author = q.author ? ' — ' + q.author : '';
  const link = QuoteUtils.quoteDeepLink(UNIVERSE_URL, q.id);
  return q.text + author + '\n\n' + q.hashtags.join(' ') + '\n\n→ ' + link;
}

// word-wrap helper: returns array of lines that fit maxWidth at the current font
function wrapLines(text, maxWidth) {
  const words = text.toUpperCase().split(' ');
  const lines = []; let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawQR(url, x, y, size) {
  return new Promise(function (resolve) {
    let dataUrl;
    try {
      const qr = qrcode(0, 'M');    // auto type, medium error correction
      qr.addData(url); qr.make();
      dataUrl = qr.createDataURL(8, 0); // same-origin data URL (no canvas taint)
    } catch (e) {
      console.warn('QR generation failed; exporting card without QR:', e);
      resolve(); return;            // spec: still allow PNG export without the QR
    }
    const img = new Image();
    img.onload = function () {
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 12, y - 12, size + 24, size + 24);
      ctx.drawImage(img, x, y, size, size);
      resolve();
    };
    img.onerror = function () { console.warn('QR image failed to load; card exported without QR.'); resolve(); };
    img.src = dataUrl;
  });
}

async function render(q) {
  current = q;
  const W = 1080, H = 1080, accent = q.color || '#AAFF00';
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

  // header: lines + label
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = "700 26px 'Space Mono', monospace";
  ctx.fillStyle = '#777';
  ctx.fillText((q.header || 'DAILY MINDSET').split('').join(' '), W/2, 150);
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(330, 150); ctx.lineTo(420, 150); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(660, 150); ctx.lineTo(750, 150); ctx.stroke();

  // quotation mark
  ctx.font = "900 150px 'Space Grotesk', sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText('”', W/2, 250);

  // quote text — auto-size to fit
  let fontSize = 78;
  let lines;
  do {
    ctx.font = "900 " + fontSize + "px 'Space Grotesk', sans-serif";
    lines = wrapLines(q.text, W - 200);
    if (lines.length * (fontSize * 1.18) <= 460) break;
    fontSize -= 4;
  } while (fontSize > 30);

  ctx.fillStyle = '#fff';
  const lh = fontSize * 1.18;
  const startY = H/2 - ((lines.length - 1) * lh) / 2;
  lines.forEach(function (ln, i) { ctx.fillText(ln, W/2, startY + i * lh); });

  // divider + author
  ctx.strokeStyle = accent; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(W/2 - 42, 860); ctx.lineTo(W/2 + 42, 860); ctx.stroke();
  if (q.author) {
    ctx.font = "700 30px 'Space Mono', monospace";
    ctx.fillStyle = '#888';
    ctx.fillText(q.author.toUpperCase().split('').join(' '), W/2, 910);
  }

  // brand mark bottom-left
  ctx.textAlign = 'left';
  ctx.font = "900 30px 'Space Grotesk', sans-serif";
  ctx.fillStyle = '#fff'; ctx.fillText('HK', 60, 1000);
  const hkw = ctx.measureText('HK').width;
  ctx.fillStyle = accent; ctx.fillText('23', 60 + hkw, 1000);
  ctx.font = "400 14px 'Space Mono', monospace";
  ctx.fillStyle = '#555'; ctx.fillText('VICE OS', 60, 1028);

  // QR bottom-right
  await drawQR(QuoteUtils.quoteDeepLink(UNIVERSE_URL, q.id), W - 200, W - 200, 140);

  // caption + queue highlight
  document.getElementById('caption-text').textContent = buildCaption(q);
  document.querySelectorAll('.qitem').forEach(function (el) {
    el.classList.toggle('active', el.dataset.id === q.id);
  });
}

function renderQueue() {
  const box = document.getElementById('queue');
  box.innerHTML = '';
  QUOTES.forEach(function (q) {
    const div = document.createElement('div');
    div.className = 'qitem'; div.dataset.id = q.id;
    div.innerHTML = '<div class="t">' + q.text + '</div>' +
      '<div class="m">' + q.id + ' · ' + q.target + ' · ' + q.rarity +
      (q.posted ? ' · POSTED' : '') + '</div>';
    div.onclick = function () { render(q); };
    box.appendChild(div);
  });
}

document.getElementById('dl').onclick = function () {
  if (!current) return;
  const a = document.createElement('a');
  a.download = 'hk23-' + current.id + '.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
};
document.getElementById('cp').onclick = function () {
  if (!current) return;
  navigator.clipboard.writeText(buildCaption(current));
  const b = document.getElementById('cp'); const t = b.textContent;
  b.textContent = '✓ COPIED'; setTimeout(function () { b.textContent = t; }, 1200);
};

// Fonts must be ready before first canvas render, else metrics are wrong.
function boot() {
  fetch('quotes.json').then(function (r) { return r.json(); }).then(function (data) {
    QUOTES = data; renderQueue();
    if (QUOTES.length) render(QUOTES[0]);
  });
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot); else window.onload = boot;
</script>
</body>
</html>
```

- [ ] **Step 2: Verify the studio renders and exports a non-tainted PNG**

With the preview server running, open `http://localhost:8765/quote-studio.html`. Confirm:
- The first card (q01, Arnold Palmer) renders matching the mockup: black bg, "DAILY MINDSET" header, green quote mark, wrapped uppercase quote, green divider, "ARNOLD PALMER", HK23 mark, QR bottom-right.
- Clicking queue items re-renders with that quote's accent color (e.g. q11 "The map is not the territory" → purple).
- Clicking **DOWNLOAD PNG** downloads `hk23-q01.png` with NO console error (a tainted-canvas error would read "Tainted canvases may not be exported"). Check the preview console logs are clean.
- Clicking **COPY CAPTION** flips the button to "✓ COPIED".

- [ ] **Step 3: Commit**

```bash
cd /Users/hk23neo/vice-os-artifact
git add quote-studio.html
git commit -m "feat: quote-studio — canvas card generator w/ client-side QR + PNG export"
```

---

## Task 6: `daily.html` link-in-bio landing

**Files:**
- Create: `daily.html`

- [ ] **Step 1: Create the file**

Create `daily.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>HK23 — Daily Mindset</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<script src="quote-utils.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { background:#000; color:#fff; font-family:'Space Mono',monospace; min-height:100vh; padding:32px 20px 60px; }
  .head { text-align:center; margin-bottom:8px; }
  .head .logo { font-family:'Space Grotesk',sans-serif; font-weight:900; font-size:22px; letter-spacing:1px; }
  .head .logo span { color:#AAFF00; }
  .head .tag { font-size:9px; letter-spacing:4px; color:#555; margin-top:4px; }
  .hero { max-width:520px; margin:34px auto 26px; text-align:center; border:1px solid #16161c; padding:34px 26px; }
  .hero .h { font-size:11px; letter-spacing:5px; color:#666; margin-bottom:18px; }
  .hero .q { font-family:'Space Grotesk',sans-serif; font-weight:900; font-size:26px; line-height:1.2; text-transform:uppercase; }
  .hero .a { font-size:12px; letter-spacing:3px; color:#777; margin-top:16px; }
  .hero a.enter, .grid a.enter { display:inline-block; margin-top:20px; padding:13px 26px; text-decoration:none;
    font-size:11px; letter-spacing:3px; border:1px solid var(--c,#AAFF00); color:var(--c,#AAFF00); }
  .glabel { text-align:center; font-size:9px; letter-spacing:4px; color:#444; margin:30px 0 14px; }
  .grid { max-width:680px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .cell { border:1px solid #16161c; padding:18px 16px; display:flex; flex-direction:column; }
  .cell .q { font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:15px; line-height:1.3; text-transform:uppercase; flex:1; }
  .cell .a { font-size:9px; letter-spacing:2px; color:#666; margin-top:10px; }
  .cell a.enter { margin-top:12px; font-size:9px; letter-spacing:2px; text-align:center; }
  @media(max-width:520px){ .grid{ grid-template-columns:1fr; } }
</style>
</head>
<body>
  <div class="head">
    <div class="logo">HK<span>23</span></div>
    <div class="tag">DAILY MINDSET</div>
  </div>
  <div id="hero" class="hero"></div>
  <div class="glabel">ALL DROPS</div>
  <div id="grid" class="grid"></div>

<script>
const UNIVERSE_URL = 'https://hk23neo.github.io/vice-os';

function enterLink(q) { return QuoteUtils.quoteDeepLink(UNIVERSE_URL, q.id); }

fetch('quotes.json').then(function (r) { return r.json(); }).then(function (data) {
  const posted = data.filter(function (q) { return q.posted; }).reverse(); // newest first
  if (!posted.length) { document.getElementById('hero').innerHTML = '<div class="h">NO DROPS YET</div>'; return; }

  const top = posted[0];
  document.getElementById('hero').style.setProperty('--c', top.color);
  document.getElementById('hero').innerHTML =
    '<div class="h">QUOTE OF THE DAY</div>' +
    '<div class="q">' + top.text + '</div>' +
    (top.author ? '<div class="a">— ' + top.author.toUpperCase() + '</div>' : '') +
    '<a class="enter" href="' + enterLink(top) + '">ENTER THE UNIVERSE →</a>';

  const grid = document.getElementById('grid');
  posted.slice(1).forEach(function (q) {
    const cell = document.createElement('div');
    cell.className = 'cell'; cell.style.setProperty('--c', q.color);
    cell.innerHTML =
      '<div class="q">' + q.text + '</div>' +
      (q.author ? '<div class="a">— ' + q.author.toUpperCase() + '</div>' : '') +
      '<a class="enter" href="' + enterLink(q) + '">ENTER →</a>';
    grid.appendChild(cell);
  });
});
</script>
</body>
</html>
```

- [ ] **Step 2: Verify**

Open `http://localhost:8765/daily.html`. Confirm:
- "QUOTE OF THE DAY" shows q02 ("Perfection lives in the putting.") or q01 — i.e. the last `posted:true` entry, newest first. (Seed has q01 + q02 posted.)
- The "ENTER THE UNIVERSE →" button href is `https://hk23neo.github.io/vice-os/hk23-universe.html?quote=<id>` (inspect the link).
- The grid lists the other posted quote(s).
- Layout is mobile-friendly (resize narrow → single column).

- [ ] **Step 3: Commit**

```bash
cd /Users/hk23neo/vice-os-artifact
git add daily.html
git commit -m "feat: daily.html link-in-bio landing for posted quotes"
```

---

## Task 7: Full integration check + run all tests

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `cd /Users/hk23neo/vice-os-artifact && node --test tests/`
Expected: all tests pass (`# fail 0`).

- [ ] **Step 2: End-to-end manual flow**

With the preview server running, walk the full loop:
1. `quote-studio.html` → render q03 ("Own the kick zone.", rugbyvice/cyan) → DOWNLOAD PNG (cyan card saved, no taint error) → COPY CAPTION.
2. Inspect the copied caption ends with `→ https://hk23neo.github.io/vice-os/hk23-universe.html?quote=q03`.
3. Locally simulate the QR target: open `http://localhost:8765/hk23-universe.html?quote=q03` → flies to RUGBY VICE + collectible toast.
4. `daily.html` → every "ENTER" link points at a real `?quote=` deep link.

- [ ] **Step 3: Commit (if any cleanup)**

```bash
cd /Users/hk23neo/vice-os-artifact
git add -A && git commit -m "chore: Mindset Engine integration verified" || echo "nothing to commit"
```

---

## Notes & deferred (V2)

- **Public deploy gate:** QR/links use `UNIVERSE_URL = https://hk23neo.github.io/vice-os`, which only resolves once GitHub Pages is live (blocked on the user adding an SSH key — out of scope for the agent). Until then, swap to `http://localhost:8765` in the three files for local end-to-end testing, or keep the GH Pages URL and test the universe side via the localhost URL directly as in Task 7.
- **TikTok video card:** deferred. The static PNG covers IG + LinkedIn now.
- **Autonomous posting** (Zapier/Buffer/native API + scheduler): deferred.
- **Scan/click analytics per quote:** deferred.
- **`posted` flag is manual** for the MVP (edit `quotes.json`). A "mark as posted" button in the studio that writes back is a possible V2 (needs a tiny local write endpoint; out of scope for static hosting).
