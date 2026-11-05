export function SetupScreen() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h1 className="text-lg font-bold text-slate-900">Supabase is not configured</h1>
        <p className="mt-2 text-sm text-slate-600">
          Add <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code> to{" "}
          <code className="rounded bg-slate-100 px-1">.env</code> and restart the dev server.
        </p>
      </div>
    </div>
  );
}
