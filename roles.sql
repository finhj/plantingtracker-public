-- Developer role: who is allowed to change the shared map layout.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.

-- Who has developer status. Deliberately has no write policy below, so it can
-- only be changed from the Supabase dashboard, never from inside the app.
create table if not exists farm_roles (
  username text primary key,
  is_developer boolean not null default false,
  note text
);

alter table farm_roles enable row level security;

-- Everyone signed in can read this (the app checks its own row to decide
-- whether to show the "Adjust positions" button).
drop policy if exists "authenticated read roles" on farm_roles;
create policy "authenticated read roles" on farm_roles
  for select using (auth.role() = 'authenticated');

-- Grant fin developer status.
insert into farm_roles (username, is_developer, note)
values ('fin', true, 'developer')
on conflict (username) do update set is_developer = excluded.is_developer;

-- Helper used by the policies below. Maps the signed-in user's fake email
-- (fin@farmusers.local) back to their username and looks up the flag.
-- security definer so the lookup itself isn't subject to RLS.
create or replace function public.is_developer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select r.is_developer from farm_roles r
      where r.username = split_part(auth.email(), '@', 1)),
    false
  );
$$;

-- Replace the old "any signed-in user can write the layout" policies.
-- Reading stays open to everyone — non-developers still see the map, they
-- just can't move anything.
drop policy if exists "authenticated write locations" on farm_locations;
drop policy if exists "authenticated update locations" on farm_locations;

create policy "developer write locations" on farm_locations
  for insert with check (public.is_developer());
create policy "developer update locations" on farm_locations
  for update using (public.is_developer()) with check (public.is_developer());
