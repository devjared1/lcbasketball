-- ============================================================
-- Basketball Playbook — Supabase schema
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- ---------- extensions ----------
create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ---------- plays ----------
create table if not exists public.plays (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  category    text,
  court_type  text not null default 'half' check (court_type in ('full','half')),
  diagram     jsonb not null default '{"courtType":"half","elements":[]}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.play_videos (
  id           uuid primary key default gen_random_uuid(),
  play_id      uuid not null references public.plays(id) on delete cascade,
  storage_path text not null,
  title        text,
  created_at   timestamptz not null default now()
);
create index if not exists play_videos_play_id_idx on public.play_videos(play_id);

-- ---------- stats ----------
create table if not exists public.players (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  number   int,
  position text,
  active   boolean not null default true
);

create table if not exists public.games (
  id         uuid primary key default gen_random_uuid(),
  opponent   text not null,
  played_on  date not null default current_date,
  location   text,
  notes      text,
  created_at timestamptz not null default now()
);

-- Append-only event log (immutable audit trail). Box scores are derived.
create table if not exists public.stat_events (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  stat       text not null check (stat in (
    'fg_made','fg_miss','three_made','three_miss','ft_made','ft_miss',
    'rebound_off','rebound_def','assist','steal','block','turnover','foul'
  )),
  created_at timestamptz not null default now()
);
create index if not exists stat_events_game_idx on public.stat_events(game_id);

-- ---------- storage bucket for video clips ----------
insert into storage.buckets (id, name, public)
values ('play-videos', 'play-videos', true)
on conflict (id) do nothing;

-- ============================================================
-- Row Level Security
-- ------------------------------------------------------------
-- DEV MODE (default below): allows the anon key full access so the
-- app runs immediately on your machine with no login screen.
-- This is fine for a local / single-coach tool on a trusted network.
--
-- BEFORE exposing this to the internet: drop the dev policies and use
-- the AUTHENTICATED policies at the bottom (and add a login screen),
-- so financial/roster data isn't world-writable.
-- ============================================================
alter table public.plays        enable row level security;
alter table public.play_videos  enable row level security;
alter table public.players      enable row level security;
alter table public.games        enable row level security;
alter table public.stat_events  enable row level security;

-- ----- DEV policies (anon = full access) -----
create policy dev_all_plays       on public.plays       for all to anon using (true) with check (true);
create policy dev_all_play_videos on public.play_videos for all to anon using (true) with check (true);
create policy dev_all_players     on public.players     for all to anon using (true) with check (true);
create policy dev_all_games       on public.games       for all to anon using (true) with check (true);
create policy dev_all_stat_events on public.stat_events for all to anon using (true) with check (true);

-- storage: allow anon read + write to the play-videos bucket (dev)
create policy dev_video_read  on storage.objects for select to anon using (bucket_id = 'play-videos');
create policy dev_video_write on storage.objects for insert to anon with check (bucket_id = 'play-videos');
create policy dev_video_del   on storage.objects for delete to anon using (bucket_id = 'play-videos');

-- ============================================================
-- PRODUCTION policies (uncomment, and DROP the dev_* policies above)
-- Requires Supabase Auth + a login screen in the app.
-- ============================================================
-- create policy auth_all_plays       on public.plays       for all to authenticated using (true) with check (true);
-- create policy auth_all_play_videos on public.play_videos for all to authenticated using (true) with check (true);
-- create policy auth_all_players     on public.players     for all to authenticated using (true) with check (true);
-- create policy auth_all_games       on public.games       for all to authenticated using (true) with check (true);
-- create policy auth_all_stat_events on public.stat_events for all to authenticated using (true) with check (true);
-- create policy auth_video_read  on storage.objects for select to authenticated using (bucket_id = 'play-videos');
-- create policy auth_video_write on storage.objects for insert to authenticated with check (bucket_id = 'play-videos');
-- create policy auth_video_del   on storage.objects for delete to authenticated using (bucket_id = 'play-videos');
