-- ============================================================
-- HK23 — 0004  ·  THE COSMOS  +  world cleanup
-- Adds the outermost level (Cosmos), fixes public visibility of the
-- graph (relationships/listings), and disambiguates the IDEAS clash.
-- Idempotent — safe to re-run.
-- ============================================================

-- ---------- 1. COSMOS: the mother level above the multiverse ----------
do $$
declare
  cid uuid;
  mv  uuid := (select id from hk23.entities where slug='hk23-multiverse');
begin
  select id into cid from hk23.entities where slug='hk23-cosmos';
  if cid is null then
    insert into hk23.entities (name, slug, level, kind, parent_id, color, summary, state, meta)
    values ('HK23 COSMOS','hk23-cosmos','cosmos','multiverse', null, '#FF3A1F',
            'The outermost container — where every HK23 multiverse is born. Everything is monetizable, documented, raw.',
            'star', jsonb_build_object('public',true,'tagline','Everything is monetizable. Documented. Raw.'))
    returning id into cid;
  else
    update hk23.entities set color='#FF3A1F', state='star',
      meta = meta || jsonb_build_object('public',true,'tagline','Everything is monetizable. Documented. Raw.')
    where id=cid;
  end if;
  -- the multiverse now hangs from the cosmos
  if mv is not null then update hk23.entities set parent_id=cid where id=mv; end if;
end $$;

-- ---------- 2. make the GRAPH publicly visible (RLS read policies) ----------
-- relationships were owner-only → invisible to the public site. Allow read
-- when the source entity is public.
drop policy if exists "rel public read" on hk23.relationships;
create policy "rel public read" on hk23.relationships for select
  using (exists (select 1 from hk23.entities e
                 where e.id = relationships.from_id
                   and coalesce(e.meta->>'public','false') = 'true'));

drop policy if exists "listings public read" on hk23.listings;
create policy "listings public read" on hk23.listings for select
  using (exists (select 1 from hk23.entities e
                 where e.id = listings.entity_id
                   and coalesce(e.meta->>'public','false') = 'true'));

-- ---------- 3. disambiguate the duplicate "IDEAS" ----------
-- galaxy 'stage-ideas' stays IDEAS; the capture-bucket node becomes INBOX.
update hk23.entities
  set name='INBOX', summary='Raw ideas with no home yet — the capture bucket.'
  where slug='ideas_pl';

-- ---------- 4. seed gravity so the universe feels alive (varied orb sizes) ----------
update hk23.entities set metrics = metrics || '{"activity":18,"revenue":62}'::jsonb where slug='arteworld';
update hk23.entities set metrics = metrics || '{"activity":14}'::jsonb              where slug='vicegolfer';
update hk23.entities set metrics = metrics || '{"activity":9}'::jsonb               where slug='viceai';
update hk23.entities set metrics = metrics || '{"activity":7}'::jsonb               where slug='hk23hub';
update hk23.entities set metrics = metrics || '{"activity":6,"revenue":40}'::jsonb  where slug='marketplace';
update hk23.entities set metrics = metrics || '{"activity":5}'::jsonb               where slug='laiglesia';
-- multiverse + cosmos glow brightest
update hk23.entities set metrics = metrics || '{"activity":40,"revenue":102}'::jsonb where slug='hk23-multiverse';
update hk23.entities set metrics = metrics || '{"activity":60,"revenue":102}'::jsonb where slug='hk23-cosmos';

-- ============================================================
-- end 0004 — the world is ordered; the cosmos is born.
-- ============================================================
