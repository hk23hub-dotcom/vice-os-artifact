-- ============================================================
-- HK23 — SEED 0005  ·  ATLAS X — flagship digital product
-- A 'product' node under MARKETPLACE + a Gumroad listing.
-- Hybrid checkout: external_url = Gumroad today; swap for Stripe later.
-- Idempotent (keyed by slug 'atlas-x'). Re-run safe.
-- ============================================================

do $$
declare
  -- ⬇⬇⬇  EDIT THESE TWO LINES ONLY  ⬇⬇⬇
  atlas_url   text    := 'https://hk23hub.gumroad.com/l/ljkokj';  -- live Gumroad listing
  atlas_price numeric := 37.00;                                                 -- "cheap" — change anytime
  -- ⬆⬆⬆ ------------------------------- ⬆⬆⬆

  market uuid := (select id from hk23.entities where slug = 'marketplace');
  nid uuid;
begin
  -- 1) the product entity (under MARKETPLACE)
  select id into nid from hk23.entities where slug = 'atlas-x';
  if nid is null then
    insert into hk23.entities (name, slug, level, kind, parent_id, color, summary, state, link, meta)
    values ('ATLAS X', 'atlas-x', 'node', 'product', market, '#FFD200',
            'Personal Intelligence OS — turn scattered ideas into executed revenue. Templates + automation system, sold as a plug-and-play kit.',
            'alive', atlas_url,
            '{"public":true,"flagship":true,"product_type":"digital"}'::jsonb)
    returning id into nid;
  else
    update hk23.entities
       set name='ATLAS X', level='node', kind='product', parent_id=market,
           color='#FFD200', link=atlas_url,
           summary='Personal Intelligence OS — turn scattered ideas into executed revenue. Templates + automation system, sold as a plug-and-play kit.',
           meta = meta || '{"public":true,"flagship":true,"product_type":"digital"}'::jsonb
     where id = nid;
  end if;

  -- 2) the listing (Gumroad now → swap external_url for Stripe later)
  if not exists (select 1 from hk23.listings where entity_id = nid) then
    insert into hk23.listings (entity_id, price, currency, status, external_url, source)
    values (nid, atlas_price, 'USD', 'active', atlas_url, 'gumroad');
  else
    update hk23.listings
       set price = atlas_price, currency='USD', status='active',
           external_url = atlas_url, source='gumroad'
     where entity_id = nid;
  end if;

  -- 3) MARKETPLACE monetizes ATLAS X (graph edge)
  insert into hk23.relationships (from_id, to_id, type, strength, source)
  values (market, nid, 'monetizes', 1.0, 'system')
  on conflict (from_id, to_id, type) do nothing;

  -- 4) light activity so it shows as alive on day 1
  insert into hk23.activity_log (entity_id, kind, weight)
  values (nid, 'create', 5);
end $$;

-- ============================================================
-- done.  After paste-in: re-run this file (safe), ATLAS X appears
-- in MARKETPLACE with a live "buy" link.
-- ============================================================
