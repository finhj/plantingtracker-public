-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

-- Locations/sections config (map markers, bed counts, direction, groupings).
-- This rarely changes, so it's kept as one shared JSON blob row.
create table if not exists farm_locations (
  id text primary key default 'main',
  data jsonb not null default '[]'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

-- Individual plantings, one row per entry, so two people editing different
-- beds at the same time never overwrite each other.
create table if not exists plantings (
  id text primary key,
  section_id text not null,
  bed int not null,
  portion text not null default 'Whole bed',
  crop text not null,
  variety text,
  planted_date date,
  expected_harvest date,
  notes text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plantings_section_bed_idx on plantings (section_id, bed);

alter table farm_locations enable row level security;
alter table plantings enable row level security;

-- Any logged-in (assigned-username) user can read and write. Since accounts
-- are created by the farm admin rather than open signup, "authenticated"
-- effectively means "someone the admin gave a login to."
create policy "authenticated read locations" on farm_locations
  for select using (auth.role() = 'authenticated');
create policy "authenticated write locations" on farm_locations
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update locations" on farm_locations
  for update using (auth.role() = 'authenticated');

create policy "authenticated read plantings" on plantings
  for select using (auth.role() = 'authenticated');
create policy "authenticated write plantings" on plantings
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update plantings" on plantings
  for update using (auth.role() = 'authenticated');
create policy "authenticated delete plantings" on plantings
  for delete using (auth.role() = 'authenticated');

-- Seed the single locations row so the app has something to load on first run.
insert into farm_locations (id, data, updated_by)
values ('main', '[]'::jsonb, 'system')
on conflict (id) do nothing;

-- Realtime: without this, the app's live-sync subscription connects fine but
-- never receives anything, because Postgres only streams changes for tables
-- that are members of the supabase_realtime publication. Wrapped in guards so
-- this whole file stays safe to re-run.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plantings'
  ) then
    alter publication supabase_realtime add table public.plantings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'farm_locations'
  ) then
    alter publication supabase_realtime add table public.farm_locations;
  end if;
end $$;
