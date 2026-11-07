import { useMemo, useState } from "react";
import { Button, Modal, inputClass } from "./ui";
import { claimPct, claimPerUnit, itemSearchText, stageRates, type RateItem } from "../lib/rates";
import { formatINR2, formatQty, formatRate } from "../lib/format";
import { FT2_TO_M2, FT3_TO_M3, formatFtIn, ftInToM, round3 } from "../lib/units";

export function ItemSearchList({
  items,
  onPick,
}: {
  items: RateItem[];
  onPick: (item: RateItem) => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => itemSearchText(i).includes(needle));
  }, [items, q]);

  return (
    <div>
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
    </div>
  );
}

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
  return (
    <Modal title={title} onClose={onClose} full>
      <ItemSearchList items={items} onPick={onPick} />
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

function FtInRow({
  label,
  ft,
  inch,
  onFt,
  onIn,
}: {
  label: string;
  ft: string;
  inch: string;
  onFt: (v: string) => void;
  onIn: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="block">
        <span className="mb-1 block text-[10px] font-medium text-slate-500">{label} — feet</span>
        <input
          inputMode="decimal"
          value={ft}
          onChange={(e) => onFt(e.target.value)}
          placeholder="0"
          className={`${inputClass} py-2 text-center text-lg font-semibold`}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] font-medium text-slate-500">inches</span>
        <input
          inputMode="decimal"
          value={inch}
          onChange={(e) => onIn(e.target.value)}
          placeholder="0"
          className={`${inputClass} py-2 text-center text-lg font-semibold`}
        />
      </label>
    </div>
  );
}

