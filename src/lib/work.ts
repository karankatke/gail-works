import { requireClient } from "./supabase";
import { claimPct, claimPerUnit } from "./rates";
import type { RateItem } from "./rates";
import type {
  ActivityRow,
  BillRow,
  DayWithLines,
  EstimateLineRow,
  EstimateRow,
  EstimateWithLines,
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
    .select("id,day_id,item_id,qty,stage_index,note,input_text,activity_id");
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
  lines: {
    item_id: string;
    qty: number;
    stage_index: number;
    note: string | null;
    input_text?: string | null;
    activity_id?: string | null;
  }[];
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
        input_text: l.input_text ?? null,
        activity_id: l.activity_id ?? null,
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

export async function fetchActivities(): Promise<ActivityRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("sor_activities")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ActivityRow[];
}

export async function addActivity(input: {
  contract: ActivityRow["contract"];
  location_id: string;
  item_id: string;
  title: string;
  phase: string | null;
  planned_qty: number | null;
  uom: string;
  stage_index: number;
  start_date: string | null;
  target_date: string | null;
  note: string | null;
}): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("sor_activities").insert(input);
  if (error) throw error;
}

export async function updateActivity(
  id: string,
  patch: Partial<{
    title: string;
    phase: string | null;
    planned_qty: number | null;
    stage_index: number;
    start_date: string | null;
    target_date: string | null;
    status: ActivityRow["status"];
    note: string | null;
    completed_at: string | null;
  }>,
): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("sor_activities").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteActivity(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("sor_activities").delete().eq("id", id);
  if (error) throw error;
}

export async function addBill(input: {
  contract: BillRow["contract"];
  bill_no: string;
  period_end: string;
  invoice_date: string | null;
}): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("sor_bills").insert({
    contract: input.contract,
    bill_no: input.bill_no.trim(),
    period_end: input.period_end,
    invoice_date: input.invoice_date || null,
  });
  if (error) throw error;
}

export async function deleteBill(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("sor_bills").delete().eq("id", id);
  if (error) throw error;
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
  return { full, claim: Number(line.qty) * claimPerUnit(item, line.stage_index), pct };
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

export async function fetchEstimates(): Promise<EstimateWithLines[]> {
  const client = requireClient();
  const [est, lines] = await Promise.all([
    client.from("sor_estimates").select("*").order("created_at", { ascending: false }),
    client.from("sor_estimate_lines").select("*"),
  ]);
  if (est.error) throw est.error;
  if (lines.error) throw lines.error;
  const byId = new Map<string, EstimateLineRow[]>();
  for (const line of (lines.data ?? []) as EstimateLineRow[]) {
    const list = byId.get(line.estimate_id) ?? [];
    list.push(line);
    byId.set(line.estimate_id, list);
  }
  return ((est.data ?? []) as EstimateRow[]).map((e) => ({
    ...e,
    lines: byId.get(e.id) ?? [],
  }));
}

export async function saveEstimate(input: {
  id: string | null;
  name: string;
  contract: EstimateRow["contract"];
  location_id: string | null;
  material_cost: number;
  crew_days: number;
  daily_labour_cost: number;
  subcontract_mode: "per_meter" | "per_flat" | null;
  subcontract_rate: number;
  subcontract_qty: number;
  drawing_cost: number;
  conversion_cost: number;
  misc_cost: number;
  note: string | null;
  lines: { item_id: string; qty: number; uom: string; rate: number; input_text: string | null }[];
}): Promise<string> {
  const client = requireClient();
  const { data, error } = await client.rpc("save_estimate", {
    p_id: input.id,
    p_name: input.name,
    p_contract: input.contract,
    p_location_id: input.location_id,
    p_material_cost: input.material_cost,
    p_crew_days: input.crew_days,
    p_daily_labour_cost: input.daily_labour_cost,
    p_subcontract_mode: input.subcontract_mode,
    p_subcontract_rate: input.subcontract_rate,
    p_subcontract_qty: input.subcontract_qty,
    p_drawing_cost: input.drawing_cost,
    p_conversion_cost: input.conversion_cost,
    p_misc_cost: input.misc_cost,
    p_note: input.note,
    p_lines: input.lines,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteEstimate(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("sor_estimates").delete().eq("id", id);
  if (error) throw error;
}
