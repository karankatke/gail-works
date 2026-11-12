import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Modal, inputClass } from "./ui";
import { ItemSearchList } from "./RateBits";
import { EstimateLineModal } from "./EstimateLineModal";
import {
  ITEM_MAP,
  LMC_ITEMS,
  PE_ITEMS,
  type Contract,
  type RateItem,
} from "../lib/rates";
import { formatINR, formatINR2, formatQty, formatRate } from "../lib/format";
import { addDays, prettyDate, todayISO } from "../lib/dates";
import {
  deleteEstimate,
  fetchEstimates,
  fetchLabour,
  fetchLocations,
  saveEstimate,
} from "../lib/work";
import type { EstimateWithLines, LocationRow } from "../lib/types";

type DraftLine = { item: RateItem; qty: number; inputText: string; rate: number };

function toDraftLines(estimate: EstimateWithLines | null | undefined): DraftLine[] {
  return (estimate?.lines ?? [])
    .map((l) => {
      const item = ITEM_MAP[l.item_id];
      if (!item) return null;
      return {
        item,
        qty: Number(l.qty),
        inputText: l.input_text ?? `${l.qty} ${l.uom}`,
        rate: Number(l.rate),
      };
    })
    .filter((x): x is DraftLine => Boolean(x));
}

function estimateTotals(e: EstimateWithLines) {
  const work = e.lines.reduce((s, l) => s + Number(l.qty) * Number(l.rate), 0);
  const labour = Number(e.crew_days) * Number(e.daily_labour_cost);
  return { work, profit: work - Number(e.material_cost) - labour };
}

