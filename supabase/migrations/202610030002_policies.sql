create function public.is_owner() returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from admin_memberships where user_id=auth.uid() and role='admin'); $$;
drop policy members_owner on admin_memberships;
create policy members_owner on admin_memberships for all to authenticated using(public.is_owner()) with check(public.is_owner());
grant select,insert,update,delete on all tables in schema public to authenticated;
revoke all on property_private_locations from anon;
