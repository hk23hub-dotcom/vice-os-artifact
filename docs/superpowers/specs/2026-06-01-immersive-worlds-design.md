# Immersive Worlds — Each Planet Its Own World

**Date:** 2026-06-01
**Status:** Approved (concept + ViceGolfer material + Mothership vision)
**Repo:** `~/vice-os-artifact` (file: `hk23-universe.html` + new world modules)

## Vision

The user loves the orbiting-planets universe, but the current per-planet
experience is a generic fractal node graph (`openFractalUniverse` → the same
node-graph for every planet). The radical change: **entering a planet drops you
into that planet's own distinct, immersive world** — not a node graph.

- **ViceGolfer** → you enter the **Golf House**: the simulator bay, the putting
  lab, the outdoor green, the gym — a real performance space you move through.
- **Mothership (Agent Base)** → you enter a colossal alien **Agent Station** (a
  hollowed celestial-head frontier port, "Knowhere"-inspired, original art)
  where the AI agents dock when idle.
- **Arte World** → you enter an immersive **gallery** of the HK23/JC Midjourney
  art body.
- Each planet = a different felt experience, built from real imagery/art.

## Scope & decomposition

"Each planet a unique world" = **N sub-projects**. We do NOT build 10 at once.
This spec defines:

1. **The World System** — the shared engine + shell that any world plugs into
   (built once).
2. **World 1 — ViceGolfer "Golf House"** — the prototype that proves the pattern
   (all material already in hand).
3. **World 2 — Mothership "Agent Station"** and **World 3 — Arte World** —
   defined schematically here; fleshed out when their assets/art are processed.

Worlds 2–3 each get their own implementation pass once assets land. The System +
World 1 are the buildable unit now.

## Fidelity (decided)

**2D immersive parallax, asset-driven.** Worlds are built from real photos /
renders / art arranged in depth layers with parallax on pointer/scroll, subtle
Ken-Burns drift, glowing clickable hotspots, and cinematic transitions. No new
3D dependency (stays Canvas2D + DOM). Crucially **data-driven**: a world is
defined by a manifest (layers + hotspots + copy) so new uploaded assets enrich a
world with zero re-engineering. Pseudo-3D extras (more parallax layers, fog,
god-rays) are reserved for showcase worlds like the Mothership.

## The World System — architecture

### Where it plugs in
The universe's enter-planet flow currently calls `openFractalUniverse(project)`.
We add a check: **if a project has a registered world, open the world instead;**
otherwise fall back to the existing fractal node graph. This is additive —
planets without a world keep working exactly as today.

### Units

1. **`worlds/<id>.json` — world manifest (per world).**
   Defines the world declaratively:
   ```json
   {
     "id": "vicegolfer",
     "title": "THE GOLF HOUSE",
     "accent": "#AAFF00",
     "ambient": "assets/worlds/vicegolfer/bg-golfhouse.jpg",
     "layers": [
       { "src": "assets/worlds/vicegolfer/fg-deck.png", "depth": 0.12 },
       { "src": "assets/worlds/vicegolfer/mid-module.png", "depth": 0.05 }
     ],
     "hotspots": [
       { "x": 0.32, "y": 0.55, "label": "SIMULATOR BAY",
         "blueprint": "golfteiner-blueprint.html",
         "detail": { "title": "GOLFTEINER MODEL 1", "desc": "...", "stats": [...] },
         "appLink": "https://vicegolfer.vercel.app/play" }
     ]
   }
   ```
   What it does: describes one world. How you use it: dropped in `worlds/`,
   referenced by planet id. Depends on: images under `assets/worlds/<id>/`.

2. **`world-engine.js` — the shared renderer (built once).**
   DOM/Canvas module that, given a manifest, renders: the ambient backdrop, the
   parallax layers (translate on pointer/gyro), the glowing hotspots, and wires
   hotspot clicks to a detail panel / blueprint viewer / app deep-link. One
   responsibility: turn a world manifest into an interactive scene. Reused by
   every world. Depends on: the manifest + the shared shell.

3. **The world shell (in `hk23-universe.html`).**
   The chrome around any world: cinematic **enter** transition (planet zoom →
   scene fade-in), a minimal HUD (world title + accent), **exit/back to
   universe** control, and the detail panel (reuse the existing node-detail panel
   structure + the existing `VICEGOLFER_URL`-style deep-links). Built once.

4. **World registry.**
   A small map `WORLD_IDS = ['vicegolfer', ...]` (mirroring the `PLANET_IDS`
   pattern in `quote-utils.js`). Entering a planet in this set loads its world;
   others use the fractal fallback.

