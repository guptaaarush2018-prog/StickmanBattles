-- Supabase auth + cloud save schema for Stickman Battles
-- Mirrors the existing local save structure while keeping a full snapshot row.

create extension if not exists pgcrypto;

create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  provider text not null default 'email',
  last_login_at timestamptz,
  last_sync_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.player_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save_version integer not null default 3,
  progress_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.player_unlocked_weapons (
  user_id uuid not null references auth.users(id) on delete cascade,
  weapon_key text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, weapon_key)
);

create table if not exists public.player_chapters_beaten (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_index integer not null,
  beaten_at timestamptz not null default now(),
  primary key (user_id, chapter_index)
);

create table if not exists public.player_cosmetics (
  user_id uuid not null references auth.users(id) on delete cascade,
  cosmetic_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, cosmetic_id)
);

create table if not exists public.player_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stats_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.player_save_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save_version integer not null default 3,
  save_data jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.smb_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists smb_touch_player_profiles on public.player_profiles;
create trigger smb_touch_player_profiles
before update on public.player_profiles
for each row execute function public.smb_touch_updated_at();

drop trigger if exists smb_touch_player_progress on public.player_progress;
create trigger smb_touch_player_progress
before update on public.player_progress
for each row execute function public.smb_touch_updated_at();

drop trigger if exists smb_touch_player_stats on public.player_stats;
create trigger smb_touch_player_stats
before update on public.player_stats
for each row execute function public.smb_touch_updated_at();

drop trigger if exists smb_touch_player_save_snapshots on public.player_save_snapshots;
create trigger smb_touch_player_save_snapshots
before update on public.player_save_snapshots
for each row execute function public.smb_touch_updated_at();

alter table public.player_profiles enable row level security;
alter table public.player_progress enable row level security;
alter table public.player_unlocked_weapons enable row level security;
alter table public.player_chapters_beaten enable row level security;
alter table public.player_cosmetics enable row level security;
alter table public.player_stats enable row level security;
alter table public.player_save_snapshots enable row level security;

drop policy if exists "Own profile row" on public.player_profiles;
create policy "Own profile row"
on public.player_profiles
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Own progress row" on public.player_progress;
create policy "Own progress row"
on public.player_progress
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Own weapon rows" on public.player_unlocked_weapons;
create policy "Own weapon rows"
on public.player_unlocked_weapons
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Own chapter rows" on public.player_chapters_beaten;
create policy "Own chapter rows"
on public.player_chapters_beaten
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Own cosmetic rows" on public.player_cosmetics;
create policy "Own cosmetic rows"
on public.player_cosmetics
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Own stats row" on public.player_stats;
create policy "Own stats row"
on public.player_stats
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Own snapshot row" on public.player_save_snapshots;
create policy "Own snapshot row"
on public.player_save_snapshots
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists player_profiles_updated_at_idx on public.player_profiles (updated_at desc);
create index if not exists player_progress_updated_at_idx on public.player_progress (updated_at desc);
create index if not exists player_stats_updated_at_idx on public.player_stats (updated_at desc);
create index if not exists player_save_snapshots_updated_at_idx on public.player_save_snapshots (updated_at desc);
