-- Open Pixel Supabase schema
-- Run in Supabase SQL editor. Free-tier friendly. RLS enabled.

create extension if not exists pgcrypto;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  guest_id text not null unique,
  wallet_address text unique,
  display_name text not null default 'Pixel Runner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quest_runs (
  id text primary key,
  guest_id text not null references public.players(guest_id) on delete cascade,
  display_name text not null,
  quest_id text not null,
  points integer not null check (points >= 0),
  shards integer not null check (shards >= 0),
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

create or replace view public.leaderboard as
select
  guest_id,
  max(display_name) as display_name,
  sum(points) as total_points,
  count(*) as completed_runs,
  max(completed_at) as last_completed_at
from public.quest_runs
group by guest_id
order by total_points desc, last_completed_at asc;

-- Auto-refresh updated_at on players and verified_at on wallet_proofs
-- so upserts (ON CONFLICT … DO UPDATE) bump the timestamp instead of
-- leaving it frozen at the original INSERT time.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.touch_verified_at()
returns trigger
language plpgsql
as $$
begin
  new.verified_at = now();
  return new;
end;
$$;

drop trigger if exists trg_players_touch_updated_at on public.players;
create trigger trg_players_touch_updated_at
  before update on public.players
  for each row
  execute function public.touch_updated_at();

drop trigger if exists trg_wallet_proofs_touch_verified_at on public.wallet_proofs;
create trigger trg_wallet_proofs_touch_verified_at
  before update on public.wallet_proofs
  for each row
  execute function public.touch_verified_at();

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
