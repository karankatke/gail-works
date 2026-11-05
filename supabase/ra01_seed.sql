-- RA-01 baseline (up to 16 Oct 2026).
-- These are the executed quantities from the two RA-01 measurement sheets.
-- Quantities are what matters; the app values them with the final LOA rates.
-- Safe to re-run: it only inserts when the matching baseline is missing.

insert into public.sor_bills (contract, bill_no, period_end, invoice_date)
values ('PE', 'RA-01', date '2026-10-16', date '2026-10-16')
on conflict (contract, bill_no) do nothing;

insert into public.sor_bills (contract, bill_no, period_end, invoice_date)
values ('LMC', 'RA-01', date '2026-10-16', date '2026-10-16')
on conflict (contract, bill_no) do nothing;

with d as (
  insert into public.sor_work_days (work_date, contract, location_id, note)
  select date '2026-10-16', 'PE', null, 'RA-01 baseline'
  where not exists (
    select 1 from public.sor_work_days where contract = 'PE' and note = 'RA-01 baseline'
  )
  returning id
)
insert into public.sor_work_lines (day_id, item_id, qty, stage_index)
select d.id, x.item_id, x.qty, x.stage_index
from d, (values
  ('PE-1.1', 7::numeric, 1),
  ('PE-2.4.A.1', 185::numeric, 3),
  ('PE-2.4.A.2', 120::numeric, 3),
  ('PE-3.2.2', 4::numeric, 2),
  ('PE-3.3', 4::numeric, 2),
  ('PE-4', 298::numeric, 1),
  ('PE-6.1', 2::numeric, 2),
  ('PE-6.3', 1::numeric, 2),
  ('PE-9.1.1', 1::numeric, 3),
  ('PE-10.1', 1::numeric, 2),
  ('PE-11.1', 1::numeric, 2),
  ('PE-11.2', 1::numeric, 2),
  ('PE-13.1', 3::numeric, 1),
  ('PE-13.3', 2::numeric, 1),
  ('PE-17.1', 4::numeric, 1),
  ('PE-17.2', 1192::numeric, 1)
) as x(item_id, qty, stage_index);

with d as (
  insert into public.sor_work_days (work_date, contract, location_id, note)
  select date '2026-10-16', 'LMC', null, 'RA-01 baseline'
  where not exists (
    select 1 from public.sor_work_days where contract = 'LMC' and note = 'RA-01 baseline'
  )
  returning id
)
insert into public.sor_work_lines (day_id, item_id, qty, stage_index)
select d.id, x.item_id, x.qty, x.stage_index
from d, (values
  ('LMC-13.2.a', 54.77::numeric, 3),
  ('LMC-16', 109.5::numeric, 3),
  ('LMC-17', 33::numeric, 3),
  ('LMC-18.a', 33::numeric, 3),
  ('LMC-19.a', 33::numeric, 3),
  ('LMC-20', 33::numeric, 3),
  ('LMC-26', 37::numeric, 3),
  ('LMC-27', 37::numeric, 3)
) as x(item_id, qty, stage_index);
