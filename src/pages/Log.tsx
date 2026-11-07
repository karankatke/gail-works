import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Empty, Modal, Spinner, inputClass } from "../components/ui";
import { AddLineModal, ItemPicker } from "../components/RateBits";
import { LMC_ITEMS, PE_ITEMS, ITEM_MAP, claimPct, claimPerUnit, type Contract, type RateItem } from "../lib/rates";
import { formatINR, formatQty } from "../lib/format";
import { prettyDate, todayISO } from "../lib/dates";
import { deleteWorkDay, fetchLocations, fetchWork, saveWorkDay } from "../lib/work";
import type { DayWithLines, LocationRow } from "../lib/types";

type DraftLine = { item: RateItem; qty: number; stageIndex: number };

export function LogPage() {
  const [days, setDays] = useState<DayWithLines[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(todayISO());
  const [contract, setContract] = useState<Contract>("PE");
  const [locationId, setLocationId] = useState("");
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [picker, setPicker] = useState(false);
  const [pendingItem, setPendingItem] = useState<RateItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewDay, setViewDay] = useState<DayWithLines | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, l] = await Promise.all([fetchWork(), fetchLocations()]);
      setDays(d);
      setLocations(l);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load work");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items = contract === "PE" ? PE_ITEMS : LMC_ITEMS;

  const totals = useMemo(() => {
    let full = 0;
    let claim = 0;
    for (const l of draft) {
      full += l.qty * l.item.rate;
      claim += l.qty * claimPerUnit(l.item, l.stageIndex);
    }
    return { full, claim };
  }, [draft]);

  const switchContract = (c: Contract) => {
    if (c === contract) return;
    setContract(c);
    setDraft([]);
  };

  const addLine = (qty: number, stageIndex: number) => {
    if (!pendingItem) return;
    setDraft((prev) => [...prev, { item: pendingItem, qty, stageIndex }]);
    setPendingItem(null);
  };

  const save = async () => {
    if (draft.length === 0) {
      setError("Add at least one work item.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveWorkDay({
        work_date: date,
        contract,
        location_id: locationId || null,
        note: null,
        lines: draft.map((l) => ({
          item_id: l.item.id,
          qty: l.qty,
          stage_index: l.stageIndex,
          note: null,
        })),
      });
      setDraft([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const removeDay = async (id: string) => {
    if (!window.confirm("Delete this work day and all its lines?")) return;
    try {
      await deleteWorkDay(id);
      setViewDay(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  };

  const locationName = (id: string | null) =>
    id ? locations.find((l) => l.id === id)?.name ?? "Site" : "All sites";

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {(["PE", "LMC"] as Contract[]).map((c) => (
            <button
              key={c}
              onClick={() => switchContract(c)}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                contract === c ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
              }`}
            >
              {c === "PE" ? "PE pipe laying" : "LMC"}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Work date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputClass} py-2 text-sm`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Site</span>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className={`${inputClass} py-2 text-sm`}
            >
              <option value="">All sites</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Button
          variant="secondary"
          onClick={() => setPicker(true)}
          className="mt-3 w-full"
        >
          + Add work item
        </Button>
      </Card>

      {draft.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              This day
            </p>
            <p className="text-[10px] text-slate-400">{prettyDate(date)}</p>
          </div>
          {draft.map((l, idx) => {
            const pct = claimPct(l.item.stages, l.stageIndex);
            return (
              <div
                key={`${l.item.id}-${idx}`}
                className="flex items-center justify-between gap-2 border-t border-slate-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{l.item.name}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {formatQty(l.qty)} {l.item.uom} · {l.item.stages[l.stageIndex]?.label ?? "—"} ·{" "}
                    {Math.round(pct * 100)}%
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {formatINR(l.qty * claimPerUnit(l.item, l.stageIndex))}
                  </p>
                  <button
                    onClick={() => setDraft((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-[10px] font-medium text-red-500"
                  >
                    remove
                  </button>
                </div>
              </div>
            );
          })}
          <div className="border-t border-slate-100 bg-slate-50 px-3 py-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Work value</span>
              <span className="font-semibold text-slate-800">{formatINR(totals.full)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-slate-500">Claimable now</span>
              <span className="font-bold text-brand-700">{formatINR(totals.claim)}</span>
            </div>
          </div>
          <div className="p-3">
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? "Saving…" : "Save this day"}
            </Button>
          </div>
        </Card>
      ) : null}

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div>
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Recent entries
        </p>
        {loading ? (
          <Spinner />
        ) : days.length === 0 ? (
          <Empty title="No work logged yet" hint="Add the first day above." />
        ) : (
          <div className="space-y-2">
            {days.slice(0, 25).map((d) => {
              let claim = 0;
              for (const line of d.lines) {
                const item = ITEM_MAP[line.item_id];
                if (item) claim += Number(line.qty) * claimPerUnit(item, line.stage_index);
              }
              const baseline = (d.note ?? "").toLowerCase().includes("ra-01");
              return (
                <Card key={d.id} className="p-0">
                  <button
                    onClick={() => setViewDay(d)}
                    className="flex w-full items-center justify-between gap-2 p-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {prettyDate(d.work_date)}
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          {d.contract}
                        </span>
                        {baseline ? (
                          <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            RA-01
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {locationName(d.location_id)} · {d.lines.length} line
                        {d.lines.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-slate-900">{formatINR(claim)}</p>
                      <p className="text-[10px] text-slate-400">claimable</p>
                    </div>
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {picker ? (
        <ItemPicker
          items={items}
          onPick={(item) => {
            setPicker(false);
            setPendingItem(item);
          }}
          onClose={() => setPicker(false)}
        />
      ) : null}

      {pendingItem ? (
        <AddLineModal item={pendingItem} onAdd={addLine} onClose={() => setPendingItem(null)} />
      ) : null}

      {viewDay ? (
        <Modal title={prettyDate(viewDay.work_date)} onClose={() => setViewDay(null)}>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{viewDay.contract} · {locationName(viewDay.location_id)}</span>
              <span className="text-slate-400">{viewDay.lines.length} lines</span>
            </div>
            <div className="divide-y divide-slate-100 rounded-xl bg-slate-50">
              {viewDay.lines.map((line) => {
                const item = ITEM_MAP[line.item_id];
                if (!item) return null;
                return (
                  <div key={line.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{item.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {formatQty(line.qty)} {item.uom} · {item.stages[line.stage_index]?.label}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold text-slate-900">
                      {formatINR(Number(line.qty) * claimPerUnit(item, line.stage_index))}
                    </p>
                  </div>
                );
              })}
            </div>
            <Button
              variant="danger"
              onClick={() => removeDay(viewDay.id)}
              className="w-full"
            >
              Delete this day
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
