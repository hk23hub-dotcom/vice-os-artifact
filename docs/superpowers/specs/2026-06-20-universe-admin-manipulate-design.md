# Universe Admin + Modo Manipular — Design Spec

**Date:** 2026-06-20
**File touched:** `hk23-universe.html` (the v1 galaxy, additive module — same pattern as the existing `window.NH` NeuralHub layer)
**Status:** Approved (design), pending implementation plan

## 1. Context

`hk23-universe.html` is the v1 canvas universe (galaxies = `NODES`, fractal projects = `PROJECTS`, links = `CONNECTIONS`; normalized coords `x,y ∈ [0,1]` → screen `x*W,y*H`; canvas re-reads data live every frame). It already carries an additive **NeuralHub layer** (`window.NH`) that edits/creates/connects nodes, persists to `localStorage['hk23nh-overrides']`, and mirrors nh-tagged rows to Supabase (`hk23.entities` / `hk23.relationships`, RLS scoped to `meta->>'nh'='1'` via migration `0008`).

This is **Increment 1 of 5** of the broader "universe control" work. The other four (Library/uploads, Access gates, ATLAS X agent, full theming) plug into the Admin shell built here.

## 2. Goal

Two additive surfaces, persisted via the existing NH+Supabase layer, with **zero rewrite** — v1 renders byte-identical until the user edits something (every new property defaults to the current look):

1. **🛠️ Admin Console** — a button (+ CMDS entry) opening a themed panel that lists every universe feature with: live status, an on/off switch, "where it lives" (`file:line`), and a "view code" action that shows the real source lines.
2. **✋ Modo Manipular** — a keyboard shortcut (`E`) toggling an edit overlay: drag planets to reposition, click a planet → property panel with sliders for position, size, color, glow/brightness, opacity, gravity-toward-cursor, and shape.

## 3. Architecture

One self-contained IIFE appended before `</body>` (after the existing NH module), exposing `window.ADMIN`. Reuses NH's `save()/load()` and Supabase helpers (`sbEntity`) — extend the shared `ov` override object rather than duplicating persistence.

### 3.1 Components

**A. Feature Registry — `FEATURES[]`**
Hand-curated map of the universe's modules. Each entry:
```
{ id, name, theme, kind, enabled, code:{ file, startLine, endLine, fn }, toggleKind }
```
- `theme` ∈ { Estructura, Vida, Juego, Sistemas, Datos, Agentes }
- `toggleKind` ∈ { `flag` (render honors FLAGS), `dom` (hide an element), `display-only` (cannot be cleanly removed — shown read-only with a note) }
- `code` points at the source so the Admin can fetch + show the real lines.

Initial coverage (≈12 flaggable layers): galaxias, conexiones, frases flotantes, swarm art, partículas de fondo, matrix rain, black holes, white holes, keys, quote portals, milestone, neural brain, CMDS, heatmap. Each mapped to its draw site.

**B. `FLAGS` global** — `{ featureId: bool }`, persisted in `ov.flags`. The render checks `FLAGS[x] !== false` at each guard point. Default unset = on (so v1 unchanged).

**C. Admin Console UI** — slide/full panel:
- Themed accordion (6 themes). Search box filters by name.
- Per feature row: status dot · name · `<toggle>` · `📄 código` · `dónde (file:line)`.
- `📄 código` fetches the source file (same-origin `fetch('hk23-universe.html')`, cached) and shows `code.startLine..endLine` in a `<pre>` with line numbers.
- `display-only` features render the toggle disabled with a tooltip explaining why.

**D. Modo Manipular** — `E` toggles `EDIT` mode:
- **Drag**: on `mousedown`, hit-test galaxies/projects with the existing distance math (`dist < size+pad`). If hit and EDIT on → start drag; `mousemove` sets `node.x = clientX/W`, `node.y = clientY/H`; `mouseup` persists. While EDIT is on, suppress the normal click→panel navigation.
- **Selection + Property Panel**: click (no drag) on a planet → floating panel bound to that node with controls:
  - posición (live via drag, plus numeric x/y)
  - tamaño → `node.size`
  - color → `node.color`
  - brillo/glow → `node.glow` (0–2, default 1)
  - opacidad → `node.opacity` (0–1, default 1)
  - gravedad → `node.gravity` (0–1, default 0)
  - forma → `node.shape` ∈ { circle (default), ring, star, square }
- **NH physics tick**: a single `requestAnimationFrame` loop owned by this module. Each frame, for every node with `gravity>0`, ease `x,y` toward the tracked cursor when within a radius (`x += (cursorX - x) * gravity * k`). The engine keeps drawing from the live coords; this module only mutates them. Loop is inert (no-op) when no node has gravity, to avoid overhead.

**E. Render patches (minimal, targeted)** — at the galaxy draw sites (~lines 3541, 3710):
- multiply the draw alpha by `(n.opacity ?? 1)`
- scale glow/blur radius by `(n.glow ?? 1)`
- branch shape on `(n.shape ?? 'circle')` (ring = stroked circle; star = 5-point path; square = rect)
Each defaults to the current look when the prop is unset → v1 identical pre-edit.

### 3.2 Data model (extends existing `ov`)

```
ov.flags     = { featureId: false }          // only stores OFF overrides
ov.galaxies[id] += { x,y,size,color,glow,opacity,gravity,shape }   // visual props
ov.nodes[key]   += { ...same for project sub-nodes }
```
Supabase mirror (via existing `sbEntity`, nh-tagged):
```
entity.color, entity.position = {x,y}, entity.meta.viz = {glow,opacity,gravity,shape}
```
Flags are local-only for now (per-browser view config); node visual props mirror to DB.

## 4. Data flow

1. On load: NH `apply()` runs (existing) → then ADMIN applies `ov.flags` into `FLAGS` and visual props are already merged into nodes by NH's `apply()`. Extend `apply()` to also copy `{glow,opacity,gravity,shape,size}` (currently only `{label,sub,color}`).
2. Admin toggle → set `FLAGS[id]`, write `ov.flags`, persist. Canvas reflects next frame.
3. Manipulate edit → mutate node prop live → persist to `ov` → fire-and-forget `sbEntity` mirror (toast `✓ DB` / `local`).
4. Drag → same path on `mouseup`.

## 5. Error handling
- Source fetch for "código" fails → show `file:line` text only + a note.
- Supabase mirror fails → silent fallback to local (toast), same as NH today.
- Hit-test on empty space in EDIT → deselect.
- `display-only` toggles never lie: disabled + explained.

## 6. Testing (manual, via Chrome MCP on the local server)
1. Fresh load, no overrides → v1 renders identical (snapshot key elements: NODES count, canvas, no console errors).
2. Toggle each `flag` feature off→on → its layer disappears/appears; persists across reload.
3. `display-only` toggle is disabled with note.
4. `📄 código` shows the real source lines for ≥3 features.
5. Modo Manipular (`E`): drag a galaxy → it moves; reload → stays (local) and DB `position` updated.
6. Each property slider (size, color, glow, opacity, shape) → live change; persists.
7. Gravity > 0 → planet eases toward cursor; gravity 0 → static; loop is no-op when all zero.
8. Turning EDIT off restores normal click→navigation.

## 7. Out of scope (later increments)
Library + uploads (Supabase Storage), access gates (riddle locks), ATLAS X agent, full per-element theming beyond the listed props, arbitrary/SVG shapes, multi-select drag, undo stack.
