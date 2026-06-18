-- ============================================================
-- HK23 — SEED 0002  ·  migrate current universe into hk23.entities
-- Multiverse ▸ 4 Galaxies ▸ Systems ▸ (Etsy products as nodes)
-- Idempotent (keyed by slug). Re-run safe.
-- ============================================================

-- ---------- helper: upsert one entity by slug ----------
create or replace function hk23._seed(
  p_name text, p_slug text, p_level hk23.entity_level, p_kind hk23.entity_kind,
  p_parent_slug text, p_color text, p_summary text, p_world_id text default null, p_link text default null
) returns uuid as $$
declare pid uuid; eid uuid;
begin
  if p_parent_slug is not null then
    select id into pid from hk23.entities where slug = p_parent_slug limit 1;
  end if;
  select id into eid from hk23.entities where slug = p_slug limit 1;
  if eid is null then
    insert into hk23.entities (name, slug, level, kind, parent_id, color, summary, world_id, link, state, meta)
    values (p_name, p_slug, p_level, p_kind, pid, p_color, p_summary, p_world_id, p_link, 'alive',
            '{"public":true}'::jsonb)
    returning id into eid;
  else
    update hk23.entities set name=p_name, level=p_level, kind=p_kind, parent_id=pid,
      color=p_color, summary=p_summary, world_id=p_world_id, link=p_link,
      meta = meta || '{"public":true}'::jsonb
    where id = eid;
  end if;
  return eid;
end; $$ language plpgsql;

-- ---------- MULTIVERSE ----------
select hk23._seed('HK23','hk23-multiverse','multiverse','multiverse', null,
  '#FF3A1F','The HK23 multiverse — everything is monetizable, documented, raw.');

-- ---------- GALAXIES ----------
select hk23._seed('Performance Galaxy','galaxy-performance','galaxy','galaxy','hk23-multiverse',
  '#AAFF00','Sport & performance systems.');
select hk23._seed('Creator Galaxy','galaxy-creator','galaxy','galaxy','hk23-multiverse',
  '#FF3A1F','Art, music, books & self-expression.');
select hk23._seed('AI Galaxy','galaxy-ai','galaxy','galaxy','hk23-multiverse',
  '#9B5DE5','Agents, automations & the agent network.');
select hk23._seed('Business Galaxy','galaxy-business','galaxy','galaxy','hk23-multiverse',
  '#FFD200','Marketplace, crypto, mining & ventures.');

-- ---------- SYSTEMS (planets) ----------
-- Performance
select hk23._seed('VICEGOLFER','vicegolfer','system','system','galaxy-performance',
  '#AAFF00','Golf Performance OS','vicegolfer','https://vicegolfer.vercel.app');
select hk23._seed('RUGBY VICE','rugbyvice','system','system','galaxy-performance',
  '#00F0FF','Kick Tracker 2D','rugbyvice');
select hk23._seed('TEE CLUB','teeclub','system','system','galaxy-performance',
  '#F97316','Golf Simulator Franchise','teeclub');
-- Creator
select hk23._seed('ARTE WORLD','arteworld','system','system','galaxy-creator',
  '#FF3A1F','The Gallery · JC Art','arteworld','https://www.etsy.com/shop/HK23Studio');
select hk23._seed('MVB','mvb','system','system','galaxy-creator',
  '#6366F1','Music Vice Beats','mvb');
select hk23._seed('VICE SOUL','soul','system','system','galaxy-creator',
  '#9B5DE5','Cosmic Blueprint · astrology, human design, numerology','soul');
select hk23._seed('HK23 HUB','hk23hub','system','system','galaxy-creator',
  '#10B981','Blog · Books · Digital Store','hk23hub');
-- AI
select hk23._seed('VICE AI','viceai','system','system','galaxy-ai',
  '#9B5DE5','24/7 Agent Network','viceai');
select hk23._seed('CMDS','cmds_pl','system','system','galaxy-ai',
  '#00F0FF','Command Center','cmds_pl');
-- Business
select hk23._seed('MARKETPLACE','marketplace','system','system','galaxy-business',
  '#FFD200','Everything is for sale','marketplace');
select hk23._seed('CRYPTO VICE','cryptovice','system','system','galaxy-business',
  '#FF2D78','DeFi · Portfolio · On-chain','cryptovice');
select hk23._seed('LA IGLESIA','laiglesia','system','system','galaxy-business',
  '#FFD200','Gold · IV Región · 3,676 ha','laiglesia');
select hk23._seed('PROJECTS','projects_pl','system','system','galaxy-business',
  '#B84DFF','Historical · Pitches · Portfolio','projects_pl');
-- Orphan ideas (live directly under the multiverse)
select hk23._seed('IDEAS','ideas_pl','node','idea','hk23-multiverse',
  '#FFD200','Everything without a home yet.');

-- ---------- ETSY PRODUCTS (nodes under ARTE WORLD) + listings ----------
do $$
declare
  arte uuid := (select id from hk23.entities where slug='arteworld');
  rec record; nid uuid;
  prods text[][] := array[
    ['mj-01','Surreal Parrot Forest Art Print','4517395889','7.50'],
    ['mj-02','Googly Eyes Character Portrait','4517399434','6.50'],
    ['mj-03','Psychedelic Woman Portrait','4517405193','8.00'],
    ['mj-04','Cyberpunk Circuit Face','4517406341','7.00'],
    ['mj-05','Black & White Graffiti','4517402936','6.00'],
    ['mj-06','Dark Expressionist Face','4517408831','7.00'],
    ['mj-07','Folk Owl Forest Art Print','4517410085','7.50'],
    ['mj-08','Geometric Stag Art Print','4517406914','8.00'],
    ['mj-09','Autumn Deer Portrait','4517408082','8.00'],
    ['mj-10','Mystical Golden Owl Art Print','4517415207','8.50']
  ];
  i int;
begin
  for i in 1 .. array_length(prods,1) loop
    select id into nid from hk23.entities where slug = prods[i][1];
    if nid is null then
      insert into hk23.entities (name, slug, level, kind, parent_id, color, summary, state, link, meta)
      values (prods[i][2], prods[i][1], 'node','product', arte, '#FF3A1F',
              'HK23 digital art print — instant download.', 'alive',
              'https://www.etsy.com/listing/'||prods[i][3],
              '{"public":true}'::jsonb)
      returning id into nid;
    end if;
    -- listing
    if not exists (select 1 from hk23.listings where entity_id = nid) then
      insert into hk23.listings (entity_id, price, currency, status, external_url, source)
      values (nid, prods[i][4]::numeric, 'USD', 'active',
              'https://www.etsy.com/listing/'||prods[i][3], 'etsy');
    end if;
    -- ARTE WORLD monetizes each product (graph edge)
    insert into hk23.relationships (from_id, to_id, type, strength, source)
    values (arte, nid, 'monetizes', 0.8, 'system')
    on conflict (from_id, to_id, type) do nothing;
  end loop;
end $$;

-- ---------- seed some activity so nothing is 'dead' on day 1 ----------
insert into hk23.activity_log (entity_id, kind, weight)
select id, 'create', 5 from hk23.entities where slug in
  ('vicegolfer','arteworld','viceai','hk23-multiverse');

-- ============================================================
-- done. (optional cleanup: drop function hk23._seed)
-- ============================================================
