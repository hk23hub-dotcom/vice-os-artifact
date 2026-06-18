-- ============================================================
-- HK23 — MULTIVERSE OS  ·  Schema 0001
-- Cosmos ▸ Multiverse ▸ Galaxy ▸ System ▸ Node  (graph-native)
-- Lives in a dedicated `hk23` schema inside the existing project.
-- After applying: Supabase → Settings → API → add `hk23` to "Exposed schemas".
-- Idempotent — safe to re-run.
-- ============================================================

create schema if not exists hk23;

-- ---------- ENUMS ----------
do $$ begin create type hk23.entity_level as enum ('cosmos','multiverse','galaxy','system','node');
exception when duplicate_object then null; end $$;

do $$ begin create type hk23.entity_kind as enum (
  'multiverse','galaxy','system','node','agent','asset','idea','project','book','product');
exception when duplicate_object then null; end $$;

do $$ begin create type hk23.entity_state as enum ('star','growing','alive','fading','dead','archived');
exception when duplicate_object then null; end $$;

do $$ begin create type hk23.rel_type as enum (
  'related','references','depends_on','derived_from','monetizes','owns','ai_suggested');
exception when duplicate_object then null; end $$;

do $$ begin create type hk23.rel_source as enum ('manual','ai','system');
exception when duplicate_object then null; end $$;

-- ---------- ENTITIES (the universe) ----------
create table if not exists hk23.entities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text,
  level       hk23.entity_level not null,
  kind        hk23.entity_kind  not null,
  parent_id   uuid references hk23.entities(id) on delete cascade,   -- containment tree
  owner_id    uuid references auth.users(id) default auth.uid(),
  color       text, icon text, summary text,
  world_id    text,            -- opens an immersive world (worlds/*.json)
  link        text,            -- external deep-link
  state       hk23.entity_state not null default 'star',
  metrics     jsonb not null default '{"activity":0,"revenue":0,"importance":0,"last_active":null}'::jsonb,
  position    jsonb,           -- saved layout {x,y}; null = physics computes
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists entities_parent_idx on hk23.entities(parent_id);
create index if not exists entities_level_idx  on hk23.entities(level);
create index if not exists entities_kind_idx   on hk23.entities(kind);
create index if not exists entities_owner_idx  on hk23.entities(owner_id);

-- ---------- RELATIONSHIPS (the graph) ----------
create table if not exists hk23.relationships (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references hk23.entities(id) on delete cascade,
  to_id      uuid not null references hk23.entities(id) on delete cascade,
  type       hk23.rel_type   not null default 'related',
  strength   real            not null default 0.5,
  source     hk23.rel_source not null default 'manual',
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (from_id, to_id, type),
  check (from_id <> to_id),
  check (strength >= 0 and strength <= 1)
);
create index if not exists rel_from_idx on hk23.relationships(from_id);
create index if not exists rel_to_idx   on hk23.relationships(to_id);
create index if not exists rel_type_idx on hk23.relationships(type);

-- ---------- ACTIVITY LOG (event-sourced → gravity/growth) ----------
create table if not exists hk23.activity_log (
  id         uuid primary key default gen_random_uuid(),
  entity_id  uuid references hk23.entities(id) on delete cascade,
  kind       text, weight real default 1, amount numeric,
  created_at timestamptz not null default now()
);
create index if not exists activity_entity_idx on hk23.activity_log(entity_id, created_at desc);

-- ---------- LISTINGS (marketplace · links to Etsy) ----------
create table if not exists hk23.listings (
  id           uuid primary key default gen_random_uuid(),
  entity_id    uuid references hk23.entities(id) on delete cascade,
  price        numeric, currency text default 'USD',
  status       text default 'draft',
  external_url text, source text default 'etsy',
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists listings_entity_idx on hk23.listings(entity_id);

-- ---------- updated_at trigger ----------
create or replace function hk23.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists entities_updated on hk23.entities;
create trigger entities_updated before update on hk23.entities
  for each row execute function hk23.set_updated_at();

-- ---------- recursive tree view ----------
create or replace view hk23.entity_tree as
  with recursive tree as (
    select id, parent_id, name, level, kind, 1 as depth, array[name] as path
    from hk23.entities where parent_id is null
    union all
    select e.id, e.parent_id, e.name, e.level, e.kind, t.depth+1, t.path||e.name
    from hk23.entities e join tree t on e.parent_id = t.id
  ) select * from tree;

-- ---------- activity roll-up (time-decayed, half-life ~7d) ----------
create or replace function hk23.rollup_activity() returns void as $$
begin
  update hk23.entities e set
    metrics = jsonb_set(coalesce(e.metrics,'{}'::jsonb), '{activity}',
      to_jsonb(coalesce((select round(sum(a.weight*exp(-extract(epoch from (now()-a.created_at))/604800))::numeric,2)
        from hk23.activity_log a where a.entity_id=e.id),0))),
    state = case
      when (select max(created_at) from hk23.activity_log a where a.entity_id=e.id) is null then e.state
      when now()-(select max(created_at) from hk23.activity_log a where a.entity_id=e.id) > interval '30 days' then 'dead'
      when now()-(select max(created_at) from hk23.activity_log a where a.entity_id=e.id) > interval '10 days' then 'fading'
      else 'alive' end;
end; $$ language plpgsql;

-- ---------- ROW LEVEL SECURITY ----------
alter table hk23.entities      enable row level security;
alter table hk23.relationships enable row level security;
alter table hk23.activity_log  enable row level security;
alter table hk23.listings      enable row level security;

drop policy if exists "entities owner rw" on hk23.entities;
create policy "entities owner rw" on hk23.entities
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "entities public read" on hk23.entities;
create policy "entities public read" on hk23.entities
  for select using (coalesce(meta->>'public','false') = 'true');

drop policy if exists "rel owner rw" on hk23.relationships;
create policy "rel owner rw" on hk23.relationships
  using (exists (select 1 from hk23.entities e where e.id = relationships.from_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from hk23.entities e where e.id = relationships.from_id and e.owner_id = auth.uid()));

drop policy if exists "activity owner rw" on hk23.activity_log;
create policy "activity owner rw" on hk23.activity_log
  using (exists (select 1 from hk23.entities e where e.id = activity_log.entity_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from hk23.entities e where e.id = activity_log.entity_id and e.owner_id = auth.uid()));

drop policy if exists "listings owner rw" on hk23.listings;
create policy "listings owner rw" on hk23.listings
  using (exists (select 1 from hk23.entities e where e.id = listings.entity_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from hk23.entities e where e.id = listings.entity_id and e.owner_id = auth.uid()));

-- ---------- realtime (universe updates live) ----------
do $$ begin alter publication supabase_realtime add table hk23.entities; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table hk23.relationships; exception when others then null; end $$;

-- ============================================================
-- end 0001 — then expose `hk23` schema in Settings → API
-- ============================================================

-- ---------- grants for Data API (anon/authenticated read) ----------
grant usage on schema hk23 to anon, authenticated;
grant select on all tables in schema hk23 to anon, authenticated;
alter default privileges in schema hk23 grant select on tables to anon, authenticated;
