# Art Auto-Sync (Midjourney → Universe)

How new art flows into Arte World + the swarm gallery + Etsy listings.

## Level 1 — Sync on command (works today)
1. Put your Midjourney exports into a dedicated **Google Drive folder** (e.g. "HK23 Art").
2. Tell the agent: **"sync the art folder"** (and which folder, or share its link).
3. The agent uses the connected Google Drive tools to:
   - list new image files in that folder,
   - download them into `assets/midjourney/` (clean sequential names),
   - regenerate `midjourney.json` (swarm gallery) and `worlds/arteworld.json` (Arte World),
   - optionally generate Etsy listings for the new pieces.
4. New art appears in the universe on next load.

No setup needed — but it runs when the agent is asked to run it (in-session).

## Level 2 — True 24/7 auto (future)
A standalone sync that runs without the agent:
- Create a Google Cloud project + a **service account**, enable the Drive API.
- Share the Drive art folder with the service account email.
- A small Node script (same shape as `etsy-agent/`) polls the folder on a **Vercel Cron**, downloads new images, regenerates the manifests, and commits/deploys.
- Pairs naturally with the Etsy publisher: new art → synced → listed → published, all on schedule.

## Data this feeds
- `assets/midjourney/*` — the image files (web-sized)
- `midjourney.json` — swarm gallery
- `worlds/arteworld.json` — Arte World gallery (+ for-sale info merged from `etsy-listings.json`)
- `etsy-listings.json` — generated Etsy listings
