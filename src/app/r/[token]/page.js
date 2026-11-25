"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export default function PublicSharedReport({ params }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pinRequired, setPinRequired] = useState(false);
  const [pin, setPin] = useState("");
  const autoDownloadedRef = useRef(false);

  const loadReport = useCallback(async (suppliedPin = "") => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/reports/share/${encodeURIComponent(params.token)}`, {
        cache: "no-store",
        headers: suppliedPin ? { "x-report-pin": suppliedPin } : {},
      });
      const data = await response.json();
      if (!response.ok) {
        setPinRequired(Boolean(data.pinRequired));
        throw new Error(data.error || "Could not open this report.");
      }
      setReport(data.report);
      setPinRequired(false);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, [params.token]);

  useEffect(() => { loadReport(); }, [loadReport]);

  useEffect(() => {
    if (!report?.downloadUrl || autoDownloadedRef.current || typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    if (search.get("download") === "1") {
      autoDownloadedRef.current = true;
      const link = document.createElement("a");
      link.href = report.downloadUrl;
      link.download = `swasth-report-${report.id || "shared"}.pdf`;
      link.click();
    }
  }, [report]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="rounded border-2 border-amber-500 bg-amber-50 p-3 text-center font-bold text-amber-950">Private medical information — only open this link if the patient shared it with you.</div>
      <h1 className="mt-6 text-3xl font-bold text-teal-900">Shared medical report</h1>
      {loading && <p role="status" className="mt-4">Verifying secure share link...</p>}
      {error && <p role="alert" className="mt-4 rounded bg-red-50 p-4 text-red-900">{error}</p>}
      {pinRequired && <form onSubmit={(event) => { event.preventDefault(); loadReport(pin); }} className="mt-4 flex flex-wrap items-end gap-3 rounded border bg-white p-4"><label>Share PIN<input inputMode="numeric" autoComplete="one-time-code" minLength={4} maxLength={6} pattern="[0-9]{4,6}" required className="mt-1 block rounded border px-3 py-2" value={pin} onChange={(event) => setPin(event.target.value)} /></label><button disabled={loading} className="rounded bg-teal-800 px-4 py-2 text-white">Unlock report</button></form>}
      {report && (
        <section className="mt-5 rounded-lg border bg-white p-5">
          <p><strong>Patient:</strong> {report.patientName}</p>
          <p className="mt-2"><strong>Report:</strong> {report.reportType}</p>
          <p className="mt-2"><strong>Date:</strong> {report.reportDate}</p>
          <p className="mt-2"><strong>Doctor:</strong> {report.doctorName || "Not specified"}</p>
          {report.notes && <p className="mt-2"><strong>Notes:</strong> {report.notes}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={report.downloadUrl} download={`swasth-report-${report.id || "shared"}.pdf`} className="inline-block rounded bg-teal-800 px-4 py-2 font-semibold text-white">Download Report</a>
            <a href={report.downloadUrl} target="_blank" rel="noreferrer" className="inline-block rounded border border-teal-800 px-4 py-2 font-semibold text-teal-900">Open in browser</a>
          </div>
          <p className="mt-3 text-xs text-slate-600">The secure download URL expires shortly. Share links can be revoked by the report owner.</p>
        </section>
      )}
      <p className="mt-6 text-sm text-slate-600">Swasth Saathi Care Portal — not a substitute for professional medical advice.</p>
    </div>
  );
}
