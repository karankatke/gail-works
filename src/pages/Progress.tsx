import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Spinner } from "../components/ui";
import { ITEM_MAP, claimPerUnit, CONTRACTS, type Contract, type RateItem } from "../lib/rates";
import { formatINR, formatINR2, formatLakh, formatQty } from "../lib/format";
import {
  monthChunks,
  monthRange,
  parseISO,
  prettyDateLong,
  prettyRange,
  toISODate,
  todayISO,
} from "../lib/dates";
import { fetchBills, fetchLabour, fetchLocations, fetchWork } from "../lib/work";
import type { BillRow, DayWithLines, LabourCost, LocationRow } from "../lib/types";

type RangeKey = "week" | "month" | "all";
type Filter = "ALL" | Contract;

const DEFAULT_START = "2026-09-01";

function nextBillInfo(bill: BillRow | null): { no: string; period: string } | null {
  if (!bill) return null;
  const m = bill.bill_no.match(/^(.*?)(\d+)$/);
  const no = m ? `${m[1]}${String(Number(m[2]) + 1).padStart(m[2].length, "0")}` : bill.bill_no;
  const d = parseISO(bill.period_end);
  let start: Date;
  let end: Date;
  if (d.getDate() === 15) {
    start = new Date(d.getFullYear(), d.getMonth(), 16);
    end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  } else {
    start = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    end = new Date(d.getFullYear(), d.getMonth() + 2, 0);
  }
  return { no, period: prettyRange(toISODate(start), toISODate(end)) };
}

