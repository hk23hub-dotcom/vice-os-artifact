# HK23 — Master Plan (ecosystem blueprint)

**Date:** 2026-06-20
**Status:** Planning only — no build until approved. Scope chosen by user: whole HK23 ecosystem, with **real execution via a mini-backend**.

## 1. Vision (one line)

HK23 is a personal **operating universe**: a navigable cosmos that is the *shell*; each project is a *world* you enter from a planet; a *mission-control dashboard* governs it; *Supabase* is the shared memory; and an *Action Runner* (mini-backend) makes actions **really execute** — a note saves for real, "run this" runs for real.

## 2. Architecture — 4 layers

1. **Shell — HK23 Universe** (`cosmos.html` / `hk23-universe.html`): front door, neural brain, galaxy. Planets = worlds + nodes.
2. **Control — Universe Dashboard** (mission control): see everything; add **notes / tasks / nodes** (persist); **launch** worlds; **execute** actions.
3. **Worlds** (apps entered from planets): Rugby Vice, ViceGolfer, ATLAS X, VICE SELLER, Proof of Work, Vice OS (private). + future worlds.
4. **Foundation:** Supabase (shared memory, `hk23` schema) · **Action Runner** (mini-backend, real execution) · NeuralHub (edit/data layer) · AI (ATLAS X engine / Vercel AI Gateway).

## 3. The worlds (where each existing project fits)

| World | Repo / location | Role | State |
|---|---|---|---|
| **Rugby Vice** | `~/rugbyvice` | Cards, Evaluation, Kick Tracker, Teams, NFT | app running locally; **first world to integrate** |
| **ViceGolfer** | `~/vicegolfer` | Golf performance | live (Supabase) |
| **ATLAS X** | `~/atlas-x-app` (Vercel) | AI engine/product; also powers the in-universe agent | deployed (AI Gateway) |
| **VICE SELLER** | `~/vice-os-artifact/vice-seller` | Autonomous Etsy/Printify/Pinterest agent | built; triggerable |
| **Proof of Work** | `~/vice-collection` | Art/merch/NFT from Claude Code stats | collection ready |
| **Vice OS** | Obsidian vault (iCloud) | Private second brain | private — reference only, not a public world |

(La Iglesia = separate physical venture; appears as a node/link, not an app-world.)

## 4. Universe Dashboard (the "que funcione de verdad" piece)

Sections:
- **Overview** — everything in the universe at a glance (entities, worlds, recent activity), read live from Supabase.
- **Notes** — write a note → persists to Supabase (`hk23`), visible in the universe. Real.
- **Tasks** — add tasks with state (pendiente→haciendo→hecho) → persist. Real.
- **Nodes** — create/edit universe nodes/planets live (via the existing NeuralHub layer). Real.
- **Worlds** — buttons that **launch** a world (enter Rugby Vice, open ViceGolfer, etc.).
- **Actions** — buttons that **execute** real server actions via the Action Runner (see §5).
- **Activity log** — every add/execute recorded in `hk23.activity_log`.

Lives as a dedicated view in `hk23-universe.html` (it already carries NeuralHub + Supabase), reachable from the universe + a direct route.

## 5. Real execution — the Action Runner (mini-backend)

The browser can persist (Supabase) and launch (navigate), but **executing real actions** (run an agent, call an API with secrets, enqueue a job) needs server code.

- **What:** a small **Vercel serverless API** (`/api/run`) — the "Universe Action Runner".
- **How:** an **allowlisted action registry**. The dashboard calls `/api/run` with `{action, args, token}`; the server validates against the allowlist, runs it, writes the result + an `activity_log` row, returns status.
- **Allowlisted actions (v1):** create/update entity, trigger VICE SELLER run, call ATLAS X (AI Gateway) for a generation, call an external API, enqueue a background job.
- **Security:** auth token (server-side secret); per-action input validation; **no arbitrary shell**; secrets only on the server. CORS limited to the universe origin.
- **Local command execution** (running things on *your machine*) is explicitly **out of scope for the web app** — that needs a separate local companion agent (a later phase); the web Action Runner covers cloud/API/DB/agent actions.

## 6. Data model (Supabase `hk23`, extends what exists)

- `entities`, `relationships`, `activity_log` (exist).
- Notes & tasks: model as `entities` with `kind='note'|'task'` + `meta` (status, body) — reuses the NeuralHub RLS (`meta.nh='1'`) so the browser can write them. No new tables needed for v1.
- Actions: definitions live in server code (allowlist); each run logs to `activity_log`.

## 7. Roadmap (increments — ordered, build only after approval)

0. **(done)** NeuralHub functional layer + Supabase writes on v1 (`hk23-universe.html`).
1. **Universe Dashboard MVP** — Overview + Notes + Tasks + Nodes, all persisting to Supabase (no backend yet; uses Supabase directly via the publishable key + nh RLS).
2. **Action Runner** — the Vercel `/api/run` mini-backend with allowlist + auth; Dashboard "Execute" + "Worlds launch" wired; everything logs to `activity_log`.
3. **Rugby Vice world** — enter RV from a planet; embed/route to the RV app; kick tracker tested with a player.
4. **Wire other worlds** — ViceGolfer, ATLAS X agent (in-universe assistant), VICE SELLER triggers, Proof of Work.
5. **Polish** — admin toggles, theming, manipulate-mode (the earlier parked Admin spec), NFT, access gates.

## 8. Tech stack

- Universe + Dashboard: static HTML + canvas + `supabase-js` (publishable key, RLS).
- Action Runner: Vercel serverless (Node), secrets server-side, auth token, AI Gateway for AI actions.
- Memory: Supabase project `iiqhhglgjsbnuihythko`, schema `hk23`.

## 9. Real today vs pending

- **Real now:** galaxy/neural brain; NeuralHub create/edit nodes + relationships persisted to Supabase; Rugby Vice app (cards, evaluation, kick tracker, i18n) running locally; 33 entities incl. prints in DB.
- **Pending:** the Dashboard, the Action Runner backend, world integration (RV first), wiring the other worlds.

## 10. Decisions (locked 2026-06-20)

- **Dashboard host:** extend `hk23-universe.html` (has NeuralHub + Supabase). ✅
- **Execution auth:** single shared token (simple, single-user). ✅
- **Build order:** start at increment 1 (Dashboard MVP). ✅
- Rugby Vice integration approach (route vs iframe vs port): decide at increment 3.
- Local companion agent (on-machine command exec): later phase, after the cloud Action Runner.

### Increment 1 — Dashboard MVP (build now)
Additive overlay in `hk23-universe.html` (same pattern as the NeuralHub module), `window.DASH`:
- **Overview** — live counts (entities, notes, tasks) + recent `activity_log`, read from Supabase.
- **Notes** — list + add; persists as an entity `{level:'node', kind:'system', meta:{nh:'1', kind:'note', body, title}}` (reuses NeuralHub nh-RLS; no enum/schema change).
- **Tasks** — list + add + status toggle (pendiente→haciendo→hecho); entity `meta.kind='task'`, `meta.status`.
- **Nodes** — quick link to the existing NeuralHub editor (create/edit planets).
- **Worlds** — launch buttons (links) to the worlds (RV, ViceGolfer, ATLAS X…).
- **Execute** — shown but disabled ("requiere Action Runner — increment 2").
Persistence reuses the existing `SB`/`sbEntity` helpers. Reads via REST `select … where meta->>nh=eq.1 & meta->>kind=eq.note|task`.
