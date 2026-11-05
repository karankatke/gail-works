import { useMemo, useState } from "react";
import { Card, inputClass } from "../components/ui";
import { ItemDetail, RateRow } from "../components/RateBits";
import {
  ALL_ITEMS,
  CATEGORIES,
  ITEM_MAP,
  KIT_EXISTING,
  KIT_NEW,
  LMC_ITEMS,
  PE_ITEMS,
  itemSearchText,
  type Contract,
  type RateItem,
} from "../lib/rates";
import { formatINR, formatLakh, formatQty } from "../lib/format";

const MATRIX_SIZES = [20, 32, 63, 90, 125];

function compact(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(2).replace(/0$/, "")}k`;
  return String(Math.round(n));
}

export function RatesPage() {
  const [contract, setContract] = useState<Contract>(() => {
    const saved = localStorage.getItem("works-contract");
    return saved === "LMC" ? "LMC" : "PE";
  });
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<RateItem | null>(null);
  const [kitMode, setKitMode] = useState<"new" | "existing">("existing");

  const switchContract = (c: Contract) => {
    setContract(c);
    localStorage.setItem("works-contract", c);
  };

  const items = contract === "PE" ? PE_ITEMS : LMC_ITEMS;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return ALL_ITEMS.filter((i) => itemSearchText(i).includes(q));
  }, [query]);

  const grouped = useMemo(() => {
    const map: Record<string, RateItem[]> = {};
    for (const cat of CATEGORIES[contract]) map[cat] = [];
    for (const item of items) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return map;
  }, [items, contract]);

  const matrix = useMemo(() => {
    return MATRIX_SIZES.map((mm) => {
      const byDetail = (detail: string) =>
        PE_ITEMS.find((i) => i.name === `${mm} mm pipe` && i.detail === detail) ?? null;
      return {
        mm,
        soil: byDetail("Open trench · normal soil"),
        rock: byDetail("Open trench · rock"),
        moling: byDetail("Machine moling"),
        hdd: byDetail("HDD · normal soil"),
        hddRock: byDetail("HDD · rock"),
      };
    });
  }, []);

  const kit = kitMode === "new" ? KIT_NEW : KIT_EXISTING;
  const kitRows = kit.map((k) => ({ item: ITEM_MAP[k.id], qty: k.qty })).filter((x) => x.item);
  const kitTotal = kitRows.reduce((s, r) => s + r.item.rate * r.qty, 0);

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {(["PE", "LMC"] as Contract[]).map((c) => (
            <button
              key={c}
              onClick={() => switchContract(c)}
              className={`rounded-lg py-2.5 text-sm font-semibold transition ${
                contract === c ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
              }`}
            >
              {c === "PE" ? "PE · pipeline" : "LMC · last mile"}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search rate: 32, 1 inch, meter, valve…"
          className={`${inputClass} mt-3 py-2.5 text-sm`}
        />
      </Card>

      {results ? (
        <Card className="overflow-hidden">
          <p className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
            {results.length} item{results.length === 1 ? "" : "s"} in both contracts
          </p>
          {results.map((i) => (
            <RateRow
              key={i.id}
              item={i}
              onClick={() => setDetail(i)}
            />
          ))}
          {results.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">No rate matches that search.</p>
          ) : null}
        </Card>
      ) : null}

      {!results && contract === "PE" ? (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-3 pt-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Pipe rate matrix</p>
              <p className="text-[11px] text-slate-500">₹ per metre · tap a rate</p>
            </div>
            <p className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-semibold text-brand-700">
              LOA
            </p>
          </div>
          <div className="mt-2 overflow-x-auto px-1 pb-2">
            <table className="w-full min-w-[420px] border-collapse text-[11px]">
              <thead>
                <tr className="text-slate-400">
                  <th className="px-1.5 py-1 text-left font-medium">Size</th>
                  <th className="px-1 py-1 font-medium">Soil</th>
                  <th className="px-1 py-1 font-medium">Rock</th>
                  <th className="px-1 py-1 font-medium">Moling</th>
                  <th className="px-1 py-1 font-medium">HDD</th>
                  <th className="px-1 py-1 font-medium">HDD rock</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.mm} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-1.5 py-1.5 font-semibold text-slate-700">
                      {row.mm} mm
                    </td>
                    {[row.soil, row.rock, row.moling, row.hdd, row.hddRock].map((cell, idx) => (
                      <td key={idx} className="p-0.5 text-center">
                        {cell ? (
                          <button
                            onClick={() => setDetail(cell)}
                            className="w-full rounded-md px-1 py-1.5 font-semibold text-slate-800 active:bg-brand-50"
                          >
                            {compact(cell.rate)}
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-400">
            Values in ₹ per metre. Soil = open trench. HDD = horizontal drilling.
          </p>
        </Card>
      ) : null}

      {!results && contract === "LMC" ? (
        <Card className="overflow-hidden">
          <div className="px-3 pt-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">What one flat is worth</p>
                <p className="text-[11px] text-slate-500">Common items for one connection</p>
              </div>
              <p className="text-right text-lg font-bold text-brand-700">{formatLakh(kitTotal)}</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              <button
                onClick={() => setKitMode("existing")}
                className={`rounded-md py-1.5 text-[11px] font-semibold ${
                  kitMode === "existing" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
                }`}
              >
                Existing building
              </button>
              <button
                onClick={() => setKitMode("new")}
                className={`rounded-md py-1.5 text-[11px] font-semibold ${
                  kitMode === "new" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
                }`}
              >
                New PE connection
              </button>
            </div>
          </div>
          <div className="mt-2 border-t border-slate-100">
            {kitRows.map((r) => (
              <button
                key={r.item.id}
                onClick={() => setDetail(r.item)}
                className="flex w-full items-center justify-between gap-2 border-b border-slate-50 px-3 py-2 text-left last:border-0 active:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-800">{r.item.name}</p>
                  <p className="truncate text-[10px] text-slate-400">
                    {formatQty(r.qty)} {r.item.uom} × {formatINR(r.item.rate)}
                  </p>
                </div>
                <p className="shrink-0 text-xs font-semibold text-slate-700">
                  {formatINR(r.qty * r.item.rate)}
                </p>
              </button>
            ))}
          </div>
          <p className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-400">
            Typical quantities only. Actual claim follows what is measured per flat.
          </p>
        </Card>
      ) : null}

      {!results
        ? CATEGORIES[contract].map((cat) => {
            const list = grouped[cat] ?? [];
            if (list.length === 0) return null;
            return (
              <Card key={cat} className="overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{cat}</p>
                  <p className="text-[10px] text-slate-400">{list.length}</p>
                </div>
                {list.map((item) => (
                  <RateRow key={item.id} item={item} onClick={() => setDetail(item)} />
                ))}
              </Card>
            );
          })
        : null}

      <p className="px-1 pb-2 text-[11px] text-slate-400">
        Final LOA rates, excluding GST. Stage percentages decide what can be claimed now.
      </p>

      {detail ? <ItemDetail item={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}
