-- =====================================================================
-- Report and block
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- (The same SQL is at the end of supabase/schema.sql for fresh installs.)
--
-- REPORTS  — a signed-in person flags a listing, or a request on their own
--            listing. Nobody can read them from the app. You read them in the
--            Supabase Table Editor (table "reports").
-- BLOCKS   — you block a neighbor: you stop seeing each other's listings,
--            they can't ask for yours, and open requests between you end.
--            They are never told.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. BLOCKS
-- ---------------------------------------------------------------------
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
