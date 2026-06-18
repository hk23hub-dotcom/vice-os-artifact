# HK23 — Multiverse OS · Supabase

Single source of truth for the HK23 universe: **Cosmos ▸ Multiverse ▸ Galaxy ▸ System ▸ Node**, graph-native.

## Files
- `migrations/0001_multiverse_os.sql` — full schema (tables, enums, RLS, realtime, roll-up).
- `seed.sql` — (next) the current universe migrated to rows.

## How to apply (2 options)

### A) Supabase SQL Editor (fastest)
1. Open your project → **SQL Editor** → New query.
2. Paste the contents of `migrations/0001_multiverse_os.sql`.
3. **Run**. (Idempotent — safe to re-run.)

### B) Supabase CLI
```bash
cd ~/vice-os-artifact
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

## What's in it
| Table | Purpose |
|---|---|
| `entities` | every node/system/galaxy/multiverse (tree via `parent_id`) |
| `relationships` | the graph (related, ai_suggested, monetizes…) with `strength` |
| `activity_log` | event-sourced metrics → gravity & growth |
| `listings` | marketplace (links entities to Etsy listings) |

- **Gravity** (size/glow/opacity) is computed client-side from `entities.metrics` — not stored.
- **RLS**: each user owns their universe (`owner_id`); public read when `meta.public = true`.
- **Realtime** enabled on `entities` + `relationships` → universe updates live.

## Recommended: a DEDICATED HK23 project
Keep HK23 separate from ViceGolfer's DB. New project = clean RLS, scaling, and ownership.
