-- Lets a signed-in person delete their own account, and fixes photo clean-up.
-- Safe to run on a project that already has schema.sql applied.

-- ---------------------------------------------------------------------
-- 1. Let people SEE their own photo files (needed to delete them)
--    The bucket is public, so photos already load for anyone with the
--    link; this does not change that. But removing a file through the
--    Storage API also needs the row to be visible to the person doing
--    it, and until now it wasn't, so clean-up removed nothing. This only
--    covers the signed-in person's own folder, so nobody can list other
--    people's photos.
-- ---------------------------------------------------------------------
drop policy if exists "See your own photo files" on storage.objects;
create policy "See your own photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'produce-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- 2. Delete my account
--    Removes the sign-in account. Everything tied to it goes with it,
--    because the tables are linked with "on delete cascade":
--      profile -> listings -> pickup details and requests on them
--      profile -> requests the person made on other people's listings
--    Photo files are not covered by that, so the app deletes them first.
--    Only ever deletes the caller's own account.
-- ---------------------------------------------------------------------
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