### Data flow
```
enter planet → has world? ──yes──> fetch worlds/<id>.json
                                      → world-engine renders scene (parallax + hotspots)
                                      → click hotspot → detail panel / blueprint / app deep-link
                                      → EXIT → back to universe map
                ──no──> openFractalUniverse() (existing fallback)
```

### Asset pipeline
- Images live in `assets/worlds/<id>/`.
- Art/photos are resized to web size (~1200px, ~200KB) via `sips` (macOS native,
  no deps) before committing — gallery quality without repo bloat. (The full-res
  Midjourney originals stay out of the repo.)
- A world manifest references them by path.

## World 1 — ViceGolfer "THE GOLF HOUSE" (prototype)

**Material in hand:** 3 vector blueprints (`golfteiner-blueprint.html`,
`dynamic-putting-lab-blueprint.html`, `putting-green-blueprint.html`), Golf House
renders/photos (Tiny Golf House module, putting green, gym), VICEGOLFER logos,
and the Golf House Simulator business proposal.

**Experience:** entering ViceGolfer drops you outside/inside the dark, cinematic
**Golf House** (Fallowood mood: container module, forest dusk, green `#AAFF00`
accents). You pan across the scene; glowing hotspots mark the stations:

| Hotspot | Opens | Deep-link |
|---------|-------|-----------|
| **Simulator Bay** | Golfteiner blueprint + detail | `/play` |
| **Putting Lab** | Dynamic Putting Lab blueprint + Performance DNA detail | `/putting` |
| **Outdoor Green** | Putting Green blueprint + detail | `/putting` |
| **Performance Data** | DNA radar detail (existing node content) | `/dashboard` |
| **The Business** | Golf House proposal (revenue, membership, ROI) | — |
| **Gym / Court** | conditioning detail | — |

Hotspot click → detail panel slides in (reuse existing node-detail structure) +
"ENTER APP →" (reuse the `VICEGOLFER_URL` deep-links already built). Blueprints
open in an in-world frame/overlay.

## World 2 — Mothership "AGENT STATION" (schematic)

**Concept:** the home where HK23's AI agents dock when idle. An original
HK23-art interpretation **inspired by** Guardians of the Galaxy's "Knowhere" and
the Prometheus vibe: a colossal derelict alien/celestial **head** adrift in deep
space, hollowed into a neon, lawless frontier **port-city**, full of
interdimensional salvage tech. (Original art only — no Marvel assets reproduced.)

**Experience:** entering the Agent Base planet drops you inside the station.
Agent **berths/docks** are the hotspots — each agent (Vault, Content, DNA, Ops,
…) parks at its dock when idle; clicking a dock shows that agent's status/role
(reuse the existing Agent Base panel content). Showcase treatment: extra parallax
layers, drifting fog, neon flicker.

**Pending to build:** the station art (Midjourney) under
`assets/worlds/mothership/`. Manifest + hotspots authored once art arrives.

## World 3 — Arte World "THE GALLERY" (schematic)

**Concept:** an immersive gallery of the HK23/JC Midjourney art body (owls,
faces, graffiti, abstract, geometric). The same art that powers the Swarm Art
gallery, shown here as a walkable/scrollable exhibition.

**Experience:** entering Arte World = a dark gallery space; art pieces hang/float
with parallax; click a piece to view large + title/series. Driven by the same
manifest pattern (an `arteworld` world manifest listing the resized art).

**Pending to build:** resize the Midjourney art to web size into
`assets/worlds/arteworld/`; author manifest.

## Error handling
- No world manifest for a planet, or fetch fails → fall back to
  `openFractalUniverse()` (existing behavior). Worlds never break the universe.
- A world layer/hotspot image fails to load → skip it, keep the scene.
- EXIT always returns to the universe map cleanly (cancel rAF, hide world DOM).

## Testing
- Entering a world-enabled planet renders the scene; entering a non-world planet
  still shows the fractal graph (regression check).
- Hotspots render at their manifest coordinates and respond to clicks.
- Detail panel + app deep-links open correctly (reuse verified deep-link system).
- EXIT returns to the map with no leaked animation loops or console errors.
- Manifest is valid JSON; every referenced image path exists.

## Deferred
- Pseudo-3D / WebGL walkable worlds (real 3D) — future, per-world upgrade.
- Worlds for the remaining planets (Rugby, La Iglesia mine, Crypto, Marketplace,
  Hub, Tee Club, Vice AI) — each its own pass when assets exist.
- Gyro/device-orientation parallax on mobile.
