import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Spinner } from "../components/ui";
import { ITEM_MAP, claimPerUnit, CONTRACTS, type Contract } from "../lib/rates";
import { formatINR, formatLakh, formatQty } from "../lib/format";
import { addDays, monthRange, prettyRange, todayISO, weekRange, weekStart } from "../lib/dates";
import { fetchBills, fetchLabour, fetchWork } from "../lib/work";
import type { BillRow, DayWithLines, LabourCost } from "../lib/types";

type RangeKey = "week" | "month" | "all";
type Filter = "ALL" | Contract;

const DEFAULT_START = "2026-09-01";

export function ProgressPage() {
  const [days, setDays] = useState<DayWithLines[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [labour, setLabour] = useState<LabourCost>({ wages: 0, bata: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [labourLoading, setLabourLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("week");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [showAll, setShowAll] = useState(false);

  const today = todayISO();

  const period = useMemo(() => {
    if (range === "week") return weekRange(today);
    if (range === "month") return monthRange(today);
    const start = days.length
      ? days.reduce((min, d) => (d.work_date < min ? d.work_date : min), days[0].work_date)
      : DEFAULT_START;
    return { from: start < DEFAULT_START ? start : DEFAULT_START, to: today };
  }, [range, today, days]);

  const load = useCallback(async () => {
    try {
      const [d, b] = await Promise.all([fetchWork(), fetchBills()]);
      setDays(d);
      setBills(b);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load progress");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    setLabourLoading(true);
    fetchLabour(period.from, period.to)
      .then((l) => {
        if (active) setLabour(l);
      })
      .catch(() => {
        if (active) setLabour({ wages: 0, bata: 0, total: 0 });
      })
      .finally(() => {
        if (active) setLabourLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period.from, period.to]);

  const allLines = useMemo(
    () => days.flatMap((d) => d.lines.map((line) => ({ line, day: d }))),
    [days],
  );

  const filtered = useMemo(
    () => allLines.filter((x) => filter === "ALL" || x.day.contract === filter),
    [allLines, filter],
  );

  const cumulative = useMemo(() => {
    let full = 0;
    let claim = 0;
    for (const { line } of filtered) {
      const item = ITEM_MAP[line.item_id];
      if (!item) continue;
      full += Number(line.qty) * item.rate;
      claim += Number(line.qty) * claimPerUnit(item, line.stage_index);
    }
    return { full, claim };
  }, [filtered]);

  const periodTotals = useMemo(() => {
    let full = 0;
    let claim = 0;
    for (const { line, day } of filtered) {
      if (day.work_date < period.from || day.work_date > period.to) continue;
      const item = ITEM_MAP[line.item_id];
      if (!item) continue;
      full += Number(line.qty) * item.rate;
      claim += Number(line.qty) * claimPerUnit(item, line.stage_index);
    }
    return { full, claim };
  }, [filtered, period]);

  const latestBill = bills[0] ?? null;
  const hasBills = bills.length > 0;

  const latestByContract = useMemo(() => {
    const map: Record<Contract, string | null> = { PE: null, LMC: null };
    for (const b of bills) {
      const cur = map[b.contract];
      if (!cur || b.period_end > cur) map[b.contract] = b.period_end;
    }
    return map;
  }, [bills]);

  const bill = useMemo(() => {
    let since = 0;
    let baseline = 0;
    for (const { line, day } of filtered) {
      const item = ITEM_MAP[line.item_id];
      if (!item) continue;
      const value = Number(line.qty) * claimPerUnit(item, line.stage_index);
      const cutoffFor = latestByContract[day.contract];
      if (cutoffFor && day.work_date <= cutoffFor) baseline += value;
      else since += value;
    }
    const gst = since * 0.18;
    const gross = since + gst;
    const it = since * 0.01;
    const cess = gross * 0.01;
    const gstTds = since * 0.02;
    const net = gross - it - cess - gstTds;
    return { since, baseline, gst, gross, it, cess, gstTds, net };
  }, [filtered, latestByContract]);

  const weeks = useMemo(() => {
    const start = addDays(weekStart(today), -7 * 7);
    const buckets: { start: string; value: number }[] = [];
    for (let i = 0; i < 8; i += 1) {
      const from = addDays(start, i * 7);
      const to = addDays(from, 6);
      let value = 0;
      for (const { line, day } of filtered) {
        if (day.work_date < from || day.work_date > to) continue;
        const item = ITEM_MAP[line.item_id];
        if (!item) continue;
        value += Number(line.qty) * claimPerUnit(item, line.stage_index);
      }
      buckets.push({ start: from, value });
    }
    return buckets;
  }, [filtered, today]);

  const maxWeek = Math.max(1, ...weeks.map((w) => w.value));

  const itemProgress = useMemo(() => {
    const map = new Map<
      string,
      { qty: number; full: number; claim: number; contract: Contract }
    >();
    for (const { line } of filtered) {
      const item = ITEM_MAP[line.item_id];
      if (!item) continue;
      const cur = map.get(item.id) ?? {
        qty: 0,
        full: 0,
        claim: 0,
        contract: item.contract,
      };
      cur.qty += Number(line.qty);
      cur.full += Number(line.qty) * item.rate;
      cur.claim += Number(line.qty) * claimPerUnit(item, line.stage_index);
      map.set(item.id, cur);
    }
    return [...map.entries()]
      .map(([id, v]) => ({ item: ITEM_MAP[id], ...v }))
      .sort((a, b) => b.claim - a.claim);
  }, [filtered]);

  const shown = showAll ? itemProgress : itemProgress.slice(0, 12);
  const margin = periodTotals.claim - labour.total;

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {(
            [
              { id: "week", label: "This week" },
              { id: "month", label: "This month" },
              { id: "all", label: "All" },
            ] as { id: RangeKey; label: string }[]
          ).map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-lg py-2 text-xs font-semibold ${
                range === r.id ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          {prettyRange(period.from, period.to)}
        </p>
      </Card>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Margin this period</p>
            <p className={`text-3xl font-bold ${margin >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {formatINR(margin)}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-2">
                <p className="text-[10px] text-slate-400">Claimable</p>
                <p className="text-sm font-bold text-slate-900">{formatLakh(periodTotals.claim)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <p className="text-[10px] text-slate-400">Labour</p>
                <p className="text-sm font-bold text-slate-900">
                  {labourLoading ? "…" : formatLakh(labour.total)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <p className="text-[10px] text-slate-400">Work value</p>
                <p className="text-sm font-bold text-slate-900">{formatLakh(periodTotals.full)}</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              Claimable is stage-based. Labour is the whole project (all sites), not split by
              contract.
            </p>
          </Card>

          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
            {(
              [
                { id: "ALL", label: "Both" },
                { id: "PE", label: "PE" },
                { id: "LMC", label: "LMC" },
              ] as { id: Filter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-lg py-2 text-xs font-semibold ${
                  filter === f.id ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {(filter === "ALL" ? (["PE", "LMC"] as Contract[]) : [filter as Contract]).map((c) => {
            const contract = CONTRACTS[c];
            const rows = filtered.filter((x) => x.day.contract === c);
            let full = 0;
            let claim = 0;
            for (const { line } of rows) {
              const item = ITEM_MAP[line.item_id];
              if (!item) continue;
              full += Number(line.qty) * item.rate;
              claim += Number(line.qty) * claimPerUnit(item, line.stage_index);
            }
            const pct = Math.min(1, full / contract.basicValue);
            return (
              <Card key={c} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">{contract.name}</p>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                      {c}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-brand-700">{Math.round(pct * 100)}%</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct * 100}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                  <span>
                    Work done {formatLakh(full)} of {formatLakh(contract.basicValue)}
                  </span>
                  <span>Claimed {formatLakh(claim)}</span>
                </div>
              </Card>
            );
          })}

          <Card className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">
                {latestBill ? `Next bill after ${latestBill.bill_no}` : "Next RA bill"}
              </p>
              <p className="text-[10px] text-slate-400">
                since last bill
              </p>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatINR(bill.since)}</p>
            <p className="text-[11px] text-slate-500">work value since last bill</p>
            <div className="mt-3 space-y-1 text-xs">
              <Row label="GST 18%" value={formatINR(bill.gst)} />
              <Row label="Gross" value={formatINR(bill.gross)} strong />
              <Row label="Income tax 1%" value={`− ${formatINR(bill.it)}`} />
              <Row label="Labour cess 1%" value={`− ${formatINR(bill.cess)}`} />
              <Row label="GST TDS 2%" value={`− ${formatINR(bill.gstTds)}`} />
              <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm">
                <span className="font-semibold text-slate-600">Net payable</span>
                <span className="font-bold text-brand-700">{formatINR(bill.net)}</span>
              </div>
            </div>
            {hasBills ? (
              <p className="mt-2 text-[10px] text-slate-400">
                RA-01 baseline: {formatINR(bill.baseline)} · cumulative claimed{" "}
                {formatINR(bill.baseline + bill.since)}
              </p>
            ) : null}
          </Card>

          <Card className="p-3">
            <p className="text-sm font-bold text-slate-900">Weekly claimable</p>
            <p className="text-[11px] text-slate-500">Last 8 weeks · {filter === "ALL" ? "both contracts" : filter}</p>
            <div className="mt-3 flex h-28 items-end gap-1.5">
              {weeks.map((w, idx) => (
                <div key={w.start} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t ${
                      idx === weeks.length - 1 ? "bg-brand-600" : "bg-brand-200"
                    }`}
                    style={{ height: `${Math.max(2, (w.value / maxWeek) * 90)}px` }}
                    title={formatINR(w.value)}
                  />
                  <span className="text-[9px] text-slate-400">{w.start.slice(8)}</span>
                </div>
              ))}
            </div>
            <p className="mt-1 text-right text-[10px] text-slate-400">
              Highest week {formatLakh(maxWeek)}
            </p>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Item progress
              </p>
              <p className="text-[10px] text-slate-400">{itemProgress.length} items</p>
            </div>
            {shown.map((row) => {
              const item = row.item;
              const pct = item && item.loaQty > 0 ? row.qty / item.loaQty : 0;
              const over = pct > 1;
              return (
                <div key={row.item?.id} className="border-t border-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800">
                        {item?.name}
                        <span className="ml-1 text-[10px] font-normal text-slate-400">
                          {item?.detail}
                        </span>
                      </p>
                      <p className={`text-[10px] ${over ? "text-amber-600" : "text-slate-500"}`}>
                        {formatQty(row.qty)} / {formatQty(item?.loaQty ?? 0)} {item?.uom} ·{" "}
                        {Math.round(pct * 100)}% of LOA{over ? " · over LOA" : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-bold text-slate-900">
                      {formatLakh(row.claim)}
                    </p>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${over ? "bg-amber-500" : "bg-brand-500"}`}
                      style={{ width: `${Math.min(100, pct * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {itemProgress.length > 12 ? (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="w-full border-t border-slate-100 p-3 text-xs font-semibold text-brand-700"
              >
                {showAll ? "Show less" : `Show all ${itemProgress.length} items`}
              </button>
            ) : null}
            {itemProgress.length === 0 ? (
              <p className="p-4 text-center text-sm text-slate-400">No work logged for this filter.</p>
            ) : null}
          </Card>

          <Card className="p-3">
            <p className="text-sm font-bold text-slate-900">Labour cost</p>
            <p className="text-[11px] text-slate-500">
              Attendance app · whole project · {prettyRange(period.from, period.to)}
            </p>
            <div className="mt-2 space-y-1 text-sm">
              <Row label="Wages" value={labourLoading ? "…" : formatINR(labour.wages)} />
              <Row label="Bata spent" value={labourLoading ? "…" : formatINR(labour.bata)} />
              <div className="flex justify-between border-t border-slate-100 pt-1.5">
                <span className="font-semibold text-slate-600">Total</span>
                <span className="font-bold text-slate-900">
                  {labourLoading ? "…" : formatINR(labour.total)}
                </span>
              </div>
            </div>
          </Card>
        </>
      )}

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <p className="px-1 pb-2 text-[11px] text-slate-400">
        Cumulative earned {formatLakh(cumulative.claim)} across {filter === "ALL" ? "both contracts" : filter}.
      </p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={strong ? "font-semibold text-slate-700" : "text-slate-500"}>{label}</span>
      <span className={strong ? "font-bold text-slate-900" : "text-slate-700"}>{value}</span>
    </div>
  );
}
