-- Creates the register_verifications table used by the Daily Register view
-- (frontend/src/pages/History.jsx). Run this in the Supabase SQL editor.

create table if not exists public.register_verifications (
  id            bigint generated always as identity primary key,
  date          date        not null,
  loc_id        bigint      not null references public.locations (id) on delete cascade,
  grade         text        not null,
  verified_by   uuid        references auth.users (id) on delete set null,
  verified_name text        not null,
  verified_at   timestamptz not null default now(),
  remark        text,
  -- One verification per register row (date + location + grade)
  unique (date, loc_id, grade)
);

create index if not exists register_verifications_date_idx
  on public.register_verifications (date);

-- Row Level Security: any signed-in user may read; signed-in users may verify.
alter table public.register_verifications enable row level security;

create policy "register_verifications_select"
  on public.register_verifications
  for select
  to authenticated
  using (true);

create policy "register_verifications_insert"
  on public.register_verifications
  for insert
  to authenticated
  with check (true);
