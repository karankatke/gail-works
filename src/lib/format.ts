export function formatINR(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "₹0";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/** Rates keep the document precision: 2 decimals, or 3 when present. No rupee rounding. */
export function formatRate(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "₹0.00";
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  })}`;
}

/** Same as formatRate, without the rupee sign (for the rate matrix). */
export function formatRatePlain(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
}

export function formatINR2(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "₹0.00";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Compact money: 1.25 L, 24.9 L, 1.2 Cr. */
export function formatLakh(value: number): string {
  const n = Number(value ?? 0);
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return formatINR(n);
}

export function formatQty(value: number): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

export function formatPct(value: number): string {
  const n = Number(value ?? 0) * 100;
  return `${Math.round(n * 10) / 10}%`;
}

export function padPin(pin: string): string {
  return pin.trim().padStart(6, "0");
}
