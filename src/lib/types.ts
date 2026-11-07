import type { Contract } from "./rates";

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  role: "owner" | "supervisor";
  status: string;
  active: boolean;
}

export interface LocationRow {
  id: string;
  name: string;
  active: boolean;
}

export interface WorkDayRow {
  id: string;
  work_date: string;
  contract: Contract;
  location_id: string | null;
  note: string | null;
  created_at: string;
}

export interface WorkLineRow {
  id: string;
  day_id: string;
  item_id: string;
  qty: number;
  stage_index: number;
  note: string | null;
  input_text: string | null;
  activity_id: string | null;
}

export interface BillRow {
  id: string;
  contract: Contract;
  bill_no: string;
  period_end: string;
  invoice_date: string | null;
}

export interface ActivityRow {
  id: string;
  contract: Contract;
  location_id: string;
  item_id: string;
  title: string;
  phase: string | null;
  planned_qty: number | null;
  uom: string;
  stage_index: number;
  start_date: string | null;
  target_date: string | null;
  status: "planned" | "in_progress" | "done";
  note: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface LabourCost {
  wages: number;
  bata: number;
  total: number;
}

export interface DayWithLines extends WorkDayRow {
  lines: WorkLineRow[];
}
