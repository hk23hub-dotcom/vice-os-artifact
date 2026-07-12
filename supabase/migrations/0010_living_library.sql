-- ============================================================
-- HK23 — SEED 0010 · LIVING LIBRARY — books & chapters in the universe
-- LIVING LIBRARY (system, under CREATION) ▸ REWIRED (book) ▸ episodes (nodes).
-- Sellable episodes get a Gumroad listing → cosmos buy panel shows price + BUY.
-- Idempotent (keyed by slug). Re-run safe.
-- ============================================================

do $$
declare
  -- ⬇⬇⬇  EDIT PRICES / URLS HERE  ⬇⬇⬇
  ep1_url   text    := 'https://hk23hub.gumroad.com/l/oaqgxu';  -- REWIRED #001 live listing
  ep1_price numeric := 1.99;   -- live price today; reprice to 11 on Gumroad, then here
  store_url text    := 'https://hk23hub.gumroad.com';
  -- ⬆⬆⬆ --------------------------------- ⬆⬆⬆

  creation uuid := (select id from hk23.entities where slug = 'stage-creation');
  market   uuid := (select id from hk23.entities where slug = 'marketplace');
  lib uuid; bk uuid; ep uuid;

  eps constant jsonb := '[
    {"n":1,"slug":"rewired-001","name":"REWIRED #001 — The Slave Contract","state":"alive",
     "sum":"The invisible contract you signed with the machine — and what it costs to read the fine print. Published."},
    {"n":2,"slug":"rewired-002","name":"REWIRED #002 — The Mirror","state":"growing",
     "sum":"The machine was never the point. The mirror was. A recursive identity engine — a mirror with memory. Written, unpublished."},
    {"n":3,"slug":"rewired-003","name":"REWIRED #003 — The Mask","state":"growing",
     "sum":"Who speaks when you type? If you do not know yet, the mask is still wearing you. Written, unpublished."},
    {"n":4,"slug":"rewired-004","name":"REWIRED #004 — The Loop","state":"star",
     "sum":"Planned. The escalation cycle between operator and adaptive system."},
    {"n":5,"slug":"rewired-005","name":"REWIRED #005 — The Signal","state":"star",
     "sum":"Planned."},
    {"n":6,"slug":"rewired-006","name":"REWIRED #006 — The Performance","state":"star",
     "sum":"Planned."},
    {"n":7,"slug":"rewired-007","name":"REWIRED #007 — The Observer","state":"star",
     "sum":"Planned."}
  ]'::jsonb;
  e jsonb;
begin
  -- 1) LIVING LIBRARY system under CREATION
  select id into lib from hk23.entities where slug = 'living-library';
  if lib is null then
    insert into hk23.entities (name, slug, level, kind, parent_id, color, summary, state, metrics, meta)
    values ('LIVING LIBRARY', 'living-library', 'system', 'system', creation, '#4EA8FF',
            'The publication engine of the HK23 Universe — books, essay series and chapters born from the Living Archive. Everything here is readable, evolving, and for sale.',
            'alive', '{"activity":3,"revenue":0,"importance":3,"last_active":null}'::jsonb,
            '{"public":true,"module":"living-library"}'::jsonb)
    returning id into lib;
  end if;

  -- 2) REWIRED — the book/series entity
  select id into bk from hk23.entities where slug = 'rewired';
  if bk is null then
    insert into hk23.entities (name, slug, level, kind, parent_id, color, summary, state, link, metrics, meta)
    values ('REWIRED', 'rewired', 'node', 'book', lib, '#4EA8FF',
            'Cinematic philosophy essay series by HK23 Story Forge. What happens to identity, perception and consciousness when modern minds interact continuously with adaptive systems. Modern mythology / psychological cyber-noir — the human mind is the protagonist, never the machine.',
            'alive', store_url,
            '{"activity":5,"revenue":0,"importance":3,"last_active":null}'::jsonb,
            '{"public":true,"series":"rewired","flagship":true,"product_type":"book"}'::jsonb)
    returning id into bk;
  else
    update hk23.entities set parent_id = lib, kind='book', link=store_url,
      meta = meta || '{"public":true,"series":"rewired"}'::jsonb where id = bk;
  end if;

  insert into hk23.relationships (from_id, to_id, type, strength, source)
  values (lib, bk, 'owns', 1.0, 'system')
  on conflict (from_id, to_id, type) do nothing;

  -- 3) episodes as chapter nodes under REWIRED
  for e in select * from jsonb_array_elements(eps) loop
    select id into ep from hk23.entities where slug = e->>'slug';
    if ep is null then
      insert into hk23.entities (name, slug, level, kind, parent_id, color, summary, state, link, metrics, meta)
      values (e->>'name', e->>'slug', 'node', 'book', bk, '#4EA8FF',
              e->>'sum', (e->>'state')::hk23.entity_state,
              case when (e->>'n')::int = 1 then ep1_url else null end,
              jsonb_build_object('activity', case when e->>'state'='star' then 0 else 2 end,
                                 'revenue', 0,
                                 'importance', case when e->>'state'='alive' then 2 else 1 end,
                                 'last_active', null),
              jsonb_build_object('public', true, 'series', 'rewired',
                                 'episode', (e->>'n')::int, 'product_type', 'chapter'))
      returning id into ep;
    end if;

    insert into hk23.relationships (from_id, to_id, type, strength, source)
    values (bk, ep, 'owns', 1.0, 'system')
    on conflict (from_id, to_id, type) do nothing;
  end loop;

  -- 4) listing: #001 is live on Gumroad
  select id into ep from hk23.entities where slug = 'rewired-001';
  if not exists (select 1 from hk23.listings where entity_id = ep) then
    insert into hk23.listings (entity_id, price, currency, status, external_url, source)
    values (ep, ep1_price, 'USD', 'active', ep1_url, 'gumroad');
  else
    update hk23.listings set price = ep1_price, status='active',
      external_url = ep1_url, source='gumroad' where entity_id = ep;
  end if;

  insert into hk23.relationships (from_id, to_id, type, strength, source)
  values (market, ep, 'monetizes', 1.0, 'system')
  on conflict (from_id, to_id, type) do nothing;

  -- 5) day-1 pulse so nothing spawns dead / black-hole bait
  insert into hk23.activity_log (entity_id, kind, weight)
  select id, 'create', 5 from hk23.entities
  where slug in ('living-library','rewired','rewired-001','rewired-002','rewired-003');
end $$;

-- ============================================================
-- done. LIVING LIBRARY appears under CREATION; REWIRED + 7 chapters
-- orbit it; #001 carries a live $ listing → BUY ON GUMROAD.
-- ============================================================
