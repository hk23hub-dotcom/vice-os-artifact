# Swarm Art — Midjourney Gallery + Pixel Fidelity

**Date:** 2026-06-01
**Status:** Approved (architecture + density approach)
**Repo:** `~/vice-os-artifact` (file: `hk23-universe.html`)
**Scope note:** This is **Project A**. Pac-Man mode, Tetris mode, and interactive
particle control were split out as **Project B — Particle Games** (separate spec,
designed later). They share the particle pool but are game engines, not image
reproduction, so they don't belong here.

## Problem

The universe already has swarm art: pressing `S` explodes the live universe into
particles; `morphToText(word)` reforms them into a typed word; `launchSwarm(img)`
reforms them into an uploaded photo, all over the live universe via the
`swarm-live-canvas` overlay. Two gaps remain:

1. There's no curated source of images to form — the user wants their Midjourney
   art available as a gallery, sourced from Google Drive/Box.
2. The reproduced image is loose (sparse monochrome-ish dots). The user wants the
   particles to pack denser and take each source pixel's color, so the swarm
   genuinely resembles the image.

## Goals

1. A **Midjourney thumbnail strip** inside the existing swarm panel (reached via
   `S`). Click a thumbnail → universe particles form that image.
2. **Higher-fidelity reproduction** — denser sampling + per-particle source color,
   with a LO/HI toggle.
3. Drive/Box is the source of truth; images are synced to local copies the
   universe serves same-origin (required — see constraint below).

## Hard constraint: canvas taint

Forming an image requires reading its pixels via `getImageData()`. A cross-origin
image (loaded directly from Drive) **taints the canvas**, and the browser then
**blocks `getImageData()`** — the swarm cannot sample it. Therefore Drive images
**cannot** be sampled directly client-side. They must be served same-origin. The
sync step below produces local copies; the runtime only ever samples local files.

## Architecture — 3 units

### 1. Source — a Drive/Box folder
The user designates one folder (e.g. "HK23 Midjourney") and drops Midjourney
exports there. This folder is the source of truth. No runtime dependency on it.

### 2. Sync — agent-run, on request ("refresh the gallery")
A repeatable content-time operation (run by the agent via the Drive/Box
connector, not a runtime feature):
- List image files in the designated folder.
- Download each into `/midjourney/` in the repo. Downscale anything larger than
  1280px on the long edge (the swarm samples at low res anyway; keeps the repo
  light and load fast).
- Generate `midjourney.json` — a manifest mirroring the `quotes.json` pattern:
  ```json
  [
    { "file": "midjourney/owl-king.jpg", "title": "Owl King", "color": "#FF6A00" }
  ]
  ```
  `title` is derived from the filename (cleaned); `color` is the image's dominant
  color (used for the thumbnail border and the LO-mode tint). Computed at sync.
- Re-running overwrites the manifest and refreshes the local copies.

**Interface:** `midjourney.json` (same-origin) + `/midjourney/*` images. What it
does: makes the user's curated art available to the universe. Depends on: the
sync having been run at least once.

### 3. Runtime — thumbnail strip in the swarm panel + fidelity
Additions to `hk23-universe.html`:

- **Thumbnail strip.** When the swarm panel opens (`S`), fetch `midjourney.json`
  and render a horizontal, scrollable row of thumbnails above/beside the existing
  upload + text-morph controls. Each thumbnail uses its `color` as a border.
- **Click to form.** Clicking a thumbnail loads the local image and calls
  `launchSwarm(img, 'attract')` so the universe particles reform into it.
- **Empty state.** If `midjourney.json` is missing/empty: show "No Midjourney
  images yet — drop them in your Drive folder and ask to refresh the gallery."
  Upload + text morph still work.
- **Fidelity (LO/HI toggle).** A toggle in the panel:
  - **HI (default for gallery images):** sample the source image on a fine grid;
    each sampled point becomes a particle that takes that pixel's RGB color;
    particle count scales to the number of sampled points, capped at ~6000 for
    mobile performance. Result closely resembles the image.
  - **LO (current behavior):** the existing sparse, lighter look. Default for the
    self-destruct/explode view and low-power devices.
  - The toggle lives next to the modes (ATTRACT/EXPLODE/DRIFT/CLEAR).

**Interface:** the swarm panel UI. What it does: pick a curated image and form it
at chosen fidelity. Depends on: `midjourney.json`, the existing `launchSwarm` /
particle engine, `swarm-live-canvas`.

## Data flow

```
Drive/Box folder ──(agent sync via connector)──> /midjourney/*.jpg + midjourney.json
                                                          │
                                  swarm panel (S) reads midjourney.json
                                                          │
                                   click thumbnail → launchSwarm(localImg, 'attract')
                                                          │
                              HI: dense sample + per-pixel color (≤6000 particles)
                                                          ▼
                              universe particles reform into the image
```

## Fidelity implementation notes

`launchSwarm` currently samples the image and places particles at bright points.
HI mode changes three things:
1. **Sample step** scales down (finer grid) until target point count is reached,
   capped at ~6000.
2. **Per-particle color** — store the sampled pixel's `rgb` on each particle and
   draw it in that color (instead of a uniform/planet color).
3. **Particle count** — if the sampled points exceed the live pool, spawn extra
   particles; if fewer, park the surplus off-screen or fade them. Reuse the
   existing particle structure; add a `col` field per particle.

A `fidelity` parameter (`'lo' | 'hi'`) threads from the toggle into `launchSwarm`.

## Error handling

- `midjourney.json` missing or fetch fails → show the empty state; upload + text
  morph remain functional.
- A listed image fails to load → skip its thumbnail, log a warning, continue.
- HI mode on a low-power device → the ~6000 cap bounds cost; LO is always
  available as a fallback.

## Testing

- `midjourney.json` is valid JSON; every `file` path exists under `/midjourney/`.
- With a seeded `midjourney.json`, the swarm panel renders one thumbnail per entry.
- Clicking a thumbnail triggers `launchSwarm` and particles reform (visual check).
- HI vs LO visibly differ (HI denser + colored); particle count stays ≤ ~6000.
- Empty `midjourney.json` → empty-state message shows; upload still forms an image.
- Sampling uses only same-origin local images (no tainted-canvas error in console).

## Deferred (out of scope here)

- **Project B — Particle Games:** Pac-Man mode (particles → ghosts/Pac-Men with
  game movement), Tetris mode (full-screen falling pieces), interactive control
  (move particles like the games). Separate spec.
- Live Drive loading at runtime (blocked by canvas taint; sync is the answer).
- TikTok-style video export of a swarm reveal.
