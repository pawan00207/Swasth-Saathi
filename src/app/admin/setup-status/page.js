"use client";

import { useEffect, useState } from "react";

export default function SetupStatusPage() {
  const [integrations, setIntegrations] = useState([]);
  const [checkedAt, setCheckedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/setup-status", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not check integration status.");
      setIntegrations(result.integrations || []);
      setCheckedAt(result.checkedAt || "");
    } catch (reason) {
      setError(reason.message || "Could not check integration status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-teal-900">Integration setup status</h1>
          <p className="mt-2 text-slate-600">Only configuration and connectivity status are shown. Secret values are never sent to this page.</p>
        </div>
        <button onClick={refresh} disabled={loading} className="rounded border border-teal-800 px-4 py-2 text-teal-900 disabled:opacity-60">
          {loading ? "Checking..." : "Check again"}
        </button>
      </div>
      {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-red-900">{error}</p>}
      {loading && integrations.length === 0 && <p role="status" className="mt-5">Testing integrations...</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {integrations.map((integration) => (
          <article key={integration.name} className="rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-bold">{integration.name}</h2>
              <span className={`rounded px-2 py-1 text-xs font-bold ${integration.ok ? "bg-green-100 text-green-900" : integration.configured ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-950"}`}>
                {integration.ok ? "LIVE · OK" : integration.configured ? "CONFIGURED · TEST FAILED" : "DEMO DATA"}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">Environment keys: {integration.configured ? "present" : "missing"}</p>
            <p className="mt-1 text-sm text-slate-700">Live test: {integration.ok ? "succeeded" : integration.configured ? "failed or unavailable" : "not run"}</p>
          </article>
        ))}
      </div>
      {checkedAt && <p className="mt-4 text-sm text-slate-500">Last checked: {new Date(checkedAt).toLocaleString()}</p>}
    </main>
  );
}