export function AddLineModal({
  item,
  onAdd,
  onClose,
  defaultStageIndex = 0,
}: {
  item: RateItem;
  onAdd: (qty: number, stageIndex: number, inputText: string) => void;
  onClose: () => void;
  defaultStageIndex?: number;
}) {
  const isLength = item.uom === "m";
  const isArea = item.uom === "m²";
  const isVolume = item.uom === "m³";
  const isCount = !isLength && !isArea && !isVolume;

  const [stageIndex, setStageIndex] = useState(defaultStageIndex);
  const [mode, setMode] = useState<"sor" | "ftin" | "sqft" | "cft" | "dims">(
    isLength ? "ftin" : isArea || isVolume ? "dims" : "sor",
  );
  const [sorQty, setSorQty] = useState("");
  const [ft, setFt] = useState("");
  const [inch, setInch] = useState("");
  const [len, setLen] = useState({ ft: "", inch: "" });
  const [wid, setWid] = useState({ ft: "", inch: "" });
  const [dep, setDep] = useState({ ft: "", inch: "" });
  const [sqft, setSqft] = useState("");
  const [cft, setCft] = useState("");

  const raw = (() => {
    if (isCount || mode === "sor") return Number(sorQty) || 0;
    if (isLength && mode === "ftin") return ftInToM(ft, inch);
    if (isArea && mode === "sqft") return (Number(sqft) || 0) * FT2_TO_M2;
    if (isVolume && mode === "cft") return (Number(cft) || 0) * FT3_TO_M3;
    if ((isArea || isVolume) && mode === "dims") {
      const L = ftInToM(len.ft, len.inch);
      const W = ftInToM(wid.ft, wid.inch);
      const D = isVolume ? ftInToM(dep.ft, dep.inch) : 1;
      return isArea ? L * W : L * W * D;
    }
    return 0;
  })();
  const q = round3(raw);
  const valid = q > 0;
  const pct = claimPct(item.stages, stageIndex);

  const inputText = (() => {
    if (!valid) return "";
    if (isCount || mode === "sor") return `${formatQty(q)} ${item.uom}`;
    if (isLength && mode === "ftin") return formatFtIn(ft, inch);
    if (isArea && mode === "sqft") return `${sqft} ft²`;
    if (isVolume && mode === "cft") return `${cft} ft³`;
    if ((isArea || isVolume) && mode === "dims") {
      const parts = [formatFtIn(len.ft, len.inch), formatFtIn(wid.ft, wid.inch)];
      if (isVolume) parts.push(formatFtIn(dep.ft, dep.inch));
      return parts.join(" × ");
    }
    return "";
  })();

  const modes = isLength
    ? [
        { id: "ftin" as const, label: "Feet & inches" },
        { id: "sor" as const, label: "Metres" },
      ]
    : isArea
      ? [
          { id: "dims" as const, label: "L × W (ft)" },
          { id: "sqft" as const, label: "ft²" },
          { id: "sor" as const, label: "m²" },
        ]
      : isVolume
        ? [
            { id: "dims" as const, label: "L × W × D (ft)" },
            { id: "cft" as const, label: "ft³" },
            { id: "sor" as const, label: "m³" },
          ]
        : [];

  return (
    <Modal title={`Add ${item.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Rate</span>
            <span className="font-semibold">
              {formatRate(item.rate)} / {item.uom}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-slate-500">{item.detail}</span>
            <span className="text-xs text-slate-400">LOA {formatQty(item.loaQty)}</span>
          </div>
        </div>

        {modes.length > 0 ? (
          <div
            className="grid gap-1 rounded-xl bg-slate-100 p-1"
            style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}
          >
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`rounded-lg py-2 text-[11px] font-semibold ${
                  mode === m.id ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        ) : null}

        {isCount || mode === "sor" ? (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Quantity ({item.uom})
            </span>
            <input
              inputMode="decimal"
              autoFocus
              value={sorQty}
              onChange={(e) => setSorQty(e.target.value)}
              placeholder="0"
              className={`${inputClass} text-2xl font-bold`}
            />
          </label>
        ) : isLength && mode === "ftin" ? (
          <FtInRow label="Length" ft={ft} inch={inch} onFt={setFt} onIn={setInch} />
        ) : isArea && mode === "sqft" ? (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Area (ft²)</span>
            <input
              inputMode="decimal"
              autoFocus
              value={sqft}
              onChange={(e) => setSqft(e.target.value)}
              placeholder="0"
              className={`${inputClass} text-2xl font-bold`}
            />
          </label>
        ) : isVolume && mode === "cft" ? (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Volume (ft³)</span>
            <input
              inputMode="decimal"
              autoFocus
              value={cft}
              onChange={(e) => setCft(e.target.value)}
              placeholder="0"
              className={`${inputClass} text-2xl font-bold`}
            />
          </label>
        ) : mode === "dims" ? (
          <div className="space-y-2">
            <FtInRow
              label="Length"
              ft={len.ft}
              inch={len.inch}
              onFt={(v) => setLen((p) => ({ ...p, ft: v }))}
              onIn={(v) => setLen((p) => ({ ...p, inch: v }))}
            />
            <FtInRow
              label="Width"
              ft={wid.ft}
              inch={wid.inch}
              onFt={(v) => setWid((p) => ({ ...p, ft: v }))}
              onIn={(v) => setWid((p) => ({ ...p, inch: v }))}
            />
            {isVolume ? (
              <FtInRow
                label="Depth"
                ft={dep.ft}
                inch={dep.inch}
                onFt={(v) => setDep((p) => ({ ...p, ft: v }))}
                onIn={(v) => setDep((p) => ({ ...p, inch: v }))}
              />
            ) : null}
          </div>
        ) : null}

        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-500">Converted to {item.uom}</span>
            <span className="text-xl font-bold text-slate-900">
              {valid ? `${formatQty(q)} ${item.uom}` : "—"}
            </span>
          </div>
          {valid && inputText ? (
            <p className="mt-0.5 text-[10px] text-slate-400">Entered: {inputText}</p>
          ) : null}
        </div>

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
              {valid ? formatINR2(q * item.rate) : "—"}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-brand-800">Claimable now ({Math.round(pct * 100)}%)</span>
            <span className="font-bold text-brand-900">
              {valid ? formatINR2(q * claimPerUnit(item, stageIndex)) : "—"}
            </span>
          </div>
        </div>

        <Button
          onClick={() => onAdd(q, stageIndex, inputText)}
          disabled={!valid}
          className="w-full py-3"
        >
          Add to day
        </Button>
      </div>
    </Modal>
  );
}
