# Mindset Engine — Social Quote Agent ↔ Universe Bridge

**Date:** 2026-06-01
**Status:** Approved (design + visual mockup)
**Repo:** `~/vice-os-artifact`

## Problem

HK23 wants a social-media presence built on quote cards (style reference: the
Arnold Palmer "DAILY MINDSET" card — black background, bold white uppercase
text, header rule, author line). Each posted quote should connect back to the
HK23 Vice OS universe, so social content becomes a funnel into the product.

The universe already has an in-app quote system (`QUOTE_PORTALS` in
`hk23-universe.html`): floating quotes, each with `text`, `target` (a planet
id), `color`, and `rarity`. Clicking one flies to the planet and collects it.
This project adds the **reverse direction**: external posts that link back in.

## Goals (all three layers, by user request)

1. **Traffic funnel** — every post drives people to the universe, landing on the
   planet that matches the quote.
2. **Single source of truth** — quotes live in one place that feeds the universe,
   the card generator, and the link-in-bio page.
3. **Collectible / gamification** — arriving via a quote link unlocks that quote
   as a collectible in the universe (reusing the existing `addCollectible`
   system and its common/rare/legendary tiers).

## Platforms

Instagram + TikTok + LinkedIn. (Not X/Twitter.)

**Hard constraint:** Instagram and TikTok do **not** allow clickable links in
post content. TikTok content is **video**, not a static image. LinkedIn allows
links in post text. This drives the bridge design below.

## Automation level (MVP)

**Generate-and-approve.** The agent produces the card image + caption + link and
leaves them ready; the user reviews and posts manually with one tap. No social
APIs, no OAuth, no scheduler in the MVP. This avoids Instagram Graph API /
Facebook app review and paid X API, eliminates off-brand posting risk, and lets
development start immediately. Autonomous posting is a deferred V2.

## The Bridge: QR + link-in-bio

- **QR code** embedded discreetly in each card (corner). Universal — works in an
  IG image, a TikTok video frame, even printed. Scans to the universe deep-link.
- **Link-in-bio landing page** lists the active quotes; each has an "ENTER THE
  UNIVERSE →" button. One URL for the IG/TikTok bio.
- **LinkedIn** additionally gets the raw deep-link in post text.

## Architecture — 5 units

### 1. `quotes.json` — single source of truth
Extract the hardcoded `QUOTE_PORTALS` into a JSON file with a richer schema:

```json
{
  "id": "q01",
  "text": "Putting is like wisdom — partly a natural gift and partly the accumulation of experience.",
  "author": "Arnold Palmer",
  "target": "vicegolfer",
  "color": "#AAFF00",
  "rarity": "common",
  "header": "DAILY MINDSET",
  "hashtags": ["#golf", "#mindset", "#putting", "#performance", "#hk23", "#viceos", "#dailymindset"],
  "posted": false
}
```

- `author` is optional. HK23-original lines have no author (or `"HK23"`);
  borrowed lines name the source (e.g., Arnold Palmer).
- `color` defaults to the target planet's color but can be overridden.
- `posted` tracks which quotes have already gone out (drives the studio queue).
- The universe loads this file to build `QUOTE_PORTALS` instead of the inline
  array. The card studio and the link-in-bio page read the same file.

**Interface:** plain JSON, fetched client-side. What it does: holds every quote.
How you use it: `fetch('quotes.json')`. Depends on: nothing.

### 2. `quote-studio.html` — the generator (the "approve" surface)
Local tool. Responsibilities:
- Load `quotes.json`, show the queue of `posted: false` quotes.
- Pick a quote (or "next"); render the card to a `<canvas>` at 1080×1080 in the
  approved style: black bg, "DAILY MINDSET" header between rules, quotation mark
  in the planet accent color, bold uppercase quote text (auto-sized to fit),
  divider, author, `HK23 · VICE OS` mark bottom-left, **QR bottom-right**.
- Accent color comes from the quote's `color` (planet color).
- Buttons: **Download PNG** (canvas → PNG export) and **Copy Caption**
  (text + author + hashtags + link, assembled per platform).
