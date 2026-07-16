-- ============================================================
-- HK23 — SEED · hk23_products
-- Imports the HK23 Product Factory catalog (P01–P23) into the live
-- graph so the products render as bodies in cosmos.html / multiverse.html.
--
-- Shape (matches the 0002 / 0005 convention exactly):
--   • 1 parent  : "HK23 Product Factory"  (level=system, kind=system)
--                 lives under the PRODUCTS flow-stage galaxy (stage-products).
--   • 23 products: (level=node, kind=product) children of the factory.
--   • monetizes  : each product -> the EXISTING source asset it activates
--                  (edge only emitted when that asset entity exists — checked
--                  at runtime; never creates a target).
--   • listings   : draft/active offers for products that have a real channel.
--   • activity   : one light row per node so nothing is 'dead' on day 1.
--
-- CONSTITUTION LAWS OBEYED
--   L2 Persistence — nothing is deleted; pure upsert (keyed by slug).
--   L6 Provenance  — every product carries meta.source='manual';
--                    every relationship is source='manual' (human-curated,
--                    Resonance not Similarity).
--   L7 Confidence  — relationship strength in [0,1].
--   L8 Justification — every product carries meta.why_exists.
--   Gatekeeper     — the retail "Chile Goldmine Maps" (P17) is NOT linked to
--                    the confidential `laiglesia` venture. No confidential
--                    numbers, hectares, grades, coordinates or names enter here.
--
-- IDEMPOTENT — safe to re-run. Entities upsert by slug; relationships use the
-- (from_id,to_id,type) unique constraint; listings key on (entity_id,source).
-- ============================================================