export function EstimatorSheet({
  initialContract,
  initialEstimate,
  initialTab = "new",
  onClose,
  onSaved,
}: {
  initialContract: Contract;
  initialEstimate?: EstimateWithLines | null;
  initialTab?: "new" | "saved";
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [tab, setTab] = useState<"new" | "saved">(initialEstimate ? "new" : initialTab);
  const [contract, setContract] = useState<Contract>(
    initialEstimate?.contract ?? initialContract,
  );
  const [estimateId, setEstimateId] = useState<string | null>(initialEstimate?.id ?? null);
  const [name, setName] = useState(initialEstimate?.name ?? "");
  const [locationId, setLocationId] = useState(initialEstimate?.location_id ?? "");
  const [materialCost, setMaterialCost] = useState(
    initialEstimate ? String(initialEstimate.material_cost ?? "") : "",
  );
  const [crewDays, setCrewDays] = useState(
    initialEstimate ? String(initialEstimate.crew_days ?? "") : "",
  );
  const [dailyLabourCost, setDailyLabourCost] = useState(
    initialEstimate ? String(initialEstimate.daily_labour_cost ?? "") : "",
  );
  const [note, setNote] = useState(initialEstimate?.note ?? "");
  const [lines, setLines] = useState<DraftLine[]>(() => toDraftLines(initialEstimate));

  const [saved, setSaved] = useState<EstimateWithLines[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [labourAvg, setLabourAvg] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [pendingItem, setPendingItem] = useState<RateItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const loadSaved = useCallback(async () => {
    try {
      setSaved(await fetchEstimates());
    } catch {
      // keep the sheet usable
    }
  }, []);

  useEffect(() => {
    void loadSaved();
    fetchLocations().then(setLocations).catch(() => undefined);
  }, [loadSaved]);

  useEffect(() => {
    if (initialEstimate) return;
    let active = true;
    const to = todayISO();
    const from = addDays(to, -6);
    fetchLabour(from, to)
      .then((l) => {
        if (!active) return;
        const avg = Math.round(l.total / 7);
        if (avg > 0) {
          setLabourAvg(avg);
          setDailyLabourCost((cur) => (cur.trim() === "" ? String(avg) : cur));
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [initialEstimate]);

  const workValue = useMemo(
    () => lines.reduce((s, l) => s + l.qty * l.rate, 0),
    [lines],
  );
  const material = Number(materialCost) || 0;
  const days = Number(crewDays) || 0;
  const daily = Number(dailyLabourCost) || 0;
  const labour = days * daily;
  const profit = workValue - material - labour;
  const margin = workValue > 0 ? profit / workValue : 0;
  const canSwitchContract = lines.length === 0 && !estimateId;

  const reset = () => {
    setTab("new");
    setEstimateId(null);
    setName("");
    setLocationId("");
    setMaterialCost("");
    setCrewDays("");
    setNote("");
    setLines([]);
    setContract(initialContract);
    setAdding(false);
    setPendingItem(null);
    setEditingIndex(null);
    setSavedMsg(null);
    setError(null);
  };

  const openSaved = (e: EstimateWithLines) => {
    setTab("new");
    setEstimateId(e.id);
    setName(e.name);
    setContract(e.contract);
    setLocationId(e.location_id ?? "");
    setMaterialCost(String(e.material_cost ?? ""));
    setCrewDays(String(e.crew_days ?? ""));
    setDailyLabourCost(String(e.daily_labour_cost ?? ""));
    setNote(e.note ?? "");
    setLines(toDraftLines(e));
    setAdding(false);
    setPendingItem(null);
    setEditingIndex(null);
    setSavedMsg(null);
    setError(null);
  };

  const removeSaved = async (id: string) => {
    if (!window.confirm("Delete this estimate?")) return;
    try {
      await deleteEstimate(id);
      if (estimateId === id) reset();
      await loadSaved();
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  };

  const openLine = (item: RateItem) => {
    const idx = lines.findIndex((l) => l.item.id === item.id);
    setEditingIndex(idx >= 0 ? idx : null);
    setPendingItem(item);
  };

  const saveLine = (qty: number, inputText: string) => {
    if (!pendingItem) return;
    if (editingIndex != null) {
      setLines((prev) =>
        prev.map((l, i) => (i === editingIndex ? { ...l, qty, inputText } : l)),
      );
    } else {
      setLines((prev) => [
        ...prev,
        { item: pendingItem, qty, inputText, rate: pendingItem.rate },
      ]);
    }
    setPendingItem(null);
    setEditingIndex(null);
  };

  const save = async () => {
    if (!name.trim()) {
      setError("Give this estimate a name.");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one item.");
      return;
    }
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const id = await saveEstimate({
        id: estimateId,
        name: name.trim(),
        contract,
        location_id: locationId || null,
        material_cost: material,
        crew_days: days,
        daily_labour_cost: daily,
        note: note.trim() || null,
        lines: lines.map((l) => ({
          item_id: l.item.id,
          qty: l.qty,
          uom: l.item.uom,
          rate: l.rate,
          input_text: l.inputText || null,
        })),
      });
      setEstimateId(id);
      setSavedMsg("Estimate saved.");
      await loadSaved();
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the estimate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Estimate" onClose={onClose} full>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setTab("new")}
            className={`rounded-lg py-2 text-sm font-semibold ${
              tab === "new" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
            }`}
          >
            New estimate
          </button>
          <button
            onClick={() => setTab("saved")}
            className={`rounded-lg py-2 text-sm font-semibold ${
              tab === "saved" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
            }`}
          >
            Saved ({saved.length})
          </button>
        </div>

        {tab === "saved" ? (
          <>
            <Button onClick={reset} className="w-full">
              + New estimate
            </Button>
            {saved.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400">
                No saved estimates yet.
              </p>
            ) : (
              <div className="space-y-2">
                {saved.map((e) => {
                  const t = estimateTotals(e);
                  return (
                    <div
                      key={e.id}
                      className="flex items-center gap-2 rounded-xl border border-slate-100 p-3"
                    >
                      <button onClick={() => openSaved(e)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-semibold text-slate-900">{e.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {e.contract} · {prettyDate(e.updated_at.slice(0, 10))}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Value {formatINR(t.work)} ·{" "}
                          <span className={t.profit >= 0 ? "text-emerald-700" : "text-red-600"}>
                            profit {formatINR(t.profit)}
                          </span>
                        </p>
                      </button>
                      <button
                        onClick={() => removeSaved(e.id)}
                        className="shrink-0 text-[10px] font-medium text-red-500"
                      >
                        remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {canSwitchContract ? (
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                {(["PE", "LMC"] as Contract[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setContract(c)}
                    className={`rounded-lg py-2 text-xs font-semibold ${
                      contract === c ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {c === "PE" ? "PE pipe laying" : "LMC"}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs font-semibold text-brand-700">
                {contract === "PE" ? "PE pipe laying" : "LMC"}
              </p>
            )}

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Estimate name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Arvind Sporcia - 40 flats"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Site (optional)</span>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className={inputClass}
              >
                <option value="">No site</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-2xl bg-slate-900 p-4 text-white">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Claimable at completion · excl. GST
              </p>
              <p className="text-3xl font-bold">{formatINR(workValue)}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] text-slate-400">Material</p>
                  <p className="text-sm font-semibold">{formatINR(material)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400">Labour</p>
                  <p className="text-sm font-semibold">{formatINR(labour)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400">Profit</p>
                  <p
                    className={`text-sm font-semibold ${
                      profit >= 0 ? "text-emerald-300" : "text-red-300"
                    }`}
                  >
                    {formatINR(profit)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400">
                <span>Margin {workValue > 0 ? `${Math.round(margin * 100)}%` : "—"}</span>
                <span>Bill incl. 18% GST {formatINR(workValue * 1.18)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Items ({lines.length})
              </p>
              {!adding ? (
                <button
                  onClick={() => setAdding(true)}
                  className="text-[11px] font-semibold text-brand-700"
                >
                  + Add items
                </button>
              ) : null}
            </div>

            {adding ? (
              <div className="rounded-xl border border-slate-200 p-2">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-slate-600">Add items</p>
                  <button
                    onClick={() => setAdding(false)}
                    className="text-[10px] font-medium text-slate-400"
                  >
                    cancel
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <ItemSearchList
                    items={contract === "PE" ? PE_ITEMS : LMC_ITEMS}
                    onPick={(item) => {
                      setAdding(false);
                      openLine(item);
                    }}
                  />
                </div>
              </div>
            ) : null}

            {lines.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-400">
                No items yet. Tap Add items.
              </p>
            ) : (
              <div className="rounded-xl border border-slate-100">
                {lines.map((l, idx) => (
                  <div
                    key={`${l.item.id}-${idx}`}
                    className="flex items-center justify-between gap-2 border-b border-slate-50 px-3 py-2 last:border-0"
                  >
                    <button onClick={() => openLine(l.item)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-xs font-semibold text-slate-800">
                        {l.item.name}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {formatQty(l.qty)} {l.item.uom} · {formatRate(l.rate)} / {l.item.uom}
                      </p>
                      {l.inputText ? (
                        <p className="truncate text-[10px] text-slate-400">
                          Entered: {l.inputText}
                        </p>
                      ) : null}
                    </button>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-bold text-slate-900">
                        {formatINR2(l.qty * l.rate)}
                      </p>
                      <button
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-[10px] font-medium text-red-500"
                      >
                        remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 rounded-2xl border border-slate-100 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Costs</p>
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-slate-500">
                  Material cost (₹)
                </span>
                <input
                  inputMode="decimal"
                  value={materialCost}
                  onChange={(e) => setMaterialCost(e.target.value)}
                  className={inputClass}
                  placeholder="0"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium text-slate-500">
                    Crew days
                  </span>
                  <input
                    inputMode="decimal"
                    value={crewDays}
                    onChange={(e) => setCrewDays(e.target.value)}
                    className={inputClass}
                    placeholder="0"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium text-slate-500">
                    Daily labour (₹)
                  </span>
                  <input
                    inputMode="decimal"
                    value={dailyLabourCost}
                    onChange={(e) => setDailyLabourCost(e.target.value)}
                    className={inputClass}
                    placeholder="0"
                  />
                </label>
              </div>
              <p className="text-[10px] text-slate-400">
                {labourAvg
                  ? `Daily labour prefilled from the last 7 days (wages + bata): ${formatINR(labourAvg)}. Change it for a different crew.`
                  : "Enter the crew cost per day."}
              </p>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-xs">
                <span className="text-slate-500">Labour total</span>
                <span className="font-semibold text-slate-900">{formatINR(labour)}</span>
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Note (optional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={inputClass}
                placeholder="optional"
              />
            </label>

            {error ? <p className="rounded-xl bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}
            {savedMsg ? <p className="text-xs font-medium text-emerald-700">{savedMsg}</p> : null}

            <Button onClick={save} disabled={saving} className="w-full py-3">
              {saving ? "Saving…" : estimateId ? "Update estimate" : "Save estimate"}
            </Button>
            {estimateId ? (
              <Button variant="secondary" onClick={reset} className="w-full">
                Start a new estimate
              </Button>
            ) : null}
          </>
        )}

        {pendingItem ? (
          <EstimateLineModal
            item={pendingItem}
            initialQty={editingIndex != null ? lines[editingIndex]?.qty : undefined}
            onSave={saveLine}
            onClose={() => {
              setPendingItem(null);
              setEditingIndex(null);
            }}
          />
        ) : null}
      </div>
    </Modal>
  );
}