- The visual spec is locked by `quote-card-mockup.html` (already built).

**Interface:** a page. What it does: turn a quote into a ready-to-post asset.
How you use it: open it, pick, download, copy. Depends on: `quotes.json`,
a QR generator, the canvas API.

### 3. Universe deep-link handler — the glue
In `hk23-universe.html`, on load, read URL params:
- `?quote=<id>` → find the quote, fly to its `target` planet, open the planet
  detail, and call `addCollectible(quoteId, rarity)` to unlock it.
- `?planet=<id>` → fly to that planet (no collectible).

Reuses existing navigation and the existing `addCollectible` system. This is
what makes the funnel and the gamification work.

**Interface:** URL query params. What it does: route an inbound link to the
right planet and unlock the collectible. How you use it: append `?quote=q01`.
Depends on: existing planet navigation + `addCollectible`.

### 4. `daily.html` — link-in-bio landing
One page: the most recently posted quote as "quote of the day" at the top, plus
a grid of **all already-posted quotes** (`posted: true`), newest first, as
mini-cards. Showing posted quotes lets a follower who saw a post find it and
jump in. Each mini-card has "ENTER THE UNIVERSE →" linking to the universe
deep-link. Styled to match (Space Grotesk / Space Mono, black). Reads
`quotes.json`. This is the single URL placed in the IG/TikTok bio.

### 5. QR + `UNIVERSE_URL` constant
The QR encodes `UNIVERSE_URL + '/hk23-universe.html?quote=' + id`. Store the base
as a single `UNIVERSE_URL` constant (mirroring the `VICEGOLFER_URL` pattern
already used). One-line swap when GitHub Pages goes live. QR generated client
side (small library or a QR image endpoint).

## Data flow

```
quotes.json ──┬──> hk23-universe.html (QUOTE_PORTALS + deep-link handler)
              ├──> quote-studio.html  (queue → canvas card + caption + QR)
              └──> daily.html         (link-in-bio grid)

quote-studio → PNG + caption ──(manual post)──> IG / TikTok / LinkedIn
                                                      │
                          QR / link-in-bio / link ────┘
                                                      ▼
                              hk23-universe.html?quote=qNN
                                → fly to planet + addCollectible
```

## MVP vs. later

**MVP (build now, works locally):**
- `quotes.json` with migrated + enriched quotes
- `quote-studio.html` producing static PNG (covers IG + LinkedIn) with QR
- Universe deep-link handler (`?quote=`, `?planet=`)
- `daily.html` link-in-bio
- `UNIVERSE_URL` constant + client-side QR

**V2 (deferred):**
- TikTok **video** card (animated text export)
- **Autonomous** posting via Zapier/Buffer/native APIs + scheduler
- Analytics on scans/clicks per quote

## Dependencies & constraints

- **Public deploy required for real links.** QR/links only work once the
  universe is live on GitHub Pages. Currently `localhost` only. Deploy is
  blocked on adding an SSH key to GitHub — a user action (credentials are out of
  scope for the agent). Until then, develop/test against `localhost` and keep
  `UNIVERSE_URL` ready for the one-line swap.
- No external social API credentials needed for the MVP.

## Error handling

- `quotes.json` fetch failure in the universe → fall back to a small inline
  default set so the universe still renders.
- Unknown `?quote=`/`?planet=` id → ignore the param, open the normal map.
- QR generation failure in the studio → still allow PNG export without the QR
  (warn in the UI), since LinkedIn/link-in-bio still carry the link.

## Testing

- `quotes.json` is valid JSON and every `target` matches a real planet id.
- Universe with `?quote=q01` flies to VICEGOLFER and marks q01 collected.
- Studio renders a card matching the mockup and exports a 1080×1080 PNG.
- `daily.html` lists all `posted:true` quotes (newest first) with working deep-links.
- QR resolves to `UNIVERSE_URL/hk23-universe.html?quote=<id>`.
