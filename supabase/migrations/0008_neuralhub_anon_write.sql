-- 0008 · NeuralHub browser write access (additive, secure)
-- Lets the public universe page (hk23-universe.html, anon/publishable key) create &
-- edit ONLY its own nodes — rows tagged meta->>'nh' = '1'. Everything else (prints,
-- systems, multiverse, owner rows) stays read-only to anon. Applied 2026-06-19 via
-- the dashboard Management API (POST /v1/projects/{ref}/database/query).

grant usage on schema hk23 to anon, authenticated;
grant select, insert, update, delete on hk23.entities      to anon, authenticated;
grant select, insert, update, delete on hk23.relationships  to anon, authenticated;

-- ── entities: NeuralHub-tagged rows only ──
drop policy if exists nh_ins_entities on hk23.entities;
create policy nh_ins_entities on hk23.entities for insert
  with check (meta->>'nh' = '1');

drop policy if exists nh_sel_entities on hk23.entities;            -- needed for return=representation
create policy nh_sel_entities on hk23.entities for select
  using (meta->>'nh' = '1');

drop policy if exists nh_upd_entities on hk23.entities;
create policy nh_upd_entities on hk23.entities for update
  using (meta->>'nh' = '1') with check (meta->>'nh' = '1');

drop policy if exists nh_del_entities on hk23.entities;
create policy nh_del_entities on hk23.entities for delete
  using (meta->>'nh' = '1');

-- ── relationships: NeuralHub-tagged rows only ──
drop policy if exists nh_ins_rel on hk23.relationships;
create policy nh_ins_rel on hk23.relationships for insert
  with check (meta->>'nh' = '1');

drop policy if exists nh_sel_rel on hk23.relationships;
create policy nh_sel_rel on hk23.relationships for select
  using (meta->>'nh' = '1');

drop policy if exists nh_upd_rel on hk23.relationships;
create policy nh_upd_rel on hk23.relationships for update
  using (meta->>'nh' = '1') with check (meta->>'nh' = '1');

drop policy if exists nh_del_rel on hk23.relationships;
create policy nh_del_rel on hk23.relationships for delete
  using (meta->>'nh' = '1');
