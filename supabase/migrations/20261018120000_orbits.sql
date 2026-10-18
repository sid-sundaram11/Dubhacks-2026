-- Orbit weekly game: groups, hidden threads, private constellation storage,
-- a shared comet cache, realtime solve placements, and immutable Memory Sky chapters.
-- The Node API uses the service role. These policies are the direct-client boundary.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.orbits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.orbit_members (
  orbit_id uuid not null references public.orbits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (orbit_id, user_id)
);

create table public.orbit_invites (
  code text primary key,
  orbit_id uuid not null references public.orbits (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  orbit_id uuid not null references public.orbits (id) on delete cascade,
  week_key text not null,
  theme_title text not null,
  theme_prompt text not null,
  phase text not null check (phase in ('gathering', 'comet', 'solving', 'archived')),
  board_version integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  slot integer not null check (slot between 1 and 3),
  answer_key text not null,
  unique (cycle_id, slot)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  orbit_id uuid not null references public.orbits (id) on delete cascade,
  thread_id uuid not null references public.threads (id) on delete cascade,
  assignee_id uuid not null references auth.users (id),
  prompt text not null,
  slot integer not null check (slot between 0 and 8),
  unique (cycle_id, slot)
);

create table public.constellations (
  id uuid primary key default gen_random_uuid(),
  orbit_id uuid not null references public.orbits (id) on delete cascade,
  owner_id uuid not null references auth.users (id),
  catalog_version text not null,
  name text not null,
  story text not null,
  caption text,
  description text,
  image_path text,
  aim jsonb,
  fov double precision,
  segments jsonb not null,
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.assignments (id) on delete cascade,
  constellation_id uuid not null references public.constellations (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  finalized_at timestamptz not null default now()
);

create table public.solve_placements (
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  orbit_id uuid not null references public.orbits (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  ring integer not null check (ring between 0 and 2),
  position integer not null check (position between 0 and 2),
  placed_by uuid not null references auth.users (id),
  placed_at timestamptz not null default now(),
  primary key (cycle_id, submission_id),
  unique (cycle_id, ring, position)
);

create table public.memory_archives (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null unique references public.cycles (id) on delete cascade,
  orbit_id uuid not null references public.orbits (id) on delete cascade,
  theme_title text not null,
  theme_prompt text not null,
  memories jsonb not null,
  created_at timestamptz not null default now()
);

create table public.comet_packages (
  week_key text primary key,
  source text not null check (source in ('grok-imagine', 'fallback')),
  storage_path text not null,
  haptics jsonb not null,
  stored_at timestamptz not null default now()
);

create index orbit_members_user_idx on public.orbit_members (user_id);
create index cycles_orbit_idx on public.cycles (orbit_id, created_at);
create index assignments_cycle_idx on public.assignments (cycle_id);

create or replace function public.is_orbit_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orbit_members
    where orbit_id = target and user_id = auth.uid()
  );
$$;

create or replace function public.redeem_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;
  select orbit_id into target from public.orbit_invites where code = upper(invite_code);
  if target is null then
    raise exception 'not_found';
  end if;
  insert into public.orbit_members (orbit_id, user_id)
  values (target, auth.uid())
  on conflict do nothing;
  return target;
end;
$$;

revoke all on function public.redeem_invite(text) from public;
grant execute on function public.redeem_invite(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.orbits enable row level security;
alter table public.orbit_members enable row level security;
alter table public.orbit_invites enable row level security;
alter table public.cycles enable row level security;
alter table public.threads enable row level security;
alter table public.assignments enable row level security;
alter table public.constellations enable row level security;
alter table public.submissions enable row level security;
alter table public.solve_placements enable row level security;
alter table public.memory_archives enable row level security;
alter table public.comet_packages enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.orbit_members mine
    join public.orbit_members theirs on theirs.orbit_id = mine.orbit_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);

create policy orbits_select on public.orbits
for select to authenticated
using (public.is_orbit_member(id));

create policy orbits_insert on public.orbits
for insert to authenticated
with check (created_by = auth.uid());

create policy members_select on public.orbit_members
for select to authenticated
using (public.is_orbit_member(orbit_id));

create policy members_insert_self on public.orbit_members
for insert to authenticated
with check (user_id = auth.uid());

create policy invites_select on public.orbit_invites
for select to authenticated
using (created_by = auth.uid() or public.is_orbit_member(orbit_id));

create policy invites_insert on public.orbit_invites
for insert to authenticated
with check (created_by = auth.uid() and public.is_orbit_member(orbit_id));

create policy cycles_select on public.cycles
for select to authenticated
using (public.is_orbit_member(orbit_id));

-- Hidden thread answers have no authenticated policy. Service role bypasses RLS.
create policy assignments_select on public.assignments
for select to authenticated
using (public.is_orbit_member(orbit_id));

revoke all on table public.assignments from authenticated;
grant select (id, cycle_id, orbit_id, assignee_id, prompt, slot) on public.assignments to authenticated;

create policy constellations_select on public.constellations
for select to authenticated
using (public.is_orbit_member(orbit_id));

create policy submissions_select on public.submissions
for select to authenticated
using (
  exists (
    select 1
    from public.assignments
    where assignments.id = submissions.assignment_id
      and public.is_orbit_member(assignments.orbit_id)
  )
);

create policy placements_select on public.solve_placements
for select to authenticated
using (public.is_orbit_member(orbit_id));

create policy placements_insert on public.solve_placements
for insert to authenticated
with check (
  placed_by = auth.uid()
  and public.is_orbit_member(orbit_id)
  and exists (
    select 1 from public.cycles
    where cycles.id = solve_placements.cycle_id
      and cycles.orbit_id = solve_placements.orbit_id
      and cycles.phase = 'solving'
  )
);

create policy archives_select on public.memory_archives
for select to authenticated
using (public.is_orbit_member(orbit_id));

create policy comet_select on public.comet_packages
for select to authenticated
using (stored_at is not null);

insert into storage.buckets (id, name, public)
values ('orbit-private', 'orbit-private', false)
on conflict (id) do nothing;

create policy orbit_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'orbit-private'
  and (
    (
      (storage.foldername(name))[1] = 'orbits'
      and public.is_orbit_member(((storage.foldername(name))[2])::uuid)
    )
    or (
      (storage.foldername(name))[1] = 'comet'
      and exists (
        select 1 from public.comet_packages
        where week_key = (storage.foldername(name))[2]
          and stored_at is not null
      )
    )
  )
);

alter table public.solve_placements replica identity full;
alter table public.cycles replica identity full;
alter table public.submissions replica identity full;

alter publication supabase_realtime add table public.solve_placements;
alter publication supabase_realtime add table public.cycles;
alter publication supabase_realtime add table public.submissions;
