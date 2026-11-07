-- ============================================================
--  GAIL Works - SOR rates, work log, site plan and RA bills
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

-- A planned piece of work at a site. One activity = one SOR item.
-- Daily work lines can be linked to it, so progress is the sum of
-- the quantities logged against it.
create table if not exists public.sor_activities (
  id           uuid primary key default gen_random_uuid(),
  contract     text not null check (contract in ('PE', 'LMC')),
  location_id  uuid not null references public.locations(id) on delete cascade,
  item_id      text not null,
  title        text not null,
  phase        text,
  planned_qty  numeric(14,3),
  uom          text not null,
  stage_index  integer not null default 0 check (stage_index >= 0),
  start_date   date,
  target_date  date,
  status       text not null default 'planned' check (status in ('planned', 'in_progress', 'done')),
  note         text,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

-- The work lines inside a day. `stage_index` is the highest LOA stage
-- reached for that quantity (0 = first stage). `qty` is always in the
-- SOR unit; `input_text` keeps the original feet/inches measurement.
create table if not exists public.sor_work_lines (
  id          uuid primary key default gen_random_uuid(),
  day_id      uuid not null references public.sor_work_days(id) on delete cascade,
  activity_id uuid references public.sor_activities(id) on delete set null,
  item_id     text not null,
  qty         numeric(14,3) not null check (qty > 0),
  stage_index integer not null default 0 check (stage_index >= 0),
  input_text  text,
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
create index if not exists sor_work_lines_activity_idx on public.sor_work_lines (activity_id);
create index if not exists sor_activities_site_idx on public.sor_activities (location_id, contract, status);

alter table public.sor_work_days enable row level security;
alter table public.sor_activities enable row level security;
alter table public.sor_work_lines enable row level security;
alter table public.sor_bills enable row level security;

drop policy if exists "sor_work_days_owner_all" on public.sor_work_days;
create policy "sor_work_days_owner_all"
  on public.sor_work_days for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "sor_activities_owner_all" on public.sor_activities;
create policy "sor_activities_owner_all"
  on public.sor_activities for all
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
