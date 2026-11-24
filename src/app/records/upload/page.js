"use client";

import { useRef, useState } from "react";
import QRCode from "qrcode";
import { getSupabaseBrowser } from "../../../lib/supabase/browser";

const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const maxFileSize = 20 * 1024 * 1024;

export default function UploadReportPage() {
  const [record, setRecord] = useState({ patientName: "", patientId: "", reportType: "Pathology", reportDate: new Date().toISOString().slice(0, 10), doctor: "", notes: "" });
  const [expiry, setExpiry] = useState("7d");
  const [sharePin, setSharePin] = useState("");
  const [savedId, setSavedId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [qrData, setQrData] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  function update(key, value) {
    setRecord((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    const file = fileRef.current?.files?.[0];
    if (!file || !allowedTypes.includes(file.type) || file.size > maxFileSize) {
      setError("Choose a PDF, JPEG, PNG, or WebP file smaller than 20 MB.");
      setBusy(false);
      return;
    }

    const supabase = getSupabaseBrowser();
    if (supabase) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (sessionError || !user) {
        setError("Sign in before uploading a private report.");
        setBusy(false);
        return;
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("medical-reports").upload(storagePath, file, {
        contentType: file.type,
        cacheControl: "0",
        upsert: false,
      });
      if (uploadError) {
        setError(`Private upload failed: ${uploadError.message}`);
        setBusy(false);
        return;
      }

      const reportResponse = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          patientName: record.patientName,
          reportType: record.reportType,
          reportDate: record.reportDate,
          doctor: record.doctor,
          notes: record.notes,
          storagePath,
          mimeType: file.type,
          pin: sharePin,
        }),
      });
      const reportResult = await reportResponse.json();
      if (!reportResponse.ok) {
        await supabase.storage.from("medical-reports").remove([storagePath]);
        setError(`Report metadata could not be saved: ${reportResult.error || "database error"}`);
        setBusy(false);
        return;
      }
      const report = reportResult.report;

      const shareResponse = await fetch("/api/reports/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ reportId: report.id, expiry, pin: sharePin }),
      });
      const shareResult = await shareResponse.json();
      if (!shareResponse.ok) {
        setSavedId(report.id);
        setError(shareResult.error || "Report uploaded privately, but its share QR could not be created.");
        setStatus("Report uploaded privately; share QR could not be created. Check integration setup and try again.");
        setBusy(false);
        return;
      }
      setSavedId(report.id);
      setShareUrl(shareResult.url);
      setQrData(await QRCode.toDataURL(shareResult.url));
      setSharePin("");
      setStatus(`Private report uploaded. Secure share link expires ${expiry === "never" ? "never" : `in ${expiry}`}.`);
      setBusy(false);
      return;
    }

    const id = `${record.patientId || "demo"}-${Date.now()}`;
    const demoReport = { ...record, id, uploadedAt: new Date().toISOString(), fileName: file.name, demo: true };
    const reports = JSON.parse(localStorage.getItem("healthx_demo_reports") || "[]");
    localStorage.setItem("healthx_demo_reports", JSON.stringify([demoReport, ...reports]));
    setSavedId(id);
    setStatus("Supabase is not configured. Only report metadata was saved in this browser; the file was not uploaded and no shareable QR was generated.");
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold text-teal-900">Medical Report Upload</h1>
      <p className="mt-2 text-slate-600">Configured accounts upload to private storage. QR codes contain only a random, revocable share URL.</p>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <form onSubmit={submit} className="space-y-4 rounded-lg border bg-white p-5">
          <label className="block">Patient name<input required autoComplete="name" className="mt-1 w-full rounded border px-3 py-2" value={record.patientName} onChange={(event) => update("patientName", event.target.value)} /></label>
          <label className="block">Patient ID (demo fallback)<input className="mt-1 w-full rounded border px-3 py-2" value={record.patientId} onChange={(event) => update("patientId", event.target.value)} /></label>
          <label className="block">Report type<select className="mt-1 w-full rounded border px-3 py-2" value={record.reportType} onChange={(event) => update("reportType", event.target.value)}><option>Pathology</option><option>Radiology</option><option>Cardiology</option><option>Neurology</option><option>Prescription</option></select></label>
          <label className="block">Report date<input required type="date" className="mt-1 w-full rounded border px-3 py-2" value={record.reportDate} onChange={(event) => update("reportDate", event.target.value)} /></label>
          <label className="block">Doctor name<input className="mt-1 w-full rounded border px-3 py-2" value={record.doctor} onChange={(event) => update("doctor", event.target.value)} /></label>
          <label className="block">Notes<textarea className="mt-1 w-full rounded border px-3 py-2" value={record.notes} onChange={(event) => update("notes", event.target.value)} /></label>
          <label className="block">Report PDF or image<input required ref={fileRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="mt-1 w-full" /></label>
          <label className="block">Share link expiry<select className="mt-1 w-full rounded border px-3 py-2" value={expiry} onChange={(event) => setExpiry(event.target.value)}><option value="24h">24 hours</option><option value="7d">7 days</option><option value="never">Never (revocable)</option></select></label>
          <label className="block">Optional share PIN (4-6 digits)<input type="password" inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} autoComplete="new-password" className="mt-1 w-full rounded border px-3 py-2" value={sharePin} onChange={(event) => setSharePin(event.target.value)} /></label>
          <button disabled={busy} className="rounded bg-teal-800 px-4 py-2 font-semibold text-white disabled:opacity-60">{busy ? "Uploading..." : "Upload private report"}</button>
          {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-900">{error}</p>}
          {status && <p role="status" className="rounded bg-green-50 p-3 text-green-900">{status}</p>}
        </form>
        <div>
          {qrData ? (
            <section className="rounded border bg-white p-5 text-center">
              <h2 className="font-bold">Secure report QR</h2>
              <img src={qrData} alt="QR code containing the secure report share link" className="mx-auto mt-3 h-48 w-48" />
              <a href={shareUrl} className="mt-3 block break-all text-sm text-teal-900 underline">{shareUrl}</a>
              <p className="mt-3 text-xs text-slate-600">The QR contains no patient or report data.</p>
            </section>
          ) : savedId ? (
            <section className="rounded border bg-amber-50 p-5 text-amber-950">
              <h2 className="font-bold">Shareable QR unavailable</h2>
              <p className="mt-2 text-sm">{status || "Configure Supabase and APP_BASE_URL to create a secure report share QR."}</p>
              <a href="/admin/setup-status" className="mt-3 inline-block font-semibold underline">Check integration setup</a>
            </section>
          ) : (
            <div className="rounded border border-dashed p-8 text-center text-slate-600">Upload a report to get a private-storage share QR.</div>
          )}
          {savedId && (
            <p className="mt-3 text-sm">
              Report ID: {savedId} · <a href="/records" className="font-semibold underline">My Reports (create 1 QR for multiple reports)</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
