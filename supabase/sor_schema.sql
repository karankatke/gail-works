-- ============================================================
--  GAIL Works - SOR rates, weekly work log and RA bill baseline
--  Shared Supabase project with the attendance app.
--  Owner-only tables. The attendance tables are only read for cost.
-- ============================================================

create extension if not exists "pgcrypto";

-- One row per working day, per contract.
create table if not exists public.sor_work_days (
  id          uuid primary key default gen_random_uuid(),
  work_date   date not null,
  contract    text not null check (contract in ('PE', 'LMC')),
  location_id uuid references public.locations(id) on delete set null,
  note        text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

-- The work lines inside a day. `stage_index` is the highest LOA stage
-- reached for that quantity (0 = first stage). Claim % is derived from
-- the rate card in the app, so changing a rate never rewrites history.
create table if not exists public.sor_work_lines (
  id          uuid primary key default gen_random_uuid(),
  day_id      uuid not null references public.sor_work_days(id) on delete cascade,
  item_id     text not null,
  qty         numeric(14,3) not null check (qty > 0),
  stage_index integer not null default 0 check (stage_index >= 0),
  note        text,
  created_at  timestamptz not null default now()
);

-- RA bill cutoffs. Work after the latest period_end is the next bill.
create table if not exists public.sor_bills (
  id           uuid primary key default gen_random_uuid(),
  contract     text not null check (contract in ('PE', 'LMC')),
  bill_no      text not null,
  period_end   date not null,
  invoice_date date,
  created_at   timestamptz not null default now(),
  unique (contract, bill_no)
);

create index if not exists sor_work_days_date_idx on public.sor_work_days (work_date desc);
create index if not exists sor_work_days_contract_idx on public.sor_work_days (contract);
create index if not exists sor_work_lines_day_idx on public.sor_work_lines (day_id);
create index if not exists sor_work_lines_item_idx on public.sor_work_lines (item_id);

alter table public.sor_work_days enable row level security;
alter table public.sor_work_lines enable row level security;
alter table public.sor_bills enable row level security;

drop policy if exists "sor_work_days_owner_all" on public.sor_work_days;
create policy "sor_work_days_owner_all"
  on public.sor_work_days for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "sor_work_lines_owner_all" on public.sor_work_lines;
create policy "sor_work_lines_owner_all"
  on public.sor_work_lines for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "sor_bills_owner_all" on public.sor_bills;
create policy "sor_bills_owner_all"
  on public.sor_bills for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());
