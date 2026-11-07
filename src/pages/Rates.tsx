import { useMemo, useState } from "react";
import { Card, inputClass } from "../components/ui";
import { ItemDetail, RateRow } from "../components/RateBits";
import {
  ALL_ITEMS,
  CATEGORIES,
  LMC_ITEMS,
  PE_ITEMS,
  itemSearchText,
  type Contract,
  type RateItem,
} from "../lib/rates";
import { formatRatePlain } from "../lib/format";

const MATRIX_SIZES = [20, 32, 63, 90, 125];

export function RatesPage() {
  const [contract, setContract] = useState<Contract>(() => {
    const saved = localStorage.getItem("works-contract");
    return saved === "LMC" ? "LMC" : "PE";
  });
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<RateItem | null>(null);

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
              {c === "PE" ? "PE pipe laying" : "LMC"}
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
            <table className="w-full border-collapse text-[10px]">
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
                            {formatRatePlain(cell.rate)}
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
            Values in ₹ per metre. Soil = open trench. HDD = horizontal drilling (normal soil). HDD rock = rock.
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
