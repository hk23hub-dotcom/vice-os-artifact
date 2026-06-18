-- ============================================================
-- HK23 — 0003  ·  Galaxies become STAGES of the energy cycle
-- Ideas → Creation → Products → Community → Revenue → Resources → (loop)
-- Reframes the multiverse as a living torus of transformation.
-- Idempotent.
-- ============================================================

-- ---------- the 6 flow stages (replace the 4 category galaxies) ----------
do $$
declare
  mv uuid := (select id from hk23.entities where slug='hk23-multiverse');
  stages text[][] := array[
    ['stage-ideas',    'IDEAS',    '#FFD200','0','Where everything is born — raw ideas, pitches, signals.'],
    ['stage-creation', 'CREATION', '#FF3A1F','1','Art, music, words, identity — ideas made real.'],
    ['stage-products', 'PRODUCTS', '#F97316','2','Creations turned into things people can own.'],
    ['stage-community','COMMUNITY','#00F0FF','3','The players, audience & people around it all.'],
    ['stage-revenue',  'REVENUE',  '#AAFF00','4','Value flowing back in — sales, income, traction.'],
    ['stage-resources','RESOURCES','#9B5DE5','5','Capital, tools & assets that fuel the next ideas.']
  ];
  i int; sid uuid;
begin
  for i in 1 .. array_length(stages,1) loop
    select id into sid from hk23.entities where slug = stages[i][1];
    if sid is null then
      insert into hk23.entities (name,slug,level,kind,parent_id,color,summary,state,meta)
      values (stages[i][2], stages[i][1], 'galaxy','galaxy', mv, stages[i][3], stages[i][5], 'alive',
              jsonb_build_object('public',true,'flow_order',stages[i][4]::int));
    else
      update hk23.entities set name=stages[i][2], color=stages[i][3], summary=stages[i][5],
        parent_id=mv, level='galaxy', kind='galaxy',
        meta = meta || jsonb_build_object('public',true,'flow_order',stages[i][4]::int)
      where id=sid;
    end if;
  end loop;
end $$;

-- ---------- re-parent systems into their stage ----------
update hk23.entities set parent_id=(select id from hk23.entities where slug='stage-ideas')
  where slug in ('ideas_pl','projects_pl','cmds_pl');
update hk23.entities set parent_id=(select id from hk23.entities where slug='stage-creation')
  where slug in ('arteworld','mvb','soul','hk23hub');
update hk23.entities set parent_id=(select id from hk23.entities where slug='stage-products')
  where slug in ('teeclub');
update hk23.entities set parent_id=(select id from hk23.entities where slug='stage-community')
  where slug in ('vicegolfer','rugbyvice');
update hk23.entities set parent_id=(select id from hk23.entities where slug='stage-revenue')
  where slug in ('marketplace');
update hk23.entities set parent_id=(select id from hk23.entities where slug='stage-resources')
  where slug in ('cryptovice','laiglesia','viceai');

-- ---------- retire the old category galaxies (now childless) ----------
delete from hk23.entities
  where slug in ('galaxy-performance','galaxy-creator','galaxy-ai','galaxy-business');

-- ---------- the flow itself as graph edges (stage → next stage) ----------
do $$
declare order_slugs text[] := array['stage-ideas','stage-creation','stage-products','stage-community','stage-revenue','stage-resources'];
  i int; a uuid; b uuid;
begin
  for i in 1 .. array_length(order_slugs,1) loop
    a := (select id from hk23.entities where slug=order_slugs[i]);
    b := (select id from hk23.entities where slug=order_slugs[ (i % array_length(order_slugs,1)) + 1 ]);
    if a is not null and b is not null then
      insert into hk23.relationships (from_id,to_id,type,strength,source)
      values (a,b,'related',1.0,'system') on conflict (from_id,to_id,type) do nothing;
    end if;
  end loop;
end $$;
