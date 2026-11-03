-- Lets people who are NOT signed in browse open listings on the home page.
-- Safe to run on a project that already has schema.sql applied.
--
-- This is deliberately a function, not a new open policy on the tables.
-- Signed-out visitors get a limited view and nothing else:
--   * only listings that are still available and not expired
--   * the grower's FIRST NAME only (no last name, no street or neighborhood)
--   * the area rounded to 2 decimals (about 1 km), coarser than what
--     signed-in neighbors see
--   * never the pickup address, never requests, never owner ids
-- The tables themselves stay readable only by signed-in users.

create or replace function public.public_listings()
returns jsonb
language sql stable
security definer set search_path = public
as $$
  select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb)
  from (
    select
      l.created_at,
      jsonb_build_object(
        'id',          l.id,
        'title',       l.title,
        'category',    l.category,
        'quantity',    l.quantity,
        'description', l.description,
        'photo_url',   l.photo_url,
        'approx_lat',  round(l.approx_lat::numeric, 2),
        'approx_lng',  round(l.approx_lng::numeric, 2),
        'expires_at',  l.expires_at,
        'created_at',  l.created_at,
        'status',      l.status,
        'owner',       jsonb_build_object('display_name', split_part(p.display_name, ' ', 1))
      ) as j
    from listings l
    join profiles p on p.id = l.owner_id
    where l.status = 'available' and l.expires_at > now()
    order by l.created_at desc
    limit 200
  ) x;
$$;

revoke execute on function public.public_listings() from public;
grant execute on function public.public_listings() to anon, authenticated;
