import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { isConfigured } from "./lib/env";
import { Layout } from "./components/Layout";
import { LoginScreen } from "./components/LoginScreen";
import { SetupScreen } from "./components/SetupScreen";
import { Button, Spinner } from "./components/ui";
import { RatesPage } from "./pages/Rates";
import { LogPage } from "./pages/Log";
import { ProgressPage } from "./pages/Progress";
import { MorePage } from "./pages/More";

const TITLES: Record<string, { title: string; subtitle?: string }> = {
  rates: { title: "Rates", subtitle: "Final LOA rates · PE and LMC" },
  log: { title: "Log work", subtitle: "What was done, and when" },
  progress: { title: "Progress", subtitle: "Work, bills and margin" },
  more: { title: "More", subtitle: "Project and account" },
};

function OwnerApp() {
  const [tab, setTab] = useState("rates");
  const meta = TITLES[tab] ?? TITLES.rates;
  return (
    <Layout tab={tab} onTab={setTab} title={meta.title} subtitle={meta.subtitle}>
      {tab === "rates" ? <RatesPage /> : null}
      {tab === "log" ? <LogPage /> : null}
      {tab === "progress" ? <ProgressPage /> : null}
      {tab === "more" ? <MorePage /> : null}
    </Layout>
  );
}

function OwnerOnly() {
  const { signOut, profile } = useAuth();
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
        <p className="text-lg font-bold text-slate-900">Owner only</p>
        <p className="mt-1 text-sm text-slate-500">
          {profile?.display_name ?? "This account"} does not have owner access to works and rates.
        </p>
        <Button variant="secondary" onClick={signOut} className="mt-4 w-full">
          Sign out
        </Button>
      </div>
    </div>
  );
}

function Root() {
  const { ready, signedIn, profile, isOwner } = useAuth();
  if (!isConfigured) return <SetupScreen />;
  if (!ready) return <Spinner />;
  if (!signedIn || !profile) return <LoginScreen />;
  if (!isOwner) return <OwnerOnly />;
  return <OwnerApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
