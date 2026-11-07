import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Empty, Modal, Spinner, inputClass } from "../components/ui";
import { AddLineModal, ItemPicker } from "../components/RateBits";
import { ActivityForm } from "../components/ActivityForm";
import { LMC_ITEMS, PE_ITEMS, ITEM_MAP, claimPct, claimPerUnit, type Contract, type RateItem } from "../lib/rates";
import { formatINR2, formatQty } from "../lib/format";
import { prettyDate, todayISO } from "../lib/dates";
import { deleteWorkDay, fetchActivities, fetchLocations, fetchWork, saveWorkDay } from "../lib/work";
import type { ActivityRow, DayWithLines, LocationRow } from "../lib/types";

type DraftLine = {
  item: RateItem;
  qty: number;
  stageIndex: number;
  inputText: string;
  activityId: string | null;
};

export function LogPage() {
  const [days, setDays] = useState<DayWithLines[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(todayISO());
  const [contract, setContract] = useState<Contract>("PE");
  const [locationId, setLocationId] = useState("");
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [picker, setPicker] = useState(false);
  const [pendingItem, setPendingItem] = useState<RateItem | null>(null);
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null);
  const [pendingStageIndex, setPendingStageIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [viewDay, setViewDay] = useState<DayWithLines | null>(null);
  const [activityForm, setActivityForm] = useState<{ activity: ActivityRow | null } | null>(null);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, l, a] = await Promise.all([fetchWork(), fetchLocations(), fetchActivities()]);
      setDays(d);
      setLocations(l);
      setActivities(a);
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

  const siteActivities = useMemo(
    () => activities.filter((a) => a.location_id === locationId && a.contract === contract),
    [activities, locationId, contract],
  );

  const activityProgress = useMemo(() => {
    const map = new Map<string, { qty: number; lastDate: string | null; claim: number }>();
    for (const d of days) {
      for (const line of d.lines) {
        if (!line.activity_id) continue;
        const item = ITEM_MAP[line.item_id];
        if (!item) continue;
        const cur = map.get(line.activity_id) ?? { qty: 0, lastDate: null, claim: 0 };
        cur.qty += Number(line.qty);
        cur.claim += Number(line.qty) * claimPerUnit(item, line.stage_index);
        if (!cur.lastDate || d.work_date > cur.lastDate) cur.lastDate = d.work_date;
        map.set(line.activity_id, cur);
      }
    }
    return map;
  }, [days]);

  const siteDays = useMemo(
    () => days.filter((d) => d.location_id === locationId && d.contract === contract),
    [days, locationId, contract],
  );

  const recentItems = useMemo(() => {
    const map = new Map<string, { item: RateItem; qty: number; lastDate: string }>();
    for (const d of siteDays) {
      for (const line of d.lines) {
        const item = ITEM_MAP[line.item_id];
        if (!item) continue;
        const cur = map.get(item.id) ?? { item, qty: 0, lastDate: d.work_date };
        cur.qty += Number(line.qty);
        if (d.work_date > cur.lastDate) cur.lastDate = d.work_date;
        map.set(item.id, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  }, [siteDays]);

  const activityStatus = useCallback(
    (a: ActivityRow) => {
      const qty = activityProgress.get(a.id)?.qty ?? 0;
      if (a.status === "done") return "done" as const;
      if (a.planned_qty != null && a.planned_qty > 0 && qty >= a.planned_qty) {
        return "done" as const;
      }
      if (qty > 0) return "in_progress" as const;
      return "planned" as const;
    },
    [activityProgress],
  );

  const inProgress = siteActivities.filter((a) => activityStatus(a) === "in_progress");
  const planned = siteActivities.filter((a) => activityStatus(a) === "planned");
  const doneActivities = siteActivities.filter((a) => activityStatus(a) === "done");
  const activeItemIds = new Set([...inProgress, ...planned].map((a) => a.item_id));
  const quickRepeatItems = recentItems.filter((r) => !activeItemIds.has(r.item.id));

  const switchContract = (c: Contract) => {
    if (c === contract) return;
    setContract(c);
    setDraft([]);
  };

  const addLine = (qty: number, stageIndex: number, inputText: string) => {
    if (!pendingItem) return;
    setDraft((prev) => [
      ...prev,
      { item: pendingItem, qty, stageIndex, inputText, activityId: pendingActivityId },
    ]);
    setPendingItem(null);
    setPendingActivityId(null);
    setPendingStageIndex(0);
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
          input_text: l.inputText,
          activity_id: l.activityId,
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

  const openActivity = (a: ActivityRow) => {
    const item = ITEM_MAP[a.item_id];
    if (!item) {
      setError("The rate item for this activity is missing.");
      return;
    }
    setPendingItem(item);
    setPendingActivityId(a.id);
    setPendingStageIndex(a.stage_index);
  };

  const recentDays = locationId ? siteDays.slice(0, 14) : days.slice(0, 25);

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

      {locationId ? (
        <>
          <Card className="overflow-hidden">
            <div className="flex items-start justify-between px-3 py-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Site plan
                </p>
                <p className="text-[10px] text-slate-400">
                  {locationName(locationId)} · {siteActivities.length}{" "}
                  {siteActivities.length === 1 ? "activity" : "activities"}
                </p>
              </div>
              <button
                onClick={() => setActivityForm({ activity: null })}
                className="text-[11px] font-semibold text-brand-700"
              >
                + New activity
              </button>
            </div>

            {siteActivities.length === 0 ? (
              <p className="border-t border-slate-100 px-3 py-4 text-center text-xs text-slate-400">
                No plan for this site yet. Add the target from the work order.
              </p>
            ) : null}

            {inProgress.length > 0 ? (
              <div>
                <p className="bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  In progress
                </p>
                {inProgress.map((a) => (
                  <ActivityCard
                    key={a.id}
                    activity={a}
                    progress={activityProgress.get(a.id)}
                    status="in_progress"
                    onToday={() => openActivity(a)}
                    onEdit={() => setActivityForm({ activity: a })}
                  />
                ))}
              </div>
            ) : null}

            {planned.length > 0 ? (
              <div>
                <p className="bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Planned
                </p>
                {planned.map((a) => (
                  <ActivityCard
                    key={a.id}
                    activity={a}
                    progress={activityProgress.get(a.id)}
                    status="planned"
                    onToday={() => openActivity(a)}
                    onEdit={() => setActivityForm({ activity: a })}
                  />
                ))}
              </div>
            ) : null}

            {doneActivities.length > 0 ? (
              <div>
                <button
                  onClick={() => setShowDone((v) => !v)}
                  className="flex w-full items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                >
                  <span>Done ({doneActivities.length})</span>
                  <span>{showDone ? "▴" : "▾"}</span>
                </button>
                {showDone
                  ? doneActivities.map((a) => (
                      <ActivityCard
                        key={a.id}
                        activity={a}
                        progress={activityProgress.get(a.id)}
                        status="done"
                        onToday={() => openActivity(a)}
                        onEdit={() => setActivityForm({ activity: a })}
                      />
                    ))
                  : null}
              </div>
            ) : null}
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Quick repeat
              </p>
              <p className="text-[10px] text-slate-400">recent at this site</p>
            </div>
            {recentItems.length === 0 ? (
              <p className="border-t border-slate-100 px-3 py-3 text-center text-xs text-slate-400">
                No work logged at this site yet.
              </p>
            ) : quickRepeatItems.length === 0 ? (
              <p className="border-t border-slate-100 px-3 py-3 text-center text-xs text-slate-400">
                All recent items are already in the plan above.
              </p>
            ) : (
              quickRepeatItems.slice(0, 8).map((r) => (
                <button
                  key={r.item.id}
                  onClick={() => {
                    setPendingItem(r.item);
                    setPendingActivityId(null);
                    setPendingStageIndex(0);
                  }}
                  className="flex w-full items-center justify-between gap-2 border-t border-slate-50 px-3 py-2 text-left active:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">
                      {r.item.name}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {formatQty(r.qty)} {r.item.uom} · last {prettyDate(r.lastDate)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-brand-50 px-2 py-1 text-[10px] font-semibold text-brand-700">
                    + Today
                  </span>
                </button>
              ))
            )}
          </Card>
        </>
      ) : (
        <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          Select a site to see its plan, quick-repeat items and history.
        </p>
      )}

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
                  {l.inputText ? (
                    <p className="truncate text-[10px] text-slate-400">Entered: {l.inputText}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {formatINR2(l.qty * claimPerUnit(l.item, l.stageIndex))}
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
              <span className="font-semibold text-slate-800">{formatINR2(totals.full)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-slate-500">Claimable now</span>
              <span className="font-bold text-brand-700">{formatINR2(totals.claim)}</span>
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
          {locationId ? "Last 14 days at this site" : "Recent entries"}
        </p>
        {loading ? (
          <Spinner />
        ) : recentDays.length === 0 ? (
          <Empty
            title={locationId ? "No work at this site yet" : "No work logged yet"}
            hint={locationId ? "Add the first item above." : "Add the first day above."}
          />
        ) : (
          <div className="space-y-2">
            {recentDays.map((d) => {
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
                      <p className="text-sm font-bold text-slate-900">{formatINR2(claim)}</p>
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
        <AddLineModal
          item={pendingItem}
          defaultStageIndex={pendingStageIndex}
          onAdd={addLine}
          onClose={() => {
            setPendingItem(null);
            setPendingActivityId(null);
            setPendingStageIndex(0);
          }}
        />
      ) : null}

      {activityForm && locationId ? (
        <ActivityForm
          contract={contract}
          locationId={locationId}
          activity={activityForm.activity}
          onClose={() => setActivityForm(null)}
          onSaved={load}
        />
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
                      {line.input_text ? (
                        <p className="text-[10px] text-slate-400">Entered: {line.input_text}</p>
                      ) : null}
                    </div>
                    <p className="shrink-0 font-semibold text-slate-900">
                      {formatINR2(Number(line.qty) * claimPerUnit(item, line.stage_index))}
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

function ActivityCard({
  activity,
  progress,
  status,
  onToday,
  onEdit,
}: {
  activity: ActivityRow;
  progress?: { qty: number; lastDate: string | null; claim: number };
  status: "planned" | "in_progress" | "done";
  onToday: () => void;
  onEdit: () => void;
}) {
  const doneQty = progress?.qty ?? 0;
  const plannedQty = activity.planned_qty ?? null;
  const pct = plannedQty && plannedQty > 0 ? Math.min(1, doneQty / plannedQty) : 0;
  return (
    <div className="border-t border-slate-100 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{activity.title}</p>
          <p className="truncate text-[10px] text-slate-500">
            {activity.phase ? `${activity.phase} · ` : ""}
            {plannedQty
              ? `${formatQty(doneQty)} / ${formatQty(plannedQty)} ${activity.uom}`
              : `${formatQty(doneQty)} ${activity.uom} done`}
          </p>
          <p className="truncate text-[10px] text-slate-400">
            {progress?.lastDate
              ? `Last logged ${prettyDate(progress.lastDate)}`
              : activity.start_date
                ? `Starts ${prettyDate(activity.start_date)}`
                : "Not started"}
            {activity.target_date ? ` · target ${prettyDate(activity.target_date)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {status !== "done" ? (
            <button
              onClick={onToday}
              className="rounded-lg bg-brand-700 px-2.5 py-1 text-[10px] font-semibold text-white active:bg-brand-800"
            >
              + Today
            </button>
          ) : null}
          <button onClick={onEdit} className="text-[10px] font-medium text-slate-400">
            edit
          </button>
        </div>
      </div>
      {plannedQty ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct * 100}%` }} />
        </div>
      ) : null}
    </div>
  );
}
