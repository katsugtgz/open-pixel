-- Open Pixel Supabase schema
-- Run in Supabase SQL editor. Free-tier friendly. RLS enabled.

create extension if not exists pgcrypto;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  guest_id text not null unique,
  wallet_address text unique,
  display_name text not null default 'Pixel Runner' check (char_length(display_name) <= 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quest_runs (
  id text primary key,
  guest_id text not null references public.players(guest_id) on delete cascade,
  display_name text not null,
  quest_id text not null,
  points integer not null check (points >= 0 and points <= 200),
  shards integer not null check (shards >= 0 and shards <= 10),
  completed_at timestamptz not null default now()
);

create table if not exists public.wallet_proofs (
  id uuid primary key default gen_random_uuid(),
  quest_run_id text not null references public.quest_runs(id) on delete cascade,
  wallet_address text not null,
  message text not null,
  signature text not null,
  method text not null check (method = 'personal_sign'),
  verified_at timestamptz not null default now(),
  unique (quest_run_id, wallet_address)
);

-- Idempotent CHECK constraints: inline checks above only apply on fresh
-- `create table`. These alter blocks let an already-deployed database pick
-- up the same guards without manual surgery.
do $$ begin
  alter table public.players
    add constraint players_display_name_length
    check (char_length(display_name) <= 32);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$ begin
  alter table public.quest_runs
    add constraint quest_runs_points_range
    check (points >= 0 and points <= 200);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$ begin
  alter table public.quest_runs
    add constraint quest_runs_shards_range
    check (shards >= 0 and shards <= 10);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

create or replace view public.leaderboard as
select
  qr.guest_id,
  max(qr.display_name) as display_name,
  sum(qr.points) as total_points,
  count(*) as completed_runs,
  max(qr.completed_at) as last_completed_at,
  bool_or(exists (
    select 1 from public.wallet_proofs wp where wp.quest_run_id = qr.id
  )) as has_proof
from public.quest_runs qr
group by qr.guest_id
order by total_points desc, last_completed_at asc;

alter table public.players enable row level security;
alter table public.quest_runs enable row level security;
alter table public.wallet_proofs enable row level security;

-- Hackathon MVP policy: public insert/read with anon key.
-- Tighten before production: issue per-player auth/JWT or signed server endpoint.
do $$ begin
  create policy "players public read" on public.players for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "players public upsert" on public.players for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "players public update own guest" on public.players for update using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "quest runs public read" on public.quest_runs for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "quest runs public insert" on public.quest_runs for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "quest runs public update" on public.quest_runs for update using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "wallet proofs public read" on public.wallet_proofs for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "wallet proofs public insert" on public.wallet_proofs for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "wallet proofs public update" on public.wallet_proofs for update using (true) with check (true);
exception when duplicate_object then null; end $$;
