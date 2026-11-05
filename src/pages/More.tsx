import { useCallback, useEffect, useState } from "react";
import { Button, Card } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { CONTRACTS } from "../lib/rates";
import { formatLakh, formatINR } from "../lib/format";
import { prettyDateLong } from "../lib/dates";
import { fetchBills, fetchWork } from "../lib/work";
import type { BillRow } from "../lib/types";

export function MorePage() {
  const { profile, signOut } = useAuth();
  const [bills, setBills] = useState<BillRow[]>([]);
  const [counts, setCounts] = useState({ days: 0, lines: 0 });

  const load = useCallback(async () => {
    try {
      const [work, b] = await Promise.all([fetchWork(), fetchBills()]);
      setBills(b);
      setCounts({ days: work.length, lines: work.reduce((s, d) => s + d.lines.length, 0) });
    } catch {
      // keep the page usable even if data cannot load
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalBasic = CONTRACTS.PE.basicValue + CONTRACTS.LMC.basicValue;
  const totalGst = CONTRACTS.PE.gst + CONTRACTS.LMC.gst;
  const totalValue = CONTRACTS.PE.totalValue + CONTRACTS.LMC.totalValue;

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <p className="text-xs font-medium text-slate-400">Project value</p>
        <p className="text-2xl font-bold text-slate-900">{formatLakh(totalValue)}</p>
        <p className="text-[11px] text-slate-500">
          {formatINR(totalBasic)} basic + {formatINR(totalGst)} GST
        </p>
        <div className="mt-3 space-y-2">
          {(["PE", "LMC"] as const).map((c) => {
            const k = CONTRACTS[c];
            return (
              <div key={c} className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900">
                    {c} · {k.name}
                  </p>
                  <p className="text-xs font-semibold text-slate-700">{formatLakh(k.totalValue)}</p>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400">{k.loaNo}</p>
                <p className="text-[10px] text-slate-400">
                  LOA {k.loaDate} · basic {formatINR(k.basicValue)}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-bold text-slate-900">RA bill baseline</p>
        <p className="text-[11px] text-slate-500">
          Work logged after this date becomes the next bill.
        </p>
        <div className="mt-2 space-y-2">
          {bills.length === 0 ? (
            <p className="text-sm text-slate-400">No bill recorded yet.</p>
          ) : (
            bills.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {b.bill_no} · {b.contract}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    up to {prettyDateLong(b.period_end)}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                  baseline
                </span>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-bold text-slate-900">How the numbers work</p>
        <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-slate-500">
          <li>
            <b className="text-slate-700">Rates</b> are the final LOA rates, excluding GST. They are
            the same rates the RA bill uses.
          </li>
          <li>
            <b className="text-slate-700">Claimable</b> follows the LOA stages (for example 60% on
            laying, then 10% testing, 25% commissioning, 5% documents).
          </li>
          <li>
            <b className="text-slate-700">Labour</b> comes from the attendance app for all sites. It
            is one project, not split between PE and LMC.
          </li>
          <li>
            <b className="text-slate-700">RA bill</b> is cumulative: every logged day adds to the
            next bill, so a weekly update is enough.
          </li>
        </ul>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-bold text-slate-900">Data</p>
        <p className="mt-1 text-[11px] text-slate-500">
          {counts.days} work days · {counts.lines} lines
        </p>
        <Button variant="secondary" onClick={load} className="mt-2 w-full">
          Refresh
        </Button>
        <a
          href="https://karankatke.github.io/gail-attendance/"
          target="_blank"
          rel="noreferrer"
          className="mt-2 block rounded-xl border border-slate-200 p-3 text-center text-sm font-semibold text-brand-700"
        >
          Open attendance app
        </a>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">
          Signed in as {profile?.display_name ?? "owner"}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          This app is owner-only. It shares the same owner login and database as the attendance app.
        </p>
        <Button variant="danger" onClick={signOut} className="mt-3 w-full">
          Sign out on this phone
        </Button>
      </Card>

      <p className="px-1 pb-2 text-center text-[10px] text-slate-400">
        GAIL Works · LOA rates, weekly work and RA bill
      </p>
    </div>
  );
}
