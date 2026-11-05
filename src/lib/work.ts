import { requireClient } from "./supabase";
import { claimPct } from "./rates";
import type { RateItem } from "./rates";
import type {
  BillRow,
  DayWithLines,
  LabourCost,
  LocationRow,
  WorkDayRow,
  WorkLineRow,
} from "./types";

export async function fetchLocations(): Promise<LocationRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("locations")
    .select("id,name,active")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as LocationRow[];
}

export async function fetchWorkDays(): Promise<WorkDayRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("sor_work_days")
    .select("id,work_date,contract,location_id,note,created_at")
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WorkDayRow[];
}

export async function fetchWorkLines(): Promise<WorkLineRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("sor_work_lines")
    .select("id,day_id,item_id,qty,stage_index,note");
  if (error) throw error;
  return (data ?? []) as WorkLineRow[];
}

export async function fetchWork(): Promise<DayWithLines[]> {
  const [days, lines] = await Promise.all([fetchWorkDays(), fetchWorkLines()]);
  const byDay = new Map<string, WorkLineRow[]>();
  for (const line of lines) {
    const list = byDay.get(line.day_id) ?? [];
    list.push(line);
    byDay.set(line.day_id, list);
  }
  return days.map((d) => ({ ...d, lines: byDay.get(d.id) ?? [] }));
}

export async function saveWorkDay(input: {
  work_date: string;
  contract: WorkDayRow["contract"];
  location_id: string | null;
  note: string | null;
  lines: { item_id: string; qty: number; stage_index: number; note: string | null }[];
}): Promise<string> {
  const client = requireClient();
  const { data: day, error: dayErr } = await client
    .from("sor_work_days")
    .insert({
      work_date: input.work_date,
      contract: input.contract,
      location_id: input.location_id,
      note: input.note,
    })
    .select("id")
    .single();
  if (dayErr) throw dayErr;
  const dayId = day.id as string;

  if (input.lines.length > 0) {
    const { error: lineErr } = await client.from("sor_work_lines").insert(
      input.lines.map((l) => ({
        day_id: dayId,
        item_id: l.item_id,
        qty: l.qty,
        stage_index: l.stage_index,
        note: l.note,
      })),
    );
    if (lineErr) {
      await client.from("sor_work_days").delete().eq("id", dayId);
      throw lineErr;
    }
  }
  return dayId;
}

export async function deleteWorkDay(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("sor_work_days").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchBills(): Promise<BillRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("sor_bills")
    .select("id,contract,bill_no,period_end,invoice_date")
    .order("period_end", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BillRow[];
}

export async function fetchLabour(from: string, to: string): Promise<LabourCost> {
  const client = requireClient();
  const [report, bata] = await Promise.all([
    client.rpc("report_range", { p_from: from, p_to: to, p_include_monthly: true }),
    client.rpc("report_bata", { p_from: from, p_to: to }),
  ]);
  if (report.error) throw report.error;
  if (bata.error) throw bata.error;

  const wages = ((report.data ?? []) as { gross_pay: number }[]).reduce(
    (s, r) => s + Number(r.gross_pay ?? 0),
    0,
  );
  const bataSpent = ((bata.data ?? []) as { spent: number }[]).reduce(
    (s, r) => s + Number(r.spent ?? 0),
    0,
  );
  return { wages, bata: bataSpent, total: wages + bataSpent };
}

export function lineValues(line: WorkLineRow, item: RateItem | undefined) {
  if (!item) return { full: 0, claim: 0, pct: 0 };
  const full = Number(line.qty) * item.rate;
  const pct = claimPct(item.stages, line.stage_index);
  return { full, claim: full * pct, pct };
}

export function dayTotals(day: DayWithLines, map: Record<string, RateItem>) {
  let full = 0;
  let claim = 0;
  for (const line of day.lines) {
    const v = lineValues(line, map[line.item_id]);
    full += v.full;
    claim += v.claim;
  }
  return { full, claim };
}
