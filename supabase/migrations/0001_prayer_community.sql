-- Religion / Catholic parish prayer community
-- Apply with Supabase CLI or SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.parishes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.prayer_intentions (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  intention text not null check (char_length(intention) between 3 and 500),
  is_public boolean not null default false,
  candle_lit boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create table if not exists public.rosary_contributions (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  decades integer not null check (decades between 1 and 20),
  created_at timestamptz not null default now()
);

create index if not exists prayer_intentions_parish_created_idx
  on public.prayer_intentions (parish_id, created_at desc) where is_public = true;
create index if not exists rosary_contributions_parish_created_idx
  on public.rosary_contributions (parish_id, created_at desc);

alter table public.parishes enable row level security;
alter table public.prayer_intentions enable row level security;
alter table public.rosary_contributions enable row level security;

-- Public parish metadata and public intentions can be read by visitors.
create policy "parishes are readable" on public.parishes for select using (true);
create policy "public intentions are readable" on public.prayer_intentions
  for select using (is_public = true);
-- Authenticated users may submit intentions only as themselves.
create policy "users submit own intentions" on public.prayer_intentions
  for insert to authenticated with check (author_id = auth.uid());
-- Contribution rows are readable for aggregate community progress.
create policy "rosary contributions are readable" on public.rosary_contributions
  for select using (true);
create policy "users submit own rosary contributions" on public.rosary_contributions
  for insert to authenticated with check (user_id = auth.uid());

-- Enable Realtime for the shared rosary ledger.
alter publication supabase_realtime add table public.rosary_contributions;
