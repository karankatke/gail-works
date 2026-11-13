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

-- ------------------------------------------------------------
-- Estimator: one estimate with a basket of SOR items, material
-- cost and crew days. Totals are computed in the app.
-- ------------------------------------------------------------
create table if not exists public.sor_estimates (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  contract           text not null check (contract in ('PE', 'LMC')),
  location_id        uuid references public.locations(id) on delete set null,
  material_cost      numeric(14,2) not null default 0,
  crew_days          numeric(10,2) not null default 0,
  daily_labour_cost  numeric(14,2) not null default 0,
  subcontract_mode   text check (subcontract_mode in ('per_meter', 'per_flat')),
  subcontract_rate   numeric(14,2) not null default 0,
  subcontract_qty    numeric(14,3) not null default 0,
  drawing_cost       numeric(14,2) not null default 0,
  conversion_cost    numeric(14,2) not null default 0,
  misc_cost          numeric(14,2) not null default 0,
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.sor_estimate_lines (
  id           uuid primary key default gen_random_uuid(),
  estimate_id  uuid not null references public.sor_estimates(id) on delete cascade,
  item_id      text not null,
  qty          numeric(14,3) not null check (qty > 0),
  uom          text not null,
  rate         numeric(14,2) not null,
  input_text   text,
  created_at   timestamptz not null default now()
);

create index if not exists sor_estimates_created_idx on public.sor_estimates (created_at desc);
create index if not exists sor_estimate_lines_estimate_idx on public.sor_estimate_lines (estimate_id);

alter table public.sor_estimates enable row level security;
alter table public.sor_estimate_lines enable row level security;

drop policy if exists "sor_estimates_owner_all" on public.sor_estimates;
create policy "sor_estimates_owner_all"
  on public.sor_estimates for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "sor_estimate_lines_owner_all" on public.sor_estimate_lines;
create policy "sor_estimate_lines_owner_all"
  on public.sor_estimate_lines for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- Save/update the estimate and replace its lines in one transaction.
drop function if exists public.save_estimate(uuid, text, text, uuid, numeric, numeric, numeric, text, jsonb);

create or replace function public.save_estimate(
  p_id uuid,
  p_name text,
  p_contract text,
  p_location_id uuid,
  p_material_cost numeric,
  p_crew_days numeric,
  p_daily_labour_cost numeric,
  p_subcontract_mode text,
  p_subcontract_rate numeric,
  p_subcontract_qty numeric,
  p_drawing_cost numeric,
  p_conversion_cost numeric,
  p_misc_cost numeric,
  p_note text,
  p_lines jsonb
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into public.sor_estimates
      (name, contract, location_id, material_cost, crew_days, daily_labour_cost,
       subcontract_mode, subcontract_rate, subcontract_qty, drawing_cost,
       conversion_cost, misc_cost, note)
    values
      (p_name, p_contract, p_location_id, p_material_cost, p_crew_days, p_daily_labour_cost,
       p_subcontract_mode, p_subcontract_rate, p_subcontract_qty, p_drawing_cost,
       p_conversion_cost, p_misc_cost, p_note)
    returning id into v_id;
  else
    update public.sor_estimates
    set name = p_name,
        contract = p_contract,
        location_id = p_location_id,
        material_cost = p_material_cost,
        crew_days = p_crew_days,
        daily_labour_cost = p_daily_labour_cost,
        subcontract_mode = p_subcontract_mode,
        subcontract_rate = p_subcontract_rate,
        subcontract_qty = p_subcontract_qty,
        drawing_cost = p_drawing_cost,
        conversion_cost = p_conversion_cost,
        misc_cost = p_misc_cost,
        note = p_note,
        updated_at = now()
    where id = p_id
    returning id into v_id;
    delete from public.sor_estimate_lines where estimate_id = v_id;
  end if;

  insert into public.sor_estimate_lines (estimate_id, item_id, qty, uom, rate, input_text)
  select v_id, x.item_id, x.qty, x.uom, x.rate, x.input_text
  from jsonb_to_recordset(p_lines)
    as x(item_id text, qty numeric, uom text, rate numeric, input_text text);

  return v_id;
end;
$$;

revoke all on function public.save_estimate(uuid, text, text, uuid, numeric, numeric, numeric, text, numeric, numeric, numeric, numeric, numeric, text, jsonb) from public;
grant execute on function public.save_estimate(uuid, text, text, uuid, numeric, numeric, numeric, text, numeric, numeric, numeric, numeric, numeric, text, jsonb) to authenticated;
