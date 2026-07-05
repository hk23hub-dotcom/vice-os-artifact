-- ============================================================
-- HK23 — 0009 · Constitution alignment  (ADDITIVE · IDEMPOTENT · REVIEW BEFORE APPLYING)
-- Closes the gaps the HK23 constitution identifies in the live body (see hk23-constitution/MAPPING.md):
--   • L12  Spark/Potential — a pre-star state for latent ideas
--   • L8   why_exists — every entity can answer "why do I exist?"
--   • L3   version history — every update snapshots the prior state
--   • L2   archived_at + a no-hard-delete policy (preferred over DELETE)
-- Nothing is dropped. Safe to re-run.
-- ============================================================

-- L12 · Potential is a first-class, pre-'star' state for Sparks (latent, waiting — never "dead").
-- NOTE: ALTER TYPE ADD VALUE may need to run OUTSIDE a transaction. If your runner wraps migrations
-- in a tx and errors, run just this line on its own first.
alter type hk23.entity_state add value if not exists 'potential' before 'star';

-- L8 · Self-Awareness: an explicit justification field.
alter table hk23.entities add column if not exists why_exists text;

-- L2 · Persistence: record archival time; prefer state='archived' over a hard DELETE.
alter table hk23.entities add column if not exists archived_at timestamptz;

-- L3 · Versioning: snapshot the prior state on every update. Knowledge compounds; nothing is lost.
create table if not exists hk23.entity_versions (
  id         uuid primary key default gen_random_uuid(),
  entity_id  uuid not null references hk23.entities(id) on delete cascade,
  version    int  not null,
  snapshot   jsonb not null,
  changed_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists entity_versions_idx on hk23.entity_versions(entity_id, version desc);

create or replace function hk23.snapshot_version() returns trigger as $$
declare v int;
begin
  select coalesce(max(version),0)+1 into v from hk23.entity_versions where entity_id = old.id;
  insert into hk23.entity_versions(entity_id, version, snapshot, changed_by)
  values (old.id, v, to_jsonb(old), auth.uid());
  return new;
end; $$ language plpgsql;

drop trigger if exists entities_versioned on hk23.entities;
create trigger entities_versioned before update on hk23.entities
  for each row execute function hk23.snapshot_version();

-- ---------- POLICY NOTES (apply consciously — intentionally NOT auto-enforced here) ----------
-- L2  no-hard-delete: archive instead of delete →  update hk23.entities set state='archived', archived_at=now() where id=…;
-- L12 rollup exemption: hk23.rollup_activity() must NOT mark state IN ('potential','archived') as 'fading'/'dead'.
--     A dormant Spark is waiting, not dead. Patch that function when you're ready (left untouched here on purpose).
