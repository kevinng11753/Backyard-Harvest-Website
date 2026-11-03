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
-- PUBLIC LISTINGS — what signed-out visitors can see on the home page.
-- A function, not an open table policy: open listings only, the grower's
-- first name only, the area rounded to about 1 km, and never the pickup
-- address. (Same function as supabase/migrations/20261102_public_listings.sql)
-- =====================================================================
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

-- =====================================================================
-- ACCOUNT DELETION AND PHOTO CLEAN-UP
-- (Same as supabase/migrations/20261102_account_deletion.sql)
-- =====================================================================
-- People can see their own photo files, which removing them requires.
-- The bucket is public, so photos still load for anyone with the link.
create policy "See your own photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'produce-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Delete my account: removes the sign-in account, and the profile, listings,
-- pickup details and requests go with it (on delete cascade). Photo files
-- aren't covered by that, so the app deletes them first.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in again.';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

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

-- =====================================================================
-- REPORT AND BLOCK
-- (Same as supabase/migrations/20261103_report_and_block.sql)
-- Reports are read in the Supabase Table Editor ("reports"); the app cannot read them.
-- =====================================================================
-- Blocks first, then reports.
create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- You can see, and undo, only your own blocks. Blocking itself goes through
-- block_user() below (it also ends open requests), so there is no insert policy.
create policy "See who you blocked"
  on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy "Unblock"
  on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- Is there a block between the signed-in person and this one, in EITHER
-- direction? A function (not a plain query) because the blocked person has
-- no right to read the blocks table, but the rules below must still see it.
create function public.is_blocked_with(other uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from blocks
    where (blocker_id = auth.uid() and blocked_id = other)
       or (blocker_id = other and blocked_id = auth.uid())
  );
$$;

revoke execute on function public.is_blocked_with(uuid) from public, anon;
grant execute on function public.is_blocked_with(uuid) to authenticated;

-- Listings from someone you blocked, or who blocked you, are invisible to you.
-- Because "request" requires being able to see the listing, this also stops
-- them from asking for each other's produce.
drop policy if exists "Listings are visible to signed-in users" on public.listings;
create policy "Listings are visible to signed-in users"
  on public.listings for select to authenticated
  using (not public.is_blocked_with(owner_id));

-- Block a neighbor, and end every open request between the two of you.
create function public.block_user(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  r     record;
  freed uuid[];
begin
  if auth.uid() is null then
    raise exception 'Please sign in again.';
  end if;
  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'You can''t block yourself.';
  end if;
  if not exists (select 1 from profiles where id = p_user_id) then
    raise exception 'That person was not found.';
  end if;

  insert into blocks (blocker_id, blocked_id) values (auth.uid(), p_user_id)
  on conflict do nothing;

  -- Requests I made on their listings: cancel them (this also reopens a
  -- listing I had been accepted for, same as "Can't make it").
  for r in
    select rq.id from requests rq
    join listings l on l.id = rq.listing_id
    where rq.requester_id = auth.uid() and l.owner_id = p_user_id
      and rq.status in ('pending', 'accepted')
  loop
    perform cancel_request(r.id);
  end loop;

  -- Requests they made on my listings: decline them. If one was accepted,
  -- the listing opens up again for everyone else.
  select coalesce(array_agg(rq.listing_id), '{}') into freed
  from requests rq join listings l on l.id = rq.listing_id
  where l.owner_id = auth.uid() and rq.requester_id = p_user_id and rq.status = 'accepted';

  update requests rq set status = 'declined', auto_declined = false
  from listings l
  where l.id = rq.listing_id and l.owner_id = auth.uid() and rq.requester_id = p_user_id
    and (rq.status in ('pending', 'accepted') or rq.auto_declined);

  update listings set status = 'available' where id = any (freed) and status = 'claimed';
  update requests set status = 'pending', auto_declined = false
    where listing_id = any (freed) and status = 'declined' and auto_declined;
end;
$$;

revoke execute on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. REPORTS
--    A copy of what was reported is kept on the report itself, so it is still
--    there if the listing is edited or deleted afterwards. A report goes away
--    if either person deletes their account.
-- ---------------------------------------------------------------------
create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id       uuid references public.listings (id) on delete set null,
  request_id       uuid references public.requests (id) on delete set null,
  reason           text not null check (reason in ('unsafe', 'misleading', 'harassment', 'spam', 'privacy', 'other')),
  note             text check (char_length(note) <= 500),
  reporter_name    text,
  reported_name    text,
  listing_title    text,
  content          text,                       -- the description, or the request message, as it was
  status           text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at       timestamptz not null default now()
);

create index reports_status_idx on public.reports (status, created_at desc);

-- Row level security with no policies and no grants: the app can neither
-- read nor write this table directly. Only submit_report() writes to it, and
-- only you (the project owner, in the Supabase dashboard) can read it.
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

create function public.submit_report(p_listing_id uuid, p_request_id uuid, p_reason text, p_note text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  me           uuid := auth.uid();
  l            record;
  q            record;
  clean_note   text := nullif(btrim(p_note), '');
begin
  if me is null then
    raise exception 'Please sign in again.';
  end if;
  if (p_listing_id is null) = (p_request_id is null) then
    raise exception 'Choose one thing to report.';
  end if;
  -- A little protection against report spam.
  if (select count(*) from reports where reporter_id = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'You''ve sent several reports today. Please try again tomorrow.';
  end if;

  if p_listing_id is not null then
    select id, owner_id, title, description into l from listings where id = p_listing_id;
    if not found or l.owner_id = me or is_blocked_with(l.owner_id) then
      raise exception 'That listing was not found.';
    end if;
    if exists (select 1 from reports where reporter_id = me and listing_id = p_listing_id) then
      raise exception 'You already reported this.';
    end if;

    insert into reports (reporter_id, reported_user_id, listing_id, reason, note,
                         reporter_name, reported_name, listing_title, content)
    values (me, l.owner_id, l.id, p_reason, clean_note,
            (select display_name from profiles where id = me),
            (select display_name from profiles where id = l.owner_id),
            l.title, l.description);
  else
    -- Only the grower can report a request, and only one made on their own listing.
    select rq.id, rq.requester_id, rq.message, l2.id as listing_id, l2.title into q
    from requests rq join listings l2 on l2.id = rq.listing_id
    where rq.id = p_request_id and l2.owner_id = me;
    if not found then
      raise exception 'That request was not found.';
    end if;
    if exists (select 1 from reports where reporter_id = me and request_id = p_request_id) then
      raise exception 'You already reported this.';
    end if;

    insert into reports (reporter_id, reported_user_id, listing_id, request_id, reason, note,
                         reporter_name, reported_name, listing_title, content)
    values (me, q.requester_id, q.listing_id, q.id, p_reason, clean_note,
            (select display_name from profiles where id = me),
            (select display_name from profiles where id = q.requester_id),
            q.title, q.message);
  end if;
end;
$$;

revoke execute on function public.submit_report(uuid, uuid, text, text) from public, anon;
grant execute on function public.submit_report(uuid, uuid, text, text) to authenticated;
