-- Habit Tracker Supabase schema
-- Run this once in the Supabase SQL editor for a new project.

create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#2da44e',
  position integer not null default 0,
  collapsed boolean not null default false,
  completed jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table habits enable row level security;

create policy "Users can view their own habits"
  on habits for select
  using (auth.uid() = user_id);

create policy "Users can insert their own habits"
  on habits for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own habits"
  on habits for update
  using (auth.uid() = user_id);

create policy "Users can delete their own habits"
  on habits for delete
  using (auth.uid() = user_id);

create index if not exists habits_user_id_position_idx on habits (user_id, position);
