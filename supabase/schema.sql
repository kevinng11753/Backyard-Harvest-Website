-- =====================================================================
-- Backyard Harvest — database setup
-- Paste this whole file into Supabase: SQL Editor → New query → Run.
-- It is safe to run on a brand-new project.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILES — one row per person who signs up
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  neighborhood text check (char_length(neighborhood) <= 60),
  created_at   timestamptz not null default now()
);

-- When someone signs up, copy the name and neighborhood they typed into
-- a profile row automatically, so the app never has to do it by hand.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, neighborhood)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Neighbor'),
    new.raw_user_meta_data ->> 'neighborhood'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. LISTINGS — produce someone is giving away
--    Only an APPROXIMATE location is stored here (the app blurs it by
--    a couple of hundred meters before saving). The real address lives
--    in listing_pickups, which strangers cannot read.
-- ---------------------------------------------------------------------
create table public.listings (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 60),
  category    text not null check (category in ('vegetables', 'fruit', 'herbs', 'greens', 'flowers', 'seedlings')),
  quantity    text check (char_length(quantity) <= 40),
  description text check (char_length(description) <= 300),
  photo_url   text,
  approx_lat  double precision not null,
  approx_lng  double precision not null,
  expires_at  timestamptz not null,
  status      text not null default 'available' check (status in ('available', 'claimed', 'gone')),
  created_at  timestamptz not null default now()
);

create index listings_active_idx on public.listings (status, expires_at);

-- ---------------------------------------------------------------------
-- 3. LISTING_PICKUPS — the private part of a listing
--    Readable only by the grower and by the neighbor whose request
--    the grower accepted.
-- ---------------------------------------------------------------------
create table public.listing_pickups (
  listing_id   uuid primary key references public.listings (id) on delete cascade,
  address      text not null check (char_length(address) <= 120),
  instructions text check (char_length(instructions) <= 200)
);

-- ---------------------------------------------------------------------
-- 4. REQUESTS — a neighbor asking for a listing
-- ---------------------------------------------------------------------
create table public.requests (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings (id) on delete cascade,
  requester_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  message      text check (char_length(message) <= 200),
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  auto_declined boolean not null default false,   -- declined automatically because another request was accepted
  created_at   timestamptz not null default now(),
  unique (listing_id, requester_id)   -- one request per person per listing
);

-- =====================================================================
-- ROW LEVEL SECURITY — the rules that decide who can see or change what
-- =====================================================================
alter table public.profiles        enable row level security;
alter table public.listings        enable row level security;
alter table public.listing_pickups enable row level security;
alter table public.requests        enable row level security;

-- Helper: does the signed-in user own this listing?
create function public.owns_listing(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from listings where id = target and owner_id = auth.uid());
$$;

-- Helper: how many open requests does the signed-in user have?
-- Used to stop one person from claiming everything in the neighborhood.
create function public.my_pending_request_count()
returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::int from requests where requester_id = auth.uid() and status = 'pending';
$$;

-- PROFILES: signed-in users can see names; you can only edit your own.
create policy "Profiles are visible to signed-in users"
  on public.profiles for select to authenticated using (true);
create policy "Update your own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- LISTINGS: everyone signed in can browse; only the owner can change.
create policy "Listings are visible to signed-in users"
  on public.listings for select to authenticated using (true);
create policy "Post your own listings"
  on public.listings for insert to authenticated
  with check (owner_id = auth.uid());
create policy "Update your own listings"
  on public.listings for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Delete your own listings"
  on public.listings for delete to authenticated
  using (owner_id = auth.uid());

-- PICKUPS: owner can do anything; an accepted requester can read.
create policy "Owner manages pickup details"
  on public.listing_pickups for all to authenticated
  using (public.owns_listing(listing_id)) with check (public.owns_listing(listing_id));
create policy "Accepted neighbor can read pickup details"
  on public.listing_pickups for select to authenticated
  using (exists (
    select 1 from public.requests r
    where r.listing_id = listing_pickups.listing_id
      and r.requester_id = auth.uid()
      and r.status = 'accepted'
  ));

-- REQUESTS: you see requests you made, plus requests on your listings.
create policy "See your requests and requests on your listings"
  on public.requests for select to authenticated
  using (requester_id = auth.uid() or public.owns_listing(listing_id));

-- You can request something only if: it isn't yours, it's still
-- available and fresh, and you have fewer than 3 open requests.
create policy "Request available produce"
  on public.requests for insert to authenticated
  with check (
    requester_id = auth.uid()
    and status = 'pending'
    and not public.owns_listing(listing_id)
    and public.my_pending_request_count() < 3
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status = 'available' and l.expires_at > now()
    )
  );

-- Cancelling goes through cancel_request() (below), not a direct update,
-- so that cancelling an accepted request can reopen the listing.

-- Accepting or declining goes through this function so that accepting
-- one request also marks the listing claimed and declines the others,
-- all in one step.
create function public.respond_to_request(request_id uuid, decision text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  target_listing uuid;
begin
  if decision not in ('accepted', 'declined') then
    raise exception 'Decision must be accepted or declined';
  end if;

  select listing_id into target_listing
  from requests where id = request_id and status = 'pending';

  if target_listing is null then
    raise exception 'That request is no longer open';
  end if;
  if not owns_listing(target_listing) then
    raise exception 'Only the grower can answer this request';
  end if;

  update requests set status = decision where id = request_id;

  if decision = 'accepted' then
    update listings set status = 'claimed' where id = target_listing;
    update requests set status = 'declined', auto_declined = true
      where listing_id = target_listing and id <> request_id and status = 'pending';
  end if;
end;
$$;

grant execute on function public.respond_to_request(uuid, text) to authenticated;

-- Cancel your own request. If it was the accepted one, reopen the listing
-- (unless the grower already marked it "gone") and bring back the requests
-- that were declined only because this one was accepted.
create function public.cancel_request(request_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r record;
begin
  select id, listing_id, status into r
  from requests where id = request_id and requester_id = auth.uid();

  if not found then
    raise exception 'That request was not found';
  end if;
  if r.status not in ('pending', 'accepted') then
    raise exception 'That request is already closed';
  end if;

  update requests set status = 'cancelled' where id = r.id;

  if r.status = 'accepted' then
    update listings set status = 'available' where id = r.listing_id and status = 'claimed';
    update requests set status = 'pending', auto_declined = false
      where listing_id = r.listing_id and status = 'declined' and auto_declined;
  end if;
end;
$$;

revoke execute on function public.cancel_request(uuid) from public;
grant execute on function public.cancel_request(uuid) to authenticated;

-- =====================================================================
-- PHOTO STORAGE
-- Photos are public (anyone with the link can view them), but people
-- can only upload into a folder named after their own user id.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('produce-photos', 'produce-photos', true)
on conflict (id) do nothing;

create policy "Upload photos to your own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'produce-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Delete your own photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'produce-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- CREATE LISTING — saves a listing and its private pickup details in
-- one step, so a failure can never leave a listing without an address.
-- (Same function as supabase/migrations/20261101_create_listing_function.sql)
-- =====================================================================
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
security invoker
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
