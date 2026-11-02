-- Create a listing and its private pickup details in ONE transaction.
-- Before this, the app made two separate inserts; if the second failed,
-- a public listing was left behind with no pickup address.
-- Safe to run on a project that already has schema.sql applied.

create or replace function public.create_listing(
  p_title        text,
  p_category     text,
  p_quantity     text,
  p_description  text,
  p_photo_url    text,
  p_approx_lat   double precision,
  p_approx_lng   double precision,
  p_expires_at   timestamptz,
  p_address      text,
  p_instructions text
)
returns uuid
language plpgsql
security invoker            -- row level security still applies to the caller
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into listings (title, category, quantity, description, photo_url, approx_lat, approx_lng, expires_at)
  values (p_title, p_category, p_quantity, p_description, p_photo_url, p_approx_lat, p_approx_lng, p_expires_at)
  returning id into new_id;

  insert into listing_pickups (listing_id, address, instructions)
  values (new_id, p_address, p_instructions);

  return new_id;
end;
$$;

revoke execute on function public.create_listing(text, text, text, text, text, double precision, double precision, timestamptz, text, text) from public;
grant execute on function public.create_listing(text, text, text, text, text, double precision, double precision, timestamptz, text, text) to authenticated;
