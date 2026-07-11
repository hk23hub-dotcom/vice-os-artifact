# CRYPTO VICE — Radar Universe (v1) · Design

**Date:** 2026-07-11 · **Status:** approved by JC (chat) · **Owner:** HK23 OS

## What it is

A standalone one-page product: a parallel universe where **the crypto market itself is the cosmos**.
Coins are living bodies; an agent fleet sweeps the market intercepting live data and hunting
momentum/opportunity; every signal routes to Rollbit through the affiliate ref. Free, no signup.

- **File:** `crypto-vice.html` in `~/vice-os-artifact` (same repo, same Vercel deploy).
- **URL:** `hk23universe.vercel.app/crypto-vice` (cleanUrls strips `.html`; always link the clean path).
- **Deploy:** `npx vercel deploy --prod --yes` (repo convention — not git push).
- **Command ritual (product DNA):** the market **auto-ignites on load** (a visitor from a link sees
  life immediately); **C** toggles the live layer off/on · **A** releases/recalls the agent fleet.
  On-screen buttons mirror both keys (mobile has no keyboard).

## Decisions locked (from brainstorm)

1. **v1 is the free radar only.** Pro tier (agent agency / execution) is **out** — deliberately cut to start simple.
2. **Money = Rollbit affiliate** (`https://rollbit.com/trading/<SYM>?b=99fc43c8-9082-4694-963f-197eec8452a0`)
   on every tradeable coin, signal card, and callout + cross-link to the existing VICE FUTURES Desk.
3. **Zero new infrastructure.** No Supabase tables, no new API routes, no cron, no auth, no billing.
4. **Honesty guardrail:** every signal is labeled analysis-not-advice; the futures persona already
   leads with risk and refuses guarantees.

## Architecture

Single self-contained HTML file (repo convention), three client-side modules + one reused server call:

```
crypto-vice.html
├─ MARKET   — data layer: CoinGecko polling, coin state
├─ COSMOS   — render layer: canvas universe, coin bodies, fx
├─ FLEET    — agents: scan loop, scoring, signal events, feed
└─ /api/run — (existing, deployed) futures persona → trade plans
```

### MARKET (data)
- Source: CoinGecko public `GET /api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=150&page=1&sparkline=true&price_change_percentage=1h,24h`.
- One call returns everything (price, mcap, 24h volume, 1h/24h change, 7-day hourly sparkline).
- Poll every **60s** (well under free-tier rate limits; single call per refresh). On fetch failure:
  keep last data, show a stale badge, retry next tick — never a blank universe.
- Rollbit tradeable set: reuse the existing 42-pair `symbol → coingecko-id` map from
  `hk23-universe.html` (CRYPTO_COSMOS `LIST`). Coins in the map deep-link to Rollbit with the ref;
  coins not on Rollbit link to `vice-futures.html` (Desk) instead. Note the `1000PEPE`/`1000SHIB`
  style symbols: the Rollbit symbol is the map key, never the CoinGecko symbol.

### COSMOS (render)
- Full-viewport canvas; each coin a body — **radius ∝ log(market cap)**, **color/pulse by 24h change**
  (green up / red down / VICE palette accents). Hover/tap → name, price, 1h/24h, volume.
- Click/tap a coin → detail card with [Operar en Rollbit ↗] (or [Desk →] fallback) + [Plan de trade].
- Idle drift + parallax starfield; rAF loop with the same visibility guard pattern used in the
  universe (no leaked rAF on hidden tabs — known past bug, don't reintroduce it).

### FLEET (the agents — the product's soul)
- **A** spawns N (~6) scanner UFOs that visibly patrol coins.
- **Scan cadence:** every ~13s the fleet re-scores the market (client-side, real math on real data).
- **Opportunity score** per coin, from normalized components (weights tunable constants):
  - `momentum24` — 24h % change (z-scored across the 150)
  - `momentumNow` — slope of the last ~24 sparkline points (recent push)
  - `volSurge` — 24h volume ÷ market cap, z-scored (unusual activity)
  - `volatility` — sparkline std-dev (movement = opportunity for a futures audience)
- **Signal event:** top scorer above threshold, per-coin **cooldown ~5 min** (no BTC spam).
  Gravity swarm converges on the coin (~7s life), callout card shows coin, move, and *why*
  (which components fired) + the no-advice label + [Rollbit ↗] with the **exact pair** + [Plan de trade].
- **Signal feed:** side panel, session-only in-memory log (max 50), each row re-opens its card.

### Trade plan (reused backend)
- `POST /api/run` `{action:'agent', agent:'futures', input}` with `x-run-token` guest header —
  identical pattern to `vice-futures.html` (429 → friendly "esperá un minuto" message).
- Input auto-composed from the signal: symbol, price, 1h/24h move, volume surge → persona returns
  SESGO / ENTRADA / INVALIDACIÓN / OBJETIVOS / R:R.

### i18n
- ES/EN toggle via the `data-i18n` + dictionary pattern from `landing.html`. Neutral Latin American
  Spanish (tuteo). All signal/guardrail copy exists in both languages.

## Out of scope (v1) — explicit

Pro tier · accounts/auth · Stripe · exchange API keys · auto-execution · server-side scanners ·
alerts (email/Telegram/push) · signal history persistence · new Supabase schema · new domains.

## Verification (browser pane, before deploy)

1. Market loads (150 coins render, prices sane); kill network → stale badge, no blank canvas.
2. **C** and **A** toggle correctly (keys + buttons); fleet visibly patrols.
3. A signal fires within ~1 min of fleet launch; card shows the why + label; cooldown respected.
4. Trade plan returns from `/api/run`; 429 path shows the friendly message.
5. Every Rollbit link carries `?b=99fc43c8…` with the correct Rollbit symbol (spot-check 1000PEPE).
6. Non-Rollbit coin falls back to the Desk link.
7. Mobile viewport (375px): readable, buttons usable, no horizontal scroll. No console errors; no
   rAF leak when tab hidden.

## Future (not now)

Pro tier (agent agency, non-custodial execution) · dedicated worker for real-time scanning ·
signal persistence + performance tracking · listing CRYPTO VICE as a product entity in the hk23 graph.
