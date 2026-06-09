# VICE SELLER 🤖💸

Autonomous monetization agent for the HK23 universe. Takes a MidJourney
collection and turns **each image into up to 3 revenue streams** — hands-off.

```
MidJourney (926 prints)
      │
      ▼
 ┌───────────┐   vision SEO    ┌──────────────────────────────┐
 │  SOURCE   │ ─────────────▶  │  per image:                  │
 │ manifest  │                 │  • Etsy digital download     │  $7.50
 └───────────┘                 │  • Printify canvas + poster  │  physical
      │                        │  • Pinterest pin → Etsy      │  traffic
      ▼                        └──────────────────────────────┘
   LEDGER  (data/ledger.json — resumable, idempotent)
```

## How it runs

- **Waves.** Processes `waveSize` (default 50) un-published items per run, so the
  shop never gets flagged for mass-listing. Re-running picks up where it left off.
- **Draft-first.** Etsy listings are created as **drafts** (`$0`) until you flip
  `channels.etsyDigital.publish` to `"active"` — only then does the $0.20 fee hit.
- **Idempotent.** Every step is recorded in the ledger; a crash mid-wave resumes
  cleanly and never double-lists.
- **Channels are independent + dormant-by-default.** Each turns on only when its
  credential exists, so you can light them up one at a time.

## Commands

```bash
node run.js --dry        # plan the next wave — no network, no fees
node run.js --status     # ledger summary across channels
node run.js              # run ONE live wave (needs Etsy token)
node run.js --wave 25    # override wave size
```

## What it needs (the only things the agent can't self-provision)

| Channel | Credential | Where |
|---|---|---|
| Etsy (digital) | OAuth token | `npm run etsy:oauth` → log in → **Allow** |
| Vision SEO | `anthropicKey` | `config.local.json` |
| Printify (canvas/poster) | `printifyToken` + `printifyShopId` | Printify → Connections → API |
| Pinterest | `pinterestToken` + `pinterestBoardId` | Pinterest API v5 |

Put secrets in `config.local.json` (gitignored — see `config.example.local.json`).

## Architecture

| File | Responsibility |
|---|---|
| `lib/sources.js` | load the MidJourney manifest → print items + image URLs |
| `lib/caption.js` | Claude vision → `{subject,style,theme,palette,keywords}` |
| `lib/seo.js` | caption → Etsy-valid title (≤140) + 13 tags + description |
| `lib/etsy.js` | create draft, upload photo, upload digital file, activate |
| `lib/printify.js` | upload art, create canvas/poster products, publish to Etsy |
| `lib/pinterest.js` | create a Pin linking back to the Etsy listing |
| `lib/state.js` | the ledger (source of truth for what's done) |
| `lib/orchestrator.js` | the brain — plan + run a wave through every channel |
| `run.js` | CLI |

Source collection: `data/midjourney-manifest.json` (926 upscaled job ids).

Part of **HK23** — everything is monetizable, documented, raw.
