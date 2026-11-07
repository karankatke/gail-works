import { useEffect, useRef, type ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 ${className}`}>
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-700 text-white active:bg-brand-800",
  secondary: "bg-slate-100 text-slate-800 active:bg-slate-200",
  ghost: "bg-transparent text-brand-700 active:bg-brand-50",
  danger: "bg-red-600 text-white active:bg-red-700",
};

export function Button({
  children,
  onClick,
  variant = "primary",
  className = "",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

type ModalEntry = { id: number; close: () => void };
const modalStack: ModalEntry[] = [];
let modalSeq = 0;
let popAttached = false;

function onPopState() {
  const top = modalStack[modalStack.length - 1];
  if (top) top.close();
}

function attachPop() {
  if (popAttached) return;
  window.addEventListener("popstate", onPopState);
  popAttached = true;
}

function detachPop() {
  if (!popAttached || modalStack.length > 0) return;
  window.removeEventListener("popstate", onPopState);
  popAttached = false;
}

export function Modal({
  title,
  children,
  onClose,
  full,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  full?: boolean;
}) {
  const idRef = useRef(0);
  if (!idRef.current) idRef.current = ++modalSeq;
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    attachPop();
    const id = idRef.current;
    modalStack.push({ id, close: () => closeRef.current() });
    if (history.state?.modal !== id) {
      history.pushState({ ...(history.state ?? {}), modal: id }, "");
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      const idx = modalStack.findIndex((m) => m.id === id);
      if (idx >= 0) modalStack.splice(idx, 1);

      if (modalStack.length === 0) {
        setTimeout(() => {
          if (modalStack.length === 0 && history.state?.modal === id) {
            history.back();
          }
        }, 50);
        detachPop();
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl ${
          full ? "max-w-2xl" : "max-w-md"
        }`}
      >
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
      <p className="font-medium text-slate-600">{title}</p>
      {hint ? <p className="mt-1 text-sm text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center p-8">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
    </div>
  );
}

export function Segment<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`grid gap-1 rounded-xl bg-slate-100 p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-lg py-2 text-sm font-semibold transition ${
            value === o.id ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