do $$
declare
  factory_id  uuid;
  parent_gal  uuid := (select id from hk23.entities where slug = 'stage-products');  -- PRODUCTS galaxy
  market_id   uuid := (select id from hk23.entities where slug = 'marketplace');
  rec         jsonb;
  p           jsonb;
  nid         uuid;
  m           jsonb;
  tgt         uuid;
  lst         jsonb;
  -- ---- the catalog (one object per product) ----
  products jsonb := $json$
  [
    {"code":"P01","slug":"product:p01-art-prints-digital","name":"HK23 Art Prints — Digital","color":"#FF3A1F","importance":0.95,"wave":1,
     "summary":"926 captioned MidJourney prints as instant Etsy digital downloads.",
     "why_exists":"Turn 926 already-upscaled, SEO-captioned prints into instant-download revenue with ~0 build.",
     "meta":{"category":"Digital download","source_asset":"VICE SELLER · 926 captioned MJ prints","price_display":"$7.50","model":"one-time","status":"926 drafts staged","launch_priority":"1 — flip the switch","source_path":"~/vice-os-artifact/vice-seller"},
     "monetizes":[{"slug":"arteworld","strength":0.9}],
     "listing":{"price":7.50,"currency":"USD","status":"draft","source":"etsy","url":"https://www.etsy.com/shop/HK23Studio"}},

    {"code":"P02","slug":"product:p02-art-prints-canvas","name":"HK23 Art Prints — Canvas / Poster","color":"#FF3A1F","importance":0.9,"wave":1,
     "summary":"Print-on-demand canvas & posters of the same catalog via Printify.",
     "why_exists":"Upsell the digital catalog to physical POD (2.6–4x price) with no inventory risk.",
     "meta":{"category":"POD physical","source_asset":"VICE SELLER + Printify","price_display":"$20–50","model":"one-time","status":"blueprints defined","launch_priority":"1","source_path":"~/vice-os-artifact/vice-seller"},
     "monetizes":[{"slug":"arteworld","strength":0.85}],
     "listing":{"price":20.00,"currency":"USD","status":"draft","source":"printify","url":"https://www.etsy.com/shop/HK23Studio"}},

    {"code":"P03","slug":"product:p03-vicehub-gta6-pro","name":"VICE.HUB GTA6 PRO","color":"#ff2e93","importance":0.9,"wave":2,
     "summary":"Gumroad license unlock for the live GTA 6 intel hub — organized pre-release intel.",
     "why_exists":"Monetize the already-live GTA6 hub before the Nov 2026 launch window closes.",
     "meta":{"category":"Membership/unlock","source_asset":"vice-gta6 (live) + Gumroad + license API","price_display":"$4.99","model":"one-time (→ $2.99/mo later)","status":"ready, not public","launch_priority":"2 — 4-month timing window","source_path":"hk23universe.vercel.app/vice-gta6"},
     "monetizes":[],
     "listing":{"price":4.99,"currency":"USD","status":"draft","source":"gumroad","url":"https://hk23hub.gumroad.com/l/luzaug"}},

    {"code":"P04","slug":"product:p04-atlas-x-package","name":"ATLAS X Package","color":"#9B5DE5","importance":0.85,"wave":2,
     "summary":"The $97 ATLAS X kit — Personal Intelligence OS. Already selling; factory action is growth.",
     "why_exists":"Grow the one product already generating revenue instead of rebuilding it.",
     "meta":{"category":"Digital product","source_asset":"ATLAS X blueprint + app","price_display":"$97","model":"one-time","status":"already selling","launch_priority":"2 — optimize, don't rebuild","source_path":"~/atlas-x-app"},
     "monetizes":[{"slug":"atlas-x","strength":0.9}]},

    {"code":"P05","slug":"product:p05-proof-of-work-stickers","name":"PROOF OF WORK Stickers","color":"#FF3A1F","importance":0.75,"wave":2,
     "summary":"POD sticker 5-packs from the vice-collection design set (300dpi).",
     "why_exists":"Low-price cross-sell to the same art buyer; ships once Printify creds land.",
     "meta":{"category":"POD physical","source_asset":"vice-collection (10 designs, 300dpi)","price_display":"$6/5-pack","model":"one-time","status":"blocked on Printify creds","launch_priority":"2","source_path":"~/vice-collection"},
     "monetizes":[]},

    {"code":"P06","slug":"product:p06-proof-of-work-poster","name":"PROOF OF WORK Data Poster","color":"#FF3A1F","importance":0.55,"wave":4,
     "summary":"Limited-edition serialized data poster (digital twin) from live Claude Code stats.",
     "why_exists":"Scarcity-priced collectible that doubles as the physical anchor for the NFT twins (P23).",
     "meta":{"category":"Limited edition","source_asset":"poster generator (serial digital twin)","price_display":"$45 ed./100","model":"one-time","status":"needs real stats piped","launch_priority":"3","source_path":"~/vice-collection"},
     "monetizes":[]},

    {"code":"P07","slug":"product:p07-proof-of-work-apparel","name":"PROOF OF WORK Tee + Cap","color":"#FF3A1F","importance":0.5,"wave":4,
     "summary":"Small-batch embroidered tee & cap from the vice-collection spec.",
     "why_exists":"Top-of-range physical merch to complete the PROOF OF WORK art ecosystem.",
     "meta":{"category":"Small-batch apparel","source_asset":"vice-collection spec","price_display":"$58 / $34","model":"one-time","status":"embroidery sourcing (manual)","launch_priority":"4","source_path":"~/vice-collection"},
     "monetizes":[]},

    {"code":"P08","slug":"product:p08-blueprint-template-pack","name":"HK23 Blueprint Template Pack","color":"#9B5DE5","importance":0.8,"wave":2,
     "summary":"Bundle of 13 striking standalone HTML dashboard/strategy-map templates.",
     "why_exists":"Near-zero-work packaging of finished HTML blueprints into a sellable bundle.",
     "meta":{"category":"Template bundle","source_asset":"13 home-dir HTML blueprints (85–95%)","price_display":"$49 bundle / $19 ea","model":"one-time","status":"needs cleanup + demo page","launch_priority":"2 — near-zero work","source_path":"~ (13 HTML blueprints)"},
     "monetizes":[],
     "listing":{"price":49.00,"currency":"USD","status":"draft","source":"gumroad"}},

    {"code":"P09","slug":"product:p09-advice-studio","name":"AdVice Studio","color":"#9B5DE5","importance":0.85,"wave":3,
     "summary":"SaaS that turns a product URL into short-form video ads in minutes.",
     "why_exists":"Highest recurring-revenue ceiling in the portfolio; a complete app awaiting deploy + Stripe.",
     "meta":{"category":"SaaS","source_asset":"AdVice Studio repo (88%)","price_display":"$29–99/mo","model":"subscription","status":"deploy + Stripe live","launch_priority":"3 — highest-ceiling SaaS","source_path":"~/AdVice Studio"},
     "monetizes":[],
     "listing":{"price":29.00,"currency":"USD","status":"draft","source":"stripe"}},

    {"code":"P10","slug":"product:p10-albatros","name":"Albatros","color":"#AAFF00","importance":0.8,"wave":3,
     "summary":"B2B golf-tournament SaaS for clubs; TikTok funnel already running.",
     "why_exists":"Convert a live lead funnel into the first paying club at $599/yr.",
     "meta":{"category":"B2B SaaS","source_asset":"clubscore (70%, TikTok funnel live)","price_display":"$149/tournament · $599/yr","model":"both","status":"funnel running","launch_priority":"3 — close first paying club","source_path":"~/clubscore"},
     "monetizes":[],
     "listing":{"price":599.00,"currency":"USD","status":"draft","source":"landing","url":"https://albatros.vercel.app"}},

    {"code":"P11","slug":"product:p11-vicegolfer-premium","name":"VICEGOLFER Premium","color":"#AAFF00","importance":0.8,"wave":3,
     "summary":"B2C golf-performance subscription; Stripe already wired, awaiting go-live.",
     "why_exists":"Flip Stripe live to monetize the existing Las Rocas cohort.",
     "meta":{"category":"B2C SaaS","source_asset":"vicegolfer (75%, Stripe wired)","price_display":"$9–29/mo","model":"subscription","status":"flip Stripe live","launch_priority":"3","source_path":"~/vicegolfer"},
     "monetizes":[{"slug":"vicegolfer","strength":0.9}],
     "listing":{"price":9.00,"currency":"USD","status":"draft","source":"stripe","url":"https://vicegolfer.vercel.app"}},

    {"code":"P12","slug":"product:p12-roast-my-resume","name":"Roast My Resume","color":"#FFD200","importance":0.7,"wave":3,
     "summary":"Free viral resume-roast tool with a $4.99 pro upsell; top-of-funnel traffic engine.",
     "why_exists":"Free traffic magnet that feeds the email list and cross-sells ATLAS X / templates.",
     "meta":{"category":"Viral tool → upsell","source_asset":"How to use Claude (launch-ready HTML)","price_display":"free → $4.99 pro","model":"one-time","status":"launch assets written","launch_priority":"3 — traffic engine","source_path":"~ (launch-ready HTML)"},
     "monetizes":[]},

    {"code":"P13","slug":"product:p13-agent-harness","name":"Agent Harness","color":"#9B5DE5","importance":0.55,"wave":4,
     "summary":"Developer toolkit for building/orchestrating agents; 95% done, needs a landing.",
     "why_exists":"Sell the same 'AI builder' customer a dev toolkit alongside the template packs.",
     "meta":{"category":"Dev toolkit","source_asset":"AGENT HARNESS (95%)","price_display":"$49 Gumroad / OSS+support","model":"one-time","status":"README → landing","launch_priority":"4","source_path":"~/AGENT HARNESS"},
     "monetizes":[]},

    {"code":"P14","slug":"product:p14-the-grid","name":"THE GRID","color":"#9B5DE5","importance":0.5,"wave":4,
     "summary":"Dev SaaS / template (85%); sell as a template or hosted tier.",
     "why_exists":"Another builder-ecosystem SKU once the repo is packaged.",
     "meta":{"category":"Dev SaaS/template","source_asset":"THE GRID (85%)","price_display":"$29 template / $9.99/mo hosted","model":"both","status":"package repo","launch_priority":"4","source_path":"~/THE GRID"},
     "monetizes":[]},

    {"code":"P15","slug":"product:p15-cryptovice-affiliate-playbook","name":"CryptoVice 90-Day Affiliate Playbook","color":"#FF2D78","importance":0.5,"wave":4,
     "summary":"Guide/course productized from the affiliate-growth agent specs.",
     "why_exists":"Package the CryptoVice affiliate system into a one-time guide.",
     "meta":{"category":"Guide/course","source_asset":"AFFILIATE GROWTH AGENT (85%)","price_display":"$97","model":"one-time","status":"PDF-ify 5 specs","launch_priority":"4","source_path":"~ (AFFILIATE GROWTH AGENT)"},
     "monetizes":[{"slug":"cryptovice","strength":0.8}]},

    {"code":"P16","slug":"product:p16-hk23-os-framework","name":"HK23 OS Framework","color":"#9B5DE5","importance":0.6,"wave":5,
     "summary":"The HK23 OS constitution productized as a framework + course / license.",
     "why_exists":"Sell the thinking system itself — the OS, not the companies built on it.",
     "meta":{"category":"Framework + course","source_asset":"HK23 OS constitution (92%)","price_display":"$297 course / $2.5k license","model":"both","status":"productize docs","launch_priority":"5","source_path":"~/vice-os-artifact/hk23-constitution"},
     "monetizes":[{"slug":"hk23-multiverse","strength":0.85}]},

    {"code":"P17","slug":"product:p17-goldmine-maps","name":"Chile Goldmine Maps","color":"#FFD200","importance":0.45,"wave":5,
     "summary":"1-of-1 collectible generative maps (art). No confidential venture data.",
     "why_exists":"High-margin low-volume collectible art; kept fully separate from the private venture.",
     "meta":{"category":"1-of-1 collectibles","source_asset":"CHILE GOLDMINE generative art (75%)","price_display":"$800–8,000/map","model":"one-time","status":"listing + photos","launch_priority":"5 — high margin, low volume","source_path":"~ (CHILE GOLDMINE art)","gatekeeper_note":"retail art only — intentionally NOT linked to the confidential laiglesia venture"},
     "monetizes":[]},

    {"code":"P18","slug":"product:p18-gatsby-comet","name":"Gatsby Comet / Aurelian Drift","color":"#FF3A1F","importance":0.4,"wave":5,
     "summary":"Generative art piece + companion essay (essay free as marketing).",
     "why_exists":"Small art SKU where the free essay is the top-of-funnel marketing.",
     "meta":{"category":"Generative art + essay","source_asset":"gatsby-comet.html + philosophy.md","price_display":"$5 art / free essay","model":"one-time","status":"publish","launch_priority":"5","source_path":"~ (gatsby-comet.html)"},
     "monetizes":[]},

    {"code":"P19","slug":"product:p19-investor-deck-bundle","name":"Investor Deck Template Bundle","color":"#FFD200","importance":0.35,"wave":6,
     "summary":"Genericized investor-deck templates (all real data scrubbed first).",
     "why_exists":"Reuse deck IP as a template after fully anonymizing it (Gatekeeper scrub).",
     "meta":{"category":"Template","source_asset":"Downloads decks (scrub data first)","price_display":"$39–79","model":"one-time","status":"scrub + genericize","launch_priority":"6","source_path":"~/Downloads (decks)"},
     "monetizes":[]},

    {"code":"P20","slug":"product:p20-brand-os-template","name":"Brand OS Template","color":"#FFD200","importance":0.35,"wave":6,
     "summary":"Extractable brand-operating-system prompt template.",
     "why_exists":"Extract a reusable brand-OS template from an existing project prompt.",
     "meta":{"category":"Template","source_asset":"Chilli Toes prompt-template-brand-os.md","price_display":"$29","model":"one-time","status":"extract","launch_priority":"6","source_path":"~ (prompt-template-brand-os.md)"},
     "monetizes":[]},

    {"code":"P21","slug":"product:p21-performance-dna-engine","name":"Performance DNA Engine","color":"#AAFF00","importance":0.4,"wave":6,
     "summary":"Code boilerplate extracted from the shared vicegolfer + rugbyvice IP.",
     "why_exists":"Sell the reusable performance-app engine that powers both sports products.",
     "meta":{"category":"Code template/boilerplate","source_asset":"vicegolfer + rugbyvice shared IP","price_display":"$199 boilerplate","model":"one-time","status":"extract","launch_priority":"6","source_path":"~/vicegolfer + ~/rugbyvice"},
     "monetizes":[{"slug":"vicegolfer","strength":0.7},{"slug":"rugbyvice","strength":0.7}]},

    {"code":"P22","slug":"product:p22-hk23-cosmos-membership","name":"HK23 Cosmos Membership","color":"#FFD200","importance":0.45,"wave":7,
     "summary":"Umbrella membership over the universe tiers (Visitante/Premium/Full).",
     "why_exists":"The recurring umbrella that binds the catalog together — ships after products exist.",
     "meta":{"category":"Membership","source_asset":"universe tiers (piece 1 done)","price_display":"$9/mo","model":"subscription","status":"needs pieces 2–4","launch_priority":"7 — umbrella, ship after products exist","source_path":"~/vice-os-artifact/hk23-universe.html"},
     "monetizes":[{"slug":"hk23-multiverse","strength":0.85}]},

    {"code":"P23","slug":"product:p23-proof-of-work-nft","name":"NFT: PROOF OF WORK Digital Twins","color":"#FF3A1F","importance":0.3,"wave":8,
     "summary":"NFT digital twins of the serialized posters; ships after P06 sells.",
     "why_exists":"On-chain twin of the poster editions — the last rung of the art ecosystem.",
     "meta":{"category":"NFT","source_asset":"poster serials + Supabase","price_display":"TBD","model":"one-time","status":"after P06 sells","launch_priority":"8","source_path":"~/vice-collection"},
     "monetizes":[]}
  ]
  $json$::jsonb;
