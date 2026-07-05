# HK23 Constitution ↔ Vice OS (Supabase `hk23`) — Mapping

> How the HK23 OS constitution (built in Cowork) maps onto the live Vice OS schema.
> Vice OS is the **body** (real, deployed). The constitution is the **brain** (laws, governance, Aria).
> Canonical constitution lives in the Cowork "HK23 OS" project; this maps it onto reality.

## The headline: you built the same model twice, and it agrees

| Constitution primitive / law | Vice OS Supabase (`hk23` schema) | Status |
|---|---|---|
| **Artifact** (universal Node) | `entities` (level node…cosmos; kind idea/project/book/product/agent/asset) | ✅ match |
| **Relationship** (typed Edge) | `relationships` (type, strength, source) | ✅ match |
| **Event / Outcome** (event-sourced truth, L2/L3) | `activity_log` (append rows; time-decayed gravity, half-life ~7d) | ✅ match |
| **Similarity (machine) vs Resonance (human)** — Review Note **O5** | `relationships.source = 'ai' \| 'manual'` + type `ai_suggested` | ✅ **already shipped** |
| **L7 Confidence** | `relationships.strength` (0–1) | ✅ match |
| **L6 Provenance** | `entities.owner_id`, `relationships.source`, `created_at` | ✅ match |
| **L2 Persistence** (archive ≠ delete) | `entity_state` includes `fading/dead/archived` | ⚠️ partial — schema has `ON DELETE CASCADE`; adopt a no-hard-delete policy |
| **L3 Versioning** | `updated_at` trigger + `activity_log` | ⚠️ gap — no full version history table |
| **creates-chain → Revenue** | `relationships` (`derived_from`,`monetizes`) + flow `stage-revenue` + `listings` (Etsy) | ✅ match |
| **Spark / Potential** (pre-artifact, L12/L13) | closest = `entity_state='star'`; no explicit `potential` | ⚠️ add `potential` state (or treat `star` as Spark) |
| **L8 Justification** ("why do I exist?") | `entities.summary` / `meta` | ⚠️ gap — add an explicit `why_exists` |
| **Lifecycle** (Spark→…→Project→Reborn) | `entity_state` star→growing→alive→fading→dead→archived (+ Reborn = revive) | ✅ richer on Vice OS side |
| **Flow** (macro lifecycle) | `flow_stages`: Ideas→Creation→Products→Community→Revenue→Resources→**(loop)** | ✅ match (this is the creates-chain + Reborn torus) |
| **L1 Identity** (immutable id) | `entities.id` uuid | ✅ — but Vice OS uses uuid, not `HK23-XXXX` |

## What reality (Vice OS) teaches the constitution → candidate amendments (governance ladder)
1. **5-level containment**: Cosmos ▸ Multiverse ▸ Galaxy ▸ System ▸ Node — richer than the constitution's flat node model. *Reality Observation → propose to Ontology (HK23-0003).*
2. **Gravity / time-decay** as the activity & value metric (`rollup_activity`, half-life). The constitution's "value is computed from outcomes" (L10) gains a concrete mechanism. *Promote toward Blueprint Revision.*
3. **State nuance** (`fading`, `dead`) beyond archive — a graceful decay model. *Reality Observation.*

## What the constitution gives Vice OS (gaps to close)
- An explicit **`potential` Spark state** (so latent ideas are first-class and exempt from pressure — L12).
- A **`why_exists` justification** field (L8 / Self-Awareness Protocol).
- A **version history** (L3) — even a light `entity_versions` table.
- A **no-hard-delete policy** (L2) — prefer `state='archived'` over `DELETE` despite the cascade.
- **Governance**: the promotion ladder (Reality Observation → … → Constitutional Amendment) so Vice OS evolves deliberately.

## Identity reconciliation
Keep **uuid** as the canonical primary key (it's deployed). Treat `HK23-XXXX` as an optional human-readable **slug/alias** on `entities.slug`. Both satisfy L1 (immutable, unique); no migration needed.

## Single source of truth
**Supabase is the store. The constitution governs it. The Cowork event-log kernel was the proof-of-laws, not a competing database.** No data fork.
