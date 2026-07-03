create extension if not exists pgcrypto;
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  raw_text text not null,
  journal_text text not null,
  mood text,
  topic text,
  created_at timestamptz not null default now()
);
alter table public.entries enable row level security;
drop policy if exists "Users can read own entries" on public.entries;
create policy "Users can read own entries" on public.entries for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own entries" on public.entries;
create policy "Users can insert own entries" on public.entries for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete own entries" on public.entries;
create policy "Users can delete own entries" on public.entries for delete using (auth.uid() = user_id);