begin
  if parent_gal is null then
    raise exception 'stage-products galaxy not found — apply 0003_flow_stages first';
  end if;

  -- ---------- 1) parent: HK23 Product Factory (system under PRODUCTS) ----------
  select id into factory_id from hk23.entities where slug = 'system:hk23-product-factory';
  if factory_id is null then
    insert into hk23.entities (name, slug, level, kind, parent_id, color, summary, state, metrics, meta)
    values ('HK23 Product Factory','system:hk23-product-factory','system','system', parent_gal,
            '#FFD200',
            '23 products from existing assets — the commercialization layer of HK23 OS. Zero require building something new.',
            'growing',
            '{"activity":0,"revenue":0,"importance":1,"last_active":null}'::jsonb,
            '{"public":true,"source":"manual","factory":true,"why_exists":"Convert already-built assets into revenue: the activation layer, not a creation layer.","catalog":"P01-P23","source_path":"~/hk23-product-factory"}'::jsonb)
    returning id into factory_id;
  else
    update hk23.entities
       set name='HK23 Product Factory', level='system', kind='system', parent_id=parent_gal,
           color='#FFD200',
           summary='23 products from existing assets — the commercialization layer of HK23 OS. Zero require building something new.',
           meta = meta || '{"public":true,"source":"manual","factory":true,"why_exists":"Convert already-built assets into revenue: the activation layer, not a creation layer.","catalog":"P01-P23","source_path":"~/hk23-product-factory"}'::jsonb
     where id = factory_id;
  end if;

  -- MARKETPLACE references the factory (so the two planets link). Existing target only.
  if market_id is not null then
    insert into hk23.relationships (from_id, to_id, type, strength, source)
    values (market_id, factory_id, 'related', 0.7, 'manual')
    on conflict (from_id, to_id, type) do nothing;
  end if;

  -- one light activity row so the factory reads as 'growing', not dead (guarded → re-run safe)
  if not exists (select 1 from hk23.activity_log where entity_id = factory_id and kind = 'seed') then
    insert into hk23.activity_log (entity_id, kind, weight) values (factory_id, 'seed', 5);
  end if;

  -- ---------- 2) the 23 products ----------
  for rec in select value from jsonb_array_elements(products) loop
    p := rec;

    -- upsert product entity by slug
    select id into nid from hk23.entities where slug = (p->>'slug');
    if nid is null then
      insert into hk23.entities (name, slug, level, kind, parent_id, color, summary, state, metrics, meta)
      values (
        p->>'name', p->>'slug', 'node', 'product', factory_id,
        p->>'color', p->>'summary', 'star',
        jsonb_build_object('activity',0,'revenue',0,'importance',(p->>'importance')::numeric,'last_active',null),
        (p->'meta')
          || jsonb_build_object('public',true,'source','manual','product_code',p->>'code',
                                'launch_wave',(p->>'wave')::int,'why_exists',p->>'why_exists')
      )
      returning id into nid;
    else
      update hk23.entities
         set name = p->>'name', level='node', kind='product', parent_id = factory_id,
             color = p->>'color', summary = p->>'summary',
             metrics = jsonb_set(coalesce(metrics,'{}'::jsonb), '{importance}', to_jsonb((p->>'importance')::numeric)),
             meta = meta || (p->'meta')
                          || jsonb_build_object('public',true,'source','manual','product_code',p->>'code',
                                                'launch_wave',(p->>'wave')::int,'why_exists',p->>'why_exists')
       where id = nid;
    end if;

    -- monetizes edges — ONLY to existing target entities (never create a target)
    for m in select value from jsonb_array_elements(coalesce(p->'monetizes','[]'::jsonb)) loop
      select id into tgt from hk23.entities where slug = (m->>'slug');
      if tgt is not null and tgt <> nid then
        insert into hk23.relationships (from_id, to_id, type, strength, source)
        values (nid, tgt, 'monetizes', (m->>'strength')::real, 'manual')
        on conflict (from_id, to_id, type) do nothing;
      end if;
    end loop;

    -- listing (idempotent on entity_id + source)
    if jsonb_exists(p, 'listing') then
      lst := p->'listing';
      if not exists (select 1 from hk23.listings where entity_id = nid and source = (lst->>'source')) then
        insert into hk23.listings (entity_id, price, currency, status, external_url, source, meta)
        values (nid, (lst->>'price')::numeric, coalesce(lst->>'currency','USD'),
                coalesce(lst->>'status','draft'), lst->>'url', lst->>'source',
                jsonb_build_object('product_code',p->>'code'));
      else
        update hk23.listings
           set price = (lst->>'price')::numeric, currency = coalesce(lst->>'currency','USD'),
               status = coalesce(lst->>'status','draft'), external_url = lst->>'url'
         where entity_id = nid and source = (lst->>'source');
      end if;
    end if;

    -- light activity so the node reads as alive (weight scaled by launch wave; guarded → re-run safe)
    if not exists (select 1 from hk23.activity_log where entity_id = nid and kind = 'seed') then
      insert into hk23.activity_log (entity_id, kind, weight)
      values (nid, 'seed', greatest(1, 6 - (p->>'wave')::int));
    end if;
  end loop;

  raise notice 'HK23 Product Factory import complete: factory=% , 23 products upserted.', factory_id;
end $$;

-- ============================================================
-- Verify (optional): counts introduced by this seed.
--   select count(*) from hk23.entities     where slug like 'product:p%';                  -- expect 23
--   select count(*) from hk23.entities     where slug = 'system:hk23-product-factory';    -- expect 1
--   select count(*) from hk23.relationships r join hk23.entities e on e.id=r.from_id
--     where e.slug like 'product:p%' and r.type='monetizes';                              -- expect 9
--   select count(*) from hk23.listings l join hk23.entities e on e.id=l.entity_id
--     where e.slug like 'product:p%';                                                     -- expect 7
-- ============================================================
