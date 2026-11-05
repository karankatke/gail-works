import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Button, Card, inputClass } from "./ui";

const OWNER_EMAIL = "family@gail-attendance.app";

export function LoginScreen() {
  const { signInWithPin } = useAuth();
  const [email, setEmail] = useState(OWNER_EMAIL);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    if (pin.trim().length < 4) {
      setError("Enter your PIN.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await signInWithPin(email.trim(), pin);
    if (err) {
      setPin("");
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-800 text-white">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 20h18M5 20V9l7-5 7 5v11" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 20v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">GAIL Works</h1>
          <p className="mt-1 text-sm text-slate-500">Owner access · rates, work and bills</p>
        </div>

        <Card className="p-5">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Owner login</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </label>
            <input
              inputMode="numeric"
              autoFocus
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void signIn();
              }}
              placeholder="PIN"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button onClick={signIn} disabled={busy} className="w-full py-3">
              {busy ? "Checking…" : "Unlock"}
            </Button>
          </div>
        </Card>

        <p className="mt-4 text-center text-[11px] text-slate-400">
          Same owner account as the attendance app. You stay signed in on this phone.
        </p>
      </div>
    </div>
  );
}
