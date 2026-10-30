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

create index if not exists prayer_intentions_parish_created_idx
  on public.prayer_intentions (parish_id, created_at desc) where is_public = true;

alter table public.parishes enable row level security;
alter table public.prayer_intentions enable row level security;

-- Public parish metadata and public intentions can be read by visitors.
create policy "parishes are readable" on public.parishes for select using (true);
drop policy if exists "public intentions are readable" on public.prayer_intentions;
create policy "public intentions are readable" on public.prayer_intentions
  for select using (is_public = true and expires_at > now());
-- Authenticated users may submit intentions only as themselves.
drop policy if exists "users submit own intentions" on public.prayer_intentions;
create policy "users submit own intentions" on public.prayer_intentions
  for insert to authenticated with check (author_id = auth.uid());

-- Realtime is used only for public prayer intentions; private intentions are never broadcast.
alter publication supabase_realtime add table public.prayer_intentions;

-- Explicit grants for the application roles.
grant select on public.parishes to anon, authenticated;
grant select on public.prayer_intentions to anon;
grant select, insert on public.prayer_intentions to authenticated;