export function ProgressPage() {
  const [days, setDays] = useState<DayWithLines[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [labour, setLabour] = useState<LabourCost>({ wages: 0, bata: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [labourLoading, setLabourLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("week");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [itemContract, setItemContract] = useState<Contract>("PE");
  const [showAll, setShowAll] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const today = todayISO();

  const period = useMemo(() => {
    if (range === "week") {
      const chunks = monthChunks(today);
      const current =
        chunks.find((c) => c.from <= today && c.to >= today) ?? chunks[chunks.length - 1];
      return { from: current.from, to: current.to };
    }
    if (range === "month") return monthRange(today);
    const start = days.length
      ? days.reduce((min, d) => (d.work_date < min ? d.work_date : min), days[0].work_date)
      : DEFAULT_START;
    return { from: start < DEFAULT_START ? start : DEFAULT_START, to: today };
  }, [range, today, days]);

  const load = useCallback(async () => {
    try {
      const [d, b, l] = await Promise.all([fetchWork(), fetchBills(), fetchLocations()]);
      setDays(d);
      setBills(b);
      setLocations(l);
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
    if (filter !== "ALL") setItemContract(filter);
  }, [filter]);

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
  const nextBill = useMemo(() => nextBillInfo(latestBill), [latestBill]);

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
    const now = parseISO(today);
    const months = [2, 1, 0].map(
      (offset) => new Date(now.getFullYear(), now.getMonth() - offset, 1),
    );
    const chunks = months
      .flatMap((m) => monthChunks(toISODate(m)))
      .filter((c) => c.from <= today);
    return chunks.slice(-8).map((c) => {
      let value = 0;
      for (const { line, day } of filtered) {
        if (day.work_date < c.from || day.work_date > c.to) continue;
        const item = ITEM_MAP[line.item_id];
        if (!item) continue;
        value += Number(line.qty) * claimPerUnit(item, line.stage_index);
      }
      return { ...c, value };
    });
  }, [filtered, today]);

  const maxWeek = Math.max(1, ...weeks.map((w) => w.value));

  const locationName = useMemo(
    () => new Map(locations.map((l) => [l.id, l.name])),
    [locations],
  );

  const itemProgress = useMemo(() => {
    const map = new Map<
      string,
      {
        qty: number;
        full: number;
        claim: number;
        bySite: Map<string, { qty: number; full: number; claim: number }>;
      }
    >();
    for (const { line, day } of allLines) {
      const item = ITEM_MAP[line.item_id];
      if (!item || item.contract !== itemContract) continue;
      const cur = map.get(item.id) ?? { qty: 0, full: 0, claim: 0, bySite: new Map() };
      const qty = Number(line.qty);
      const full = qty * item.rate;
      const claim = qty * claimPerUnit(item, line.stage_index);
      const siteKey = day.location_id ?? "";
      const site = cur.bySite.get(siteKey) ?? { qty: 0, full: 0, claim: 0 };
      site.qty += qty;
      site.full += full;
      site.claim += claim;
      cur.bySite.set(siteKey, site);
      cur.qty += qty;
      cur.full += full;
      cur.claim += claim;
      map.set(item.id, cur);
    }
    return [...map.entries()]
      .map(([id, v]) => ({
        item: ITEM_MAP[id] as RateItem,
        ...v,
        sites: [...v.bySite.entries()]
          .map(([key, s]) => ({
            id: key || null,
            name: key ? locationName.get(key) ?? "Unknown site" : "All sites",
            ...s,
          }))
          .sort((a, b) => b.claim - a.claim),
      }))
      .sort((a, b) => b.claim - a.claim);
  }, [allLines, itemContract, locationName]);

  const itemClaimTotal = itemProgress.reduce((s, r) => s + r.claim, 0);
  const itemFullTotal = itemProgress.reduce((s, r) => s + r.full, 0);

  const siteSummary = useMemo(() => {
    const map = new Map<string, { qty: number; full: number; claim: number }>();
    for (const { line, day } of allLines) {
      const item = ITEM_MAP[line.item_id];
      if (!item || item.contract !== itemContract) continue;
      const key = day.location_id ?? "";
      const cur = map.get(key) ?? { qty: 0, full: 0, claim: 0 };
      const qty = Number(line.qty);
      cur.qty += qty;
      cur.full += qty * item.rate;
      cur.claim += qty * claimPerUnit(item, line.stage_index);
      map.set(key, cur);
    }
    return [...map.entries()]
      .map(([key, v]) => ({
        id: key || null,
        name: key ? locationName.get(key) ?? "Unknown site" : "All sites",
        ...v,
      }))
      .sort((a, b) => b.claim - a.claim);
  }, [allLines, itemContract, locationName]);

  const switchItemContract = (c: Contract) => {
    setItemContract(c);
    setShowAll(false);
    setExpandedItem(null);
  };

  const shown = showAll ? itemProgress : itemProgress.slice(0, 8);
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
                {nextBill ? `${nextBill.no} · ${nextBill.period}` : "Next RA bill"}
              </p>
              <p className="text-[10px] text-slate-400">
                {latestBill
                  ? `after ${latestBill.bill_no} · closed ${prettyDateLong(latestBill.period_end)}`
                  : "since start"}
              </p>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatINR2(bill.since)}</p>
            <p className="text-[11px] text-slate-500">work value since last bill</p>
            <div className="mt-3 space-y-1 text-xs">
              <Row label="GST 18%" value={formatINR2(bill.gst)} />
              <Row label="Gross" value={formatINR2(bill.gross)} strong />
              <Row label="Income tax 1%" value={`− ${formatINR2(bill.it)}`} />
              <Row label="Labour cess 1%" value={`− ${formatINR2(bill.cess)}`} />
              <Row label="GST TDS 2%" value={`− ${formatINR2(bill.gstTds)}`} />
              <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm">
                <span className="font-semibold text-slate-600">Net payable</span>
                <span className="font-bold text-brand-700">{formatINR2(bill.net)}</span>
              </div>
            </div>
            {hasBills ? (
              <p className="mt-2 text-[10px] text-slate-400">
                RA-01 baseline: {formatINR2(bill.baseline)} · cumulative claimed{" "}
                {formatINR2(bill.baseline + bill.since)}
              </p>
            ) : null}
          </Card>

          <Card className="p-3">
            <p className="text-sm font-bold text-slate-900">Claimable by period</p>
            <p className="text-[11px] text-slate-500">
              Last 8 periods · {filter === "ALL" ? "both contracts" : filter}
            </p>
            <div className="mt-3 flex items-end gap-1">
              {weeks.map((w, idx) => (
                <div key={w.from} className="flex flex-1 flex-col items-center gap-0.5">
                  <span className="text-[8px] font-semibold text-slate-600">
                    {formatLakh(w.value)}
                  </span>
                  <div
                    className={`w-full rounded-t ${
                      idx === weeks.length - 1 ? "bg-brand-600" : "bg-brand-200"
                    }`}
                    style={{ height: `${Math.max(2, (w.value / maxWeek) * 70)}px` }}
                    title={formatINR(w.value)}
                  />
                  <span className="text-center text-[8px] leading-tight text-slate-400">
                    {w.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              Each bar is 1–7, 8–14, 15–21, 22–28, 29–end of the month.
            </p>
            <p className="text-right text-[10px] text-slate-400">
              Highest period {formatLakh(maxWeek)}
            </p>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-3 pb-2 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Item progress
                </p>
                <p className="text-[10px] text-slate-400">{itemProgress.length} items</p>
              </div>
              <p className="text-[10px] text-slate-400">
                All work to date · claimed value by item and site
              </p>

              <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                {(
                  [
                    { id: "PE", label: "PE" },
                    { id: "LMC", label: "LMC" },
                  ] as { id: Contract; label: string }[]
                ).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => switchItemContract(c.id)}
                    className={`rounded-lg py-2 text-xs font-semibold ${
                      itemContract === c.id
                        ? "bg-white text-brand-700 shadow-sm"
                        : "text-slate-500"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Claimed across all sites · {itemContract}
                </p>
                <p className="text-2xl font-bold text-slate-900">{formatINR2(itemClaimTotal)}</p>
                <p className="text-[10px] text-slate-500">
                  of {formatINR2(itemFullTotal)} work value
                </p>
              </div>

              {siteSummary.length > 0 ? (
                <div className="mt-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    By site
                  </p>
                  <div className="space-y-1">
                    {siteSummary.map((s) => (
                      <div
                        key={s.id ?? "all"}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold text-slate-700">
                            {s.name}
                          </p>
                          <p className="text-[9px] text-slate-400">
                            {formatQty(s.qty)} qty
                          </p>
                        </div>
                        <p className="shrink-0 text-[11px] font-bold text-slate-900">
                          {formatINR(s.claim)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {itemProgress.length === 0 ? (
              <p className="border-t border-slate-100 p-4 text-center text-sm text-slate-400">
                No {itemContract} work logged yet.
              </p>
            ) : (
              <>
                <p className="border-t border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Items · tap for the site split
                </p>
                {shown.map((row) => {
                  const item = row.item;
                  const open = expandedItem === item.id;
                  const siteCount = row.sites.filter((s) => s.id !== null).length;
                  const hasAll = row.sites.some((s) => s.id === null);
                  const siteLabel = hasAll
                    ? siteCount > 0
                      ? `${siteCount} site${siteCount === 1 ? "" : "s"} + all sites`
                      : "All sites"
                    : `${siteCount} site${siteCount === 1 ? "" : "s"}`;
                  return (
                    <div key={item.id} className="border-t border-slate-100">
                      <button
                        onClick={() => setExpandedItem(open ? null : item.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left active:bg-slate-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-800">
                            {item.name}
                          </p>
                          <p className="truncate text-[9px] text-slate-400">{item.detail}</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {siteLabel} · {formatQty(row.qty)} {item.uom}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-bold text-slate-900">{formatINR(row.claim)}</p>
                          <p className="text-[9px] font-medium text-brand-700">
                            {open ? "hide sites" : "by site"}
                          </p>
                        </div>
                      </button>
                      {open ? (
                        <div className="bg-slate-50/70 px-3 pb-2">
                          {row.sites.map((s) => (
                            <div
                              key={s.id ?? "all"}
                              className="flex items-center justify-between gap-2 border-t border-slate-100 py-1.5 first:border-0"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[10px] font-semibold text-slate-700">
                                  {s.name}
                                </p>
                                <p className="text-[9px] text-slate-400">
                                  {formatQty(s.qty)} {item.uom}
                                </p>
                              </div>
                              <p className="shrink-0 text-[10px] font-semibold text-slate-800">
                                {formatINR(s.claim)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {itemProgress.length > 8 ? (
                  <button
                    onClick={() => setShowAll((v) => !v)}
                    className="w-full border-t border-slate-100 p-3 text-xs font-semibold text-brand-700"
                  >
                    {showAll ? "Show less" : `Show all ${itemProgress.length} items`}
                  </button>
                ) : null}
                <p className="border-t border-slate-100 px-3 py-2 text-[9px] text-slate-400">
                  “All sites” is work logged without a selected site (RA-01 baseline).
                </p>
              </>
            )}
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
