-- When a neighbor who was ACCEPTED cancels, the listing used to stay
-- "claimed" forever. Now it reopens, and the neighbors who were only
-- turned down because someone else was accepted get their requests back.
-- Safe to run on a project that already has schema.sql applied.

-- ---------------------------------------------------------------------
-- PART 1 — run first
-- ---------------------------------------------------------------------

-- Remember which requests were declined automatically (as opposed to by
-- the grower), so only those come back when a listing reopens.
alter table public.requests
  add column if not exists auto_declined boolean not null default false;

-- Same as before, except the automatic declines are now marked.
create or replace function public.respond_to_request(request_id uuid, decision text)
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

-- Cancel your own request. If it was the accepted one, reopen the listing
-- (unless the grower already marked it "gone") and bring back the requests
-- that were declined only because this one was accepted.
create or replace function public.cancel_request(request_id uuid)
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

-- ---------------------------------------------------------------------
-- PART 2 — run AFTER the new app version is live
-- Cancelling now goes through cancel_request(), so remove the old
-- permission that let people flip their own request to "cancelled"
-- directly (which would skip the reopen step).
-- ---------------------------------------------------------------------
drop policy if exists "Cancel your own request" on public.requests;
