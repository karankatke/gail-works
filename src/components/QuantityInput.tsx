import { useEffect, useState } from "react";
import { inputClass } from "./ui";
import { formatQty } from "../lib/format";
import { FT2_TO_M2, FT3_TO_M3, formatFtIn, ftInToM, round3 } from "../lib/units";

export type QuantityValue = { qty: number; inputText: string };

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

export function QuantityInput({
  uom,
  value,
  onChange,
  initialQty,
}: {
  uom: string;
  value: QuantityValue;
  onChange: (v: QuantityValue) => void;
  initialQty?: number;
}) {
  const isLength = uom === "m";
  const isArea = uom === "m²";
  const isVolume = uom === "m³";
  const isCount = !isLength && !isArea && !isVolume;

  const [mode, setMode] = useState<"sor" | "ftin" | "sqft" | "cft" | "dims">(
    initialQty != null ? "sor" : isLength ? "ftin" : isArea || isVolume ? "dims" : "sor",
  );
  const [sorQty, setSorQty] = useState(initialQty != null ? String(initialQty) : "");
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

  const inputText = (() => {
    if (!valid) return "";
    if (isCount || mode === "sor") return `${formatQty(q)} ${uom}`;
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

  useEffect(() => {
    if (value.qty !== q || value.inputText !== inputText) {
      onChange({ qty: q, inputText });
    }
  }, [q, inputText, value.qty, value.inputText, onChange]);

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
    <div className="space-y-3">
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
          <span className="mb-1 block text-xs font-medium text-slate-600">Quantity ({uom})</span>
          <input
            inputMode="decimal"
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
          <span className="text-xs text-slate-500">Converted to {uom}</span>
          <span className="text-xl font-bold text-slate-900">
            {valid ? `${formatQty(q)} ${uom}` : "—"}
          </span>
        </div>
        {valid && inputText ? (
          <p className="mt-0.5 text-[10px] text-slate-400">Entered: {inputText}</p>
        ) : null}
      </div>
    </div>
  );
}
