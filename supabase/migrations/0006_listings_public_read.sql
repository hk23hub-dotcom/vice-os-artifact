-- ============================================================
-- HK23 — 0006 · public read policy for listings
-- Bug: hk23.listings had only an owner RW policy, so the anon
-- (publishable) key the hub uses saw ZERO listings → no prices,
-- no "BUY" labels for any product (Etsy + ATLAS X alike).
-- Fix: a listing is publicly readable iff its entity is public,
-- mirroring the "entities public read" policy (0001).
-- Idempotent. Re-run safe.
-- ============================================================

drop policy if exists "listings public read" on hk23.listings;
create policy "listings public read" on hk23.listings
  for select using (
    exists (
      select 1 from hk23.entities e
      where e.id = listings.entity_id
        and coalesce(e.meta->>'public','false') = 'true'
    )
  );

-- ============================================================
-- after this runs, every public product shows its price + buy CTA.
-- ============================================================
