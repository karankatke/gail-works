import { useState } from "react";
import { Button, Modal } from "./ui";
import { QuantityInput, type QuantityValue } from "./QuantityInput";
import { formatINR2, formatRate } from "../lib/format";
import type { RateItem } from "../lib/rates";

export function EstimateLineModal({
  item,
  initialQty,
  onSave,
  onClose,
}: {
  item: RateItem;
  initialQty?: number;
  onSave: (qty: number, inputText: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState<QuantityValue>({
    qty: initialQty ?? 0,
    inputText: initialQty != null ? `${initialQty} ${item.uom}` : "",
  });
  const valid = value.qty > 0;

  return (
    <Modal title={`${initialQty != null ? "Edit" : "Add"} ${item.name}`} onClose={onClose}>
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
            <span className="text-[10px] text-slate-400">{item.contract}</span>
          </div>
        </div>

        <QuantityInput uom={item.uom} value={value} onChange={setValue} initialQty={initialQty} />

        <div className="rounded-xl bg-brand-50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-800">Value at full rate</span>
            <span className="font-bold text-brand-900">
              {valid ? formatINR2(value.qty * item.rate) : "—"}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-brand-700">
            Estimate uses the full LOA rate. Stage-wise claim is handled in the bill.
          </p>
        </div>

        <Button
          onClick={() => onSave(value.qty, value.inputText)}
          disabled={!valid}
          className="w-full py-3"
        >
          {initialQty != null ? "Update item" : "Add to estimate"}
        </Button>
      </div>
    </Modal>
  );
}
