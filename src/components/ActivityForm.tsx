import { useState } from "react";
import { Button, Modal, inputClass } from "./ui";
import { ItemSearchList } from "./RateBits";
import { ITEM_MAP, LMC_ITEMS, PE_ITEMS, type Contract, type RateItem } from "../lib/rates";
import { todayISO } from "../lib/dates";
import { addActivity, deleteActivity, updateActivity } from "../lib/work";
import type { ActivityRow } from "../lib/types";

export function ActivityForm({
  contract,
  locationId,
  activity,
  onClose,
  onSaved,
}: {
  contract: Contract;
  locationId: string;
  activity?: ActivityRow | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const editing = Boolean(activity);
  const existingItem = activity ? ITEM_MAP[activity.item_id] ?? null : null;
  const [item, setItem] = useState<RateItem | null>(existingItem);
  const [step, setStep] = useState<"item" | "details">(existingItem ? "details" : "item");
  const [title, setTitle] = useState(activity?.title ?? "");
  const [phase, setPhase] = useState(activity?.phase ?? "");
  const [plannedQty, setPlannedQty] = useState(
    activity?.planned_qty != null ? String(activity.planned_qty) : "",
  );
  const [stageIndex, setStageIndex] = useState(activity?.stage_index ?? 0);
  const [startDate, setStartDate] = useState(activity?.start_date ?? todayISO());
  const [targetDate, setTargetDate] = useState(activity?.target_date ?? "");
  const [note, setNote] = useState(activity?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = contract === "PE" ? PE_ITEMS : LMC_ITEMS;

  const pickItem = (picked: RateItem) => {
    setItem(picked);
    setTitle(`${picked.name} - ${picked.detail}`);
    setPhase(picked.category);
    setStageIndex(0);
    setStep("details");
  };

  const save = async () => {
    if (!item) return;
    if (!title.trim()) {
      setError("Give this activity a short name.");
      return;
    }
    setBusy(true);
    setError(null);
    const planned = plannedQty.trim() === "" ? null : Number(plannedQty);
    try {
      if (editing && activity) {
        await updateActivity(activity.id, {
          title: title.trim(),
          phase: phase.trim() || null,
          planned_qty: planned,
          stage_index: stageIndex,
          start_date: startDate || null,
          target_date: targetDate || null,
          note: note.trim() || null,
        });
      } else {
        await addActivity({
          contract,
          location_id: locationId,
          item_id: item.id,
          title: title.trim(),
          phase: phase.trim() || null,
          planned_qty: planned,
          uom: item.uom,
          stage_index: stageIndex,
          start_date: startDate || null,
          target_date: targetDate || null,
          note: note.trim() || null,
        });
      }
      await onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the activity");
      setBusy(false);
    }
  };

  const markDone = async () => {
    if (!activity) return;
    setBusy(true);
    try {
      await updateActivity(activity.id, {
        status: "done",
        completed_at: new Date().toISOString(),
      });
      await onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!activity) return;
    if (!window.confirm("Delete this activity? The daily work already logged stays in the bill.")) {
      return;
    }
    setBusy(true);
    try {
      await deleteActivity(activity.id);
      await onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
      setBusy(false);
    }
  };

  if (step === "item") {
    return (
      <Modal title="Pick work for the plan" onClose={onClose} full>
        <p className="mb-3 text-[11px] text-slate-500">
          Choose the SOR item. You can set the target quantity on the next screen.
        </p>
        <ItemSearchList items={items} onPick={pickItem} />
      </Modal>
    );
  }

  return (
    <Modal title={editing ? "Edit activity" : "New activity"} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-900">{item?.name}</p>
          <p className="text-[11px] text-slate-500">
            {item?.code} · {item?.detail} · {item?.uom}
          </p>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Activity name</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="e.g. Lay 32 mm pipe — Aditya Birla"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Phase</span>
            <input
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              className={inputClass}
              placeholder="Laying"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Target qty ({item?.uom})
            </span>
            <input
              inputMode="decimal"
              value={plannedQty}
              onChange={(e) => setPlannedQty(e.target.value)}
              className={inputClass}
              placeholder="optional"
            />
          </label>
        </div>
        <p className="-mt-1 text-[10px] text-slate-400">
          Target is in the SOR unit ({item?.uom}). Daily work can still be entered in feet/inches.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Target date</span>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Default stage</span>
          <select
            value={stageIndex}
            onChange={(e) => setStageIndex(Number(e.target.value))}
            className={inputClass}
          >
            {item?.stages.map((s, idx) => (
              <option key={`${s.label}-${idx}`} value={idx}>
                {s.label} — {Math.round(s.pct * 100)}%
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Note</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
            placeholder="optional"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button onClick={save} disabled={busy} className="w-full py-3">
          {busy ? "Saving…" : editing ? "Save changes" : "Create activity"}
        </Button>

        {editing ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={markDone} disabled={busy}>
              Mark done
            </Button>
            <Button variant="danger" onClick={remove} disabled={busy}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
