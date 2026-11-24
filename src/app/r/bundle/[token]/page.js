"use client";

import { useCallback, useEffect, useState } from "react";

export default function PublicBundleReportsPage({ params }) {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pinRequired, setPinRequired] = useState(false);
  const [pin, setPin] = useState("");

  const loadBundle = useCallback(async (suppliedPin = "") => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/reports/bundle/${encodeURIComponent(params.token)}`, {
        cache: "no-store",
        headers: suppliedPin ? { "x-report-pin": suppliedPin } : {},
      });
      const data = await response.json();
      if (!response.ok) {
        setPinRequired(Boolean(data.pinRequired));
        throw new Error(data.error || "Could not open this report bundle.");
      }
      setReports(data.reports || []);
      setPinRequired(false);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, [params.token]);

  useEffect(() => {
    loadBundle();
  }, [loadBundle]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="rounded border-2 border-amber-500 bg-amber-50 p-3 text-center font-bold text-amber-950">
        Private medical information — only open this link if the patient shared it with you.
      </div>
      <h1 className="mt-6 text-3xl font-bold text-teal-900">Shared medical reports bundle</h1>
      {loading && <p role="status" className="mt-4">Verifying secure multi-report QR link...</p>}
      {error && <p role="alert" className="mt-4 rounded bg-red-50 p-4 text-red-900">{error}</p>}
      {pinRequired && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            loadBundle(pin);
          }}
          className="mt-4 flex flex-wrap items-end gap-3 rounded border bg-white p-4"
        >
          <label>
            Share PIN
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              minLength={4}
              maxLength={6}
              pattern="[0-9]{4,6}"
              required
              className="mt-1 block rounded border px-3 py-2"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
          </label>
          <button disabled={loading} className="min-h-[44px] rounded bg-teal-800 px-4 py-2 font-bold text-white">
            Unlock reports
          </button>
        </form>
      )}
      {reports.length > 0 && (
        <div className="mt-5 space-y-4">
          {reports.map((report) => (
            <section key={report.id} className="rounded-lg border bg-white p-5">
              <p><strong>Patient:</strong> {report.patientName}</p>
              <p className="mt-1"><strong>Report:</strong> {report.reportType}</p>
              <p className="mt-1"><strong>Date:</strong> {report.reportDate}</p>
              <p className="mt-1"><strong>Doctor:</strong> {report.doctorName || "Not specified"}</p>
              {report.notes && <p className="mt-1"><strong>Notes:</strong> {report.notes}</p>}
              {report.downloadUrl && (
                <a
                  href={report.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex min-h-[44px] items-center rounded bg-teal-800 px-4 py-2 font-semibold text-white"
                >
                  View / Download report
                </a>
              )}
            </section>
          ))}
          <p className="text-xs text-slate-600">
            Secure download URLs expire shortly. Bundle share links can be revoked by the owner.
          </p>
        </div>
      )}
      <p className="mt-6 text-sm text-slate-600">Demo project, not a substitute for medical advice.</p>
    </main>
  );
}
