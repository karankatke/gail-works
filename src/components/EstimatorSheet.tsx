import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Modal, inputClass } from "./ui";
import { ItemSearchList } from "./RateBits";
import { EstimateLineModal } from "./EstimateLineModal";
import { ITEM_MAP, LMC_ITEMS, PE_ITEMS, type Contract, type RateItem } from "../lib/rates";
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
type SubMode = "per_meter" | "per_flat";

function toDraftLines(estimate: EstimateWithLines | null | undefined): DraftLine[] {
  return [...(estimate?.lines ?? [])]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
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
  const sub = Number(e.subcontract_rate) * Number(e.subcontract_qty);
  const other =
    sub +
    Number(e.drawing_cost ?? 0) +
    Number(e.conversion_cost ?? 0) +
    Number(e.misc_cost ?? 0);
  const cost =
    Number(e.material_cost ?? 0) + Number(e.crew_days) * Number(e.daily_labour_cost) + other;
  return { work, profit: work - cost };
}

const compactInput = `${inputClass} py-2 text-sm`;

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
  const [contract, setContract] = useState<Contract>(initialEstimate?.contract ?? initialContract);
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
  const [subMode, setSubMode] = useState<SubMode>(
    initialEstimate?.subcontract_mode ?? "per_meter",
  );
  const [subRate, setSubRate] = useState(
    initialEstimate && Number(initialEstimate.subcontract_rate)
      ? String(initialEstimate.subcontract_rate)
      : "",
  );
  const [subQty, setSubQty] = useState(
    initialEstimate && Number(initialEstimate.subcontract_qty)
      ? String(initialEstimate.subcontract_qty)
      : "",
  );
  const [drawingCost, setDrawingCost] = useState(
    initialEstimate && Number(initialEstimate.drawing_cost)
      ? String(initialEstimate.drawing_cost)
      : "",
  );
  const [conversionCost, setConversionCost] = useState(
    initialEstimate && Number(initialEstimate.conversion_cost)
      ? String(initialEstimate.conversion_cost)
      : "",
  );
  const [miscCost, setMiscCost] = useState(
    initialEstimate && Number(initialEstimate.misc_cost) ? String(initialEstimate.misc_cost) : "",
  );
  const [note, setNote] = useState(initialEstimate?.note ?? "");
  const [lines, setLines] = useState<DraftLine[]>(() => toDraftLines(initialEstimate));

  const [saved, setSaved] = useState<EstimateWithLines[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [labourAvg, setLabourAvg] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [pendingItem, setPendingItem] = useState<RateItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const itemScrollRef = useRef(0);
  const itemListRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!adding) return;
    const el = itemListRef.current;
    if (el) el.scrollTop = itemScrollRef.current;
  }, [adding]);

  const workValue = useMemo(() => lines.reduce((s, l) => s + l.qty * l.rate, 0), [lines]);
  const material = Number(materialCost) || 0;
  const days = Number(crewDays) || 0;
  const daily = Number(dailyLabourCost) || 0;
  const labour = days * daily;
  const sub = (Number(subRate) || 0) * (Number(subQty) || 0);
  const drawing = Number(drawingCost) || 0;
  const conversion = Number(conversionCost) || 0;
  const misc = Number(miscCost) || 0;
  const other = sub + drawing + conversion + misc;
  const totalCost = material + labour + other;
  const profit = workValue - totalCost;
  const margin = workValue > 0 ? profit / workValue : 0;
  const canSwitchContract = lines.length === 0 && !estimateId;

  const reset = () => {
    setTab("new");
    setEstimateId(null);
    setName("");
    setLocationId("");
    setMaterialCost("");
    setCrewDays("");
    setSubMode("per_meter");
    setSubRate("");
    setSubQty("");
    setDrawingCost("");
    setConversionCost("");
    setMiscCost("");
    setNote("");
    setLines([]);
    setContract(initialContract);
    setAdding(false);
    setPendingItem(null);
    setEditingIndex(null);
    setItemQuery("");
    itemScrollRef.current = 0;
    setSavedMsg(null);
    setError(null);
  };

  const openSaved = (e: EstimateWithLines) => {
    setTab("new");
    setEstimateId(e.id);
    setName(e.name);
    setContract(e.contract);
    setLocationId(e.location_id ?? "");
    setMaterialCost(e.material_cost ? String(e.material_cost) : "");
    setCrewDays(e.crew_days ? String(e.crew_days) : "");
    setDailyLabourCost(e.daily_labour_cost ? String(e.daily_labour_cost) : "");
    setSubMode(e.subcontract_mode ?? "per_meter");
    setSubRate(e.subcontract_rate ? String(e.subcontract_rate) : "");
    setSubQty(e.subcontract_qty ? String(e.subcontract_qty) : "");
    setDrawingCost(e.drawing_cost ? String(e.drawing_cost) : "");
    setConversionCost(e.conversion_cost ? String(e.conversion_cost) : "");
    setMiscCost(e.misc_cost ? String(e.misc_cost) : "");
    setNote(e.note ?? "");
    setLines(toDraftLines(e));
    setAdding(false);
    setPendingItem(null);
    setEditingIndex(null);
    setItemQuery("");
    itemScrollRef.current = 0;
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
      setLines((prev) => prev.map((l, i) => (i === editingIndex ? { ...l, qty, inputText } : l)));
    } else {
      setLines((prev) => [
        { item: pendingItem, qty, inputText, rate: pendingItem.rate },
        ...prev,
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
        subcontract_mode: subMode,
        subcontract_rate: Number(subRate) || 0,
        subcontract_qty: Number(subQty) || 0,
        drawing_cost: drawing,
        conversion_cost: conversion,
        misc_cost: misc,
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
    <Modal title="Estimate" onClose={onClose} wide>
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
            <div className="grid gap-2 lg:grid-cols-3">
              <div className="lg:col-span-1">
                {canSwitchContract ? (
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                    {(["PE", "LMC"] as Contract[]).map((c) => (
                      <button
                        key={c}
                        onClick={() => setContract(c)}
                        className={`rounded-lg py-2 text-xs font-semibold ${
                          contract === c
                            ? "bg-white text-brand-700 shadow-sm"
                            : "text-slate-500"
                        }`}
                      >
                        {c === "PE" ? "PE pipe laying" : "LMC"}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-brand-700">
                    {contract === "PE" ? "PE pipe laying" : "LMC"}
                  </p>
                )}
              </div>
              <label className="block lg:col-span-2">
                <span className="mb-1 block text-xs font-medium text-slate-600">Estimate name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Arvind Sporcia - 40 flats"
                />
              </label>
              <label className="block lg:col-span-3">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Site (optional)
                </span>
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
            </div>

            <div className="rounded-2xl bg-slate-900 p-4 text-white">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Claimable at completion · excl. GST
                  </p>
                  <p className="text-3xl font-bold">{formatINR(workValue)}</p>
                  <p className="text-[9px] text-slate-400">
                    Bill incl. 18% GST {formatINR(workValue * 1.18)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Estimated profit
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      profit >= 0 ? "text-emerald-300" : "text-red-300"
                    }`}
                  >
                    {formatINR(profit)}
                  </p>
                  <p className="text-[9px] text-slate-400">
                    Margin {workValue > 0 ? `${Math.round(margin * 100)}%` : "—"}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-2 text-[10px] text-slate-400 sm:grid-cols-4">
                <div>
                  Material <b className="text-white">{formatINR(material)}</b>
                </div>
                <div>
                  Labour <b className="text-white">{formatINR(labour)}</b>
                </div>
                <div>
                  Other <b className="text-white">{formatINR(other)}</b>
                </div>
                <div>
                  Total cost <b className="text-white">{formatINR(totalCost)}</b>
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Items ({lines.length})
                  </p>
                </div>

                {!adding ? (
                  <Button onClick={() => setAdding(true)} className="w-full py-3 text-sm">
                    + Add items
                  </Button>
                ) : (
                  <div className="rounded-xl border border-slate-200 p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-slate-600">Add items</p>
                      <button
                        onClick={() => setAdding(false)}
                        className="text-[10px] font-semibold text-brand-700"
                      >
                        Done adding
                      </button>
                    </div>
                    <div
                      ref={itemListRef}
                      onScroll={(e) => {
                        itemScrollRef.current = e.currentTarget.scrollTop;
                      }}
                      className="max-h-72 overflow-y-auto"
                    >
                      <ItemSearchList
                        items={contract === "PE" ? PE_ITEMS : LMC_ITEMS}
                        query={itemQuery}
                        onQueryChange={(q) => {
                          setItemQuery(q);
                          itemScrollRef.current = 0;
                          if (itemListRef.current) itemListRef.current.scrollTop = 0;
                        }}
                        onPick={(item) => {
                          setAdding(false);
                          openLine(item);
                        }}
                      />
                    </div>
                  </div>
                )}

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
                        <button
                          onClick={() => openLine(l.item)}
                          className="min-w-0 flex-1 text-left"
                        >
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
                            onClick={() =>
                              setLines((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-[10px] font-medium text-red-500"
                          >
                            remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-2.5 rounded-2xl border border-slate-100 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Costs</p>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium text-slate-500">
                      Material cost (₹)
                    </span>
                    <input
                      inputMode="decimal"
                      value={materialCost}
                      onChange={(e) => setMaterialCost(e.target.value)}
                      className={compactInput}
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
                        className={compactInput}
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
                        className={compactInput}
                        placeholder="0"
                      />
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {labourAvg
                      ? `Daily labour prefilled from the last 7 days: ${formatINR(labourAvg)}.`
                      : "Enter the crew cost per day."}{" "}
                    Labour total {formatINR(labour)}.
                  </p>

                  <div className="border-t border-slate-100 pt-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-slate-600">Subcontract</p>
                      <p className="text-[11px] font-semibold text-slate-900">{formatINR(sub)}</p>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                      {(
                        [
                          { id: "per_meter" as const, label: "Per metre" },
                          { id: "per_flat" as const, label: "Per flat" },
                        ]
                      ).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setSubMode(m.id)}
                          className={`rounded-md py-1.5 text-[10px] font-semibold ${
                            subMode === m.id
                              ? "bg-white text-brand-700 shadow-sm"
                              : "text-slate-500"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-medium text-slate-500">
                          {subMode === "per_meter" ? "Rate (₹/m)" : "Rate (₹/flat)"}
                        </span>
                        <input
                          inputMode="decimal"
                          value={subRate}
                          onChange={(e) => setSubRate(e.target.value)}
                          className={compactInput}
                          placeholder="0"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-medium text-slate-500">
                          {subMode === "per_meter" ? "Metres" : "Flats"}
                        </span>
                        <input
                          inputMode="decimal"
                          value={subQty}
                          onChange={(e) => setSubQty(e.target.value)}
                          className={compactInput}
                          placeholder="0"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-medium text-slate-500">
                        Drawings (₹)
                      </span>
                      <input
                        inputMode="decimal"
                        value={drawingCost}
                        onChange={(e) => setDrawingCost(e.target.value)}
                        className={compactInput}
                        placeholder="0"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-medium text-slate-500">
                        Conversion (₹)
                      </span>
                      <input
                        inputMode="decimal"
                        value={conversionCost}
                        onChange={(e) => setConversionCost(e.target.value)}
                        className={compactInput}
                        placeholder="0"
                      />
                    </label>
                    <label className="col-span-2 block">
                      <span className="mb-1 block text-[10px] font-medium text-slate-500">
                        Miscellaneous (₹)
                      </span>
                      <input
                        inputMode="decimal"
                        value={miscCost}
                        onChange={(e) => setMiscCost(e.target.value)}
                        className={compactInput}
                        placeholder="0"
                      />
                    </label>
                  </div>

                  <div className="flex justify-between border-t border-slate-100 pt-2 text-xs">
                    <span className="text-slate-500">Total cost</span>
                    <span className="font-bold text-slate-900">{formatINR(totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Estimated profit</span>
                    <span
                      className={`font-bold ${
                        profit >= 0 ? "text-emerald-700" : "text-red-600"
                      }`}
                    >
                      {formatINR(profit)}
                    </span>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    Note (optional)
                  </span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className={inputClass}
                    placeholder="optional"
                  />
                </label>

                {error ? (
                  <p className="rounded-xl bg-red-50 p-2 text-xs text-red-700">{error}</p>
                ) : null}
                {savedMsg ? (
                  <p className="text-xs font-medium text-emerald-700">{savedMsg}</p>
                ) : null}

                <Button onClick={save} disabled={saving} className="w-full py-3">
                  {saving ? "Saving…" : estimateId ? "Update estimate" : "Save estimate"}
                </Button>
                {estimateId ? (
                  <Button variant="secondary" onClick={reset} className="w-full">
                    Start a new estimate
                  </Button>
                ) : null}
              </div>
            </div>
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
