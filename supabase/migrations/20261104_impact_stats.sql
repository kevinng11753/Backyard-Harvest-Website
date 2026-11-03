-- =====================================================================
-- Impact stats
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- (The same SQL is at the end of supabase/schema.sql for fresh installs.)
--
-- Counts the shares that happened: listings where the grower said yes to a
-- neighbor's request. Returns only counts per category, never who or where:
--   community — every share, for everyone (signed in or not)
--   given     — shares where the signed-in person was the grower
--   received  — shares where the signed-in person was the neighbor
-- The app turns counts into estimated CO2e and money saved (src/lib/impact.js).
-- =====================================================================
create or replace function public.impact_stats()
returns jsonb
language sql stable
security definer set search_path = public
as $$
  with shared as (
    select distinct on (l.id) l.id, l.category, l.owner_id, r.requester_id
    from listings l
    join requests r on r.listing_id = l.id and r.status = 'accepted'
  )
  select jsonb_build_object(
    'community', coalesce((
      select jsonb_object_agg(category, n)
      from (select category, count(*) as n from shared group by category) c
    ), '{}'::jsonb),
    'given', coalesce((
      select jsonb_object_agg(category, n)
      from (select category, count(*) as n from shared where owner_id = auth.uid() group by category) c
    ), '{}'::jsonb),
    'received', coalesce((
      select jsonb_object_agg(category, n)
      from (select category, count(*) as n from shared where requester_id = auth.uid() group by category) c
    ), '{}'::jsonb)
  );
$$;

revoke execute on function public.impact_stats() from public;
grant execute on function public.impact_stats() to anon, authenticated;
