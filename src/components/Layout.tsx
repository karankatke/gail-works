import type { ReactNode } from "react";

export interface NavTab {
  id: string;
  label: string;
  icon: ReactNode;
}

const RATES_ICON = (
  <path d="M7 7h10M7 12h10M7 17h6M4 4h16v16H4z" />
);
const LOG_ICON = (
  <path d="M12 5v14M5 12h14M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
);
const PROGRESS_ICON = <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />;
const MORE_ICON = (
  <path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-2.9 1.17V21a2 2 0 11-4 0v-.09A1.65 1.65 0 006 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 002.6 15a1.65 1.65 0 00-1.51-1H1a2 2 0 110-4h.09A1.65 1.65 0 002.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6h.09A1.65 1.65 0 0010 3V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9v.09a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
);

export const TABS: NavTab[] = [
  { id: "rates", label: "Rates", icon: RATES_ICON },
  { id: "log", label: "Log work", icon: LOG_ICON },
  { id: "progress", label: "Progress", icon: PROGRESS_ICON },
  { id: "more", label: "More", icon: MORE_ICON },
];

export function Layout({
  tab,
  onTab,
  title,
  subtitle,
  children,
}: {
  tab: string;
  onTab: (t: string) => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 bg-brand-800 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white shadow-sm">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-lg font-bold leading-tight">{title}</h1>
          {subtitle ? <p className="text-xs text-brand-200">{subtitle}</p> : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4 pb-28">{children}</main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pt-1.5 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-stretch justify-between">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => onTab(t.id)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition ${
                  active ? "text-brand-700" : "text-slate-400"
                }`}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {t.icon}
                </svg>
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
