import { useMemo, useState } from "react";
import { Button, Modal, inputClass } from "./ui";
import { claimPct, claimPerUnit, itemSearchText, stageRates, type RateItem } from "../lib/rates";
import { formatQty, formatRate } from "../lib/format";

export function ItemPicker({
  items,
  onPick,
  onClose,
  title = "Pick work item",
}: {
  items: RateItem[];
  onPick: (item: RateItem) => void;
  onClose: () => void;
  title?: string;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => itemSearchText(i).includes(needle));
  }, [items, q]);

  return (
    <Modal title={title} onClose={onClose} full>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search: 32, 1 inch, meter, valve…"
        className={`${inputClass} mb-3 py-2 text-sm`}
        autoFocus
      />
      <div className="space-y-1.5">
        {list.map((i) => (
          <button
            key={i.id}
            onClick={() => onPick(i)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-left active:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{i.name}</p>
              <p className="truncate text-xs text-slate-500">
                {i.code} · {i.detail}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-slate-900">{formatRate(i.rate)}</p>
              <p className="text-[10px] text-slate-400">per {i.uom}</p>
            </div>
          </button>
        ))}
        {list.length === 0 ? (
          <p className="p-4 text-center text-sm text-slate-400">No item matches that search.</p>
        ) : null}
      </div>
    </Modal>
  );
}

export function ItemDetail({ item, onClose }: { item: RateItem; onClose: () => void }) {
  return (
    <Modal title={item.name} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            {item.contract} · SOR {item.code}
          </p>
          <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
        </div>

        {item.official ? (
          <div className="rounded-2xl border border-slate-100 p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Description
            </p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {item.official}
            </p>
          </div>
        ) : null}

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-medium text-slate-400">Full rate (excl. GST)</p>
          <p className="text-3xl font-bold text-slate-900">
            {formatRate(item.rate)}
            <span className="ml-1 text-sm font-normal text-slate-400">/ {item.uom}</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Contract target: {formatQty(item.loaQty)} {item.uom}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Claim stages
          </p>
          <div className="space-y-1.5">
            {stageRates(item).map((stageRate, idx) => {
              const s = item.stages[idx];
              return (
                <div key={`${s.label}-${idx}`} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    {s.label} <span className="text-slate-400">({Math.round(s.pct * 100)}%)</span>
                  </span>
                  <span className="font-semibold text-slate-900">{formatRate(stageRate)}</span>
                </div>
              );
            })}
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
              <span className="font-medium text-slate-500">Cumulative claim</span>
              <span className="font-bold text-slate-900">
                {formatRate(claimPerUnit(item, item.stages.length - 1))}
              </span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          Final LOA rate. GST is added separately on the bill. The SOR sheet quantities are only
          examples; LOA quantities are the contract targets.
        </p>
      </div>
    </Modal>
  );
}

export function RateRow({ item, onClick }: { item: RateItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 border-b border-slate-50 px-3 py-2.5 text-left last:border-0 active:bg-slate-50"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
        <p className="truncate text-[11px] text-slate-500">{item.detail}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-slate-900">{formatRate(item.rate)}</p>
        <p className="text-[10px] text-slate-400">per {item.uom}</p>
      </div>
    </button>
  );
}

export function AddLineModal({
  item,
  onAdd,
  onClose,
}: {
  item: RateItem;
  onAdd: (qty: number, stageIndex: number) => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState("");
  const [stageIndex, setStageIndex] = useState(0);
  const q = Number(qty);
  const valid = Number.isFinite(q) && q > 0;
  const pct = claimPct(item.stages, stageIndex);

  return (
    <Modal title={`Add ${item.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Rate</span>
            <span className="font-semibold">{formatRate(item.rate)} / {item.uom}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-slate-500">{item.detail}</span>
            <span className="text-xs text-slate-400">LOA {formatQty(item.loaQty)}</span>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Quantity ({item.uom})</span>
          <input
            inputMode="decimal"
            autoFocus
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
            className={`${inputClass} text-2xl font-bold`}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Stage reached</span>
          <select
            value={stageIndex}
            onChange={(e) => setStageIndex(Number(e.target.value))}
            className={inputClass}
          >
            {item.stages.map((s, idx) => (
              <option key={`${s.label}-${idx}`} value={idx}>
                {s.label} — {Math.round(claimPct(item.stages, idx) * 100)}% claimable
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-xl bg-brand-50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-800">Work value (100%)</span>
            <span className="font-semibold text-brand-900">
              {valid ? formatRate(q * item.rate) : "—"}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-brand-800">Claimable now ({Math.round(pct * 100)}%)</span>
            <span className="font-bold text-brand-900">
              {valid ? formatRate(q * claimPerUnit(item, stageIndex)) : "—"}
            </span>
          </div>
        </div>

        <Button
          onClick={() => onAdd(q, stageIndex)}
          disabled={!valid}
          className="w-full py-3"
        >
          Add to day
        </Button>
      </div>
    </Modal>
  );
}
