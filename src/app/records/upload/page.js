"use client";

import { useRef, useState } from "react";
import QRCode from "qrcode";
import RecordQr from "../../../features/records-qr/RecordQr";
import { ensureSupabaseBrowser, fetchPublicConfig } from "../../../lib/supabase/browser";
import { resolveClientPublicOrigin } from "../../../lib/url";

const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const maxFileSize = 20 * 1024 * 1024;

export default function UploadReportPage() {
  const [record, setRecord] = useState({ patientName: "", patientId: "", reportType: "Pathology", reportDate: new Date().toISOString().slice(0, 10), doctor: "", notes: "" });
  const [expiry, setExpiry] = useState("7d");
  const [sharePin, setSharePin] = useState("");
  const [savedId, setSavedId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
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

    const cfg = await fetchPublicConfig().catch(() => null);
    const publicOrigin = resolveClientPublicOrigin(cfg?.appBaseUrl);

    const supabase = await ensureSupabaseBrowser();
    if (supabase) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!sessionError && user) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("medical-reports").upload(storagePath, file, {
          contentType: file.type,
          cacheControl: "0",
          upsert: false,
        });
        if (!uploadError) {
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
          const reportResult = await reportResponse.json().catch(() => ({}));
          if (reportResponse.ok && reportResult.report?.id) {
            const report = reportResult.report;
            const shareResponse = await fetch("/api/reports/share", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionData.session.access_token}`,
              },
              body: JSON.stringify({ reportId: report.id, expiry, pin: sharePin }),
            });
            const shareResult = await shareResponse.json().catch(() => ({}));
            if (shareResponse.ok && shareResult.url) {
              const finalUrl = sharePin ? shareResult.url : `${shareResult.url}${shareResult.url.includes("?") ? "&" : "?"}download=1`;
              setSavedId(report.id);
              setShareUrl(finalUrl);
              setDownloadUrl(`${publicOrigin}/api/reports/download/${encodeURIComponent(report.id)}`);
              setQrData(await QRCode.toDataURL(finalUrl));
              setSharePin("");
              setStatus(`Private report uploaded. Scanning the QR downloads the report${sharePin ? " after PIN unlock" : ""}.`);
              setBusy(false);
              return;
            }
          } else {
            await supabase.storage.from("medical-reports").remove([storagePath]).catch(() => {});
          }
        }
      }
    }

    // Cross-device server vault upload so scanning the QR on any phone directly downloads the report
    const generatedId = `${(record.patientId || "REC").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16) || "REC"}-${Date.now().toString(36).toUpperCase()}`;
    try {
      const formData = new FormData();
      formData.append("id", generatedId);
      formData.append("patientName", record.patientName);
      formData.append("patientId", record.patientId);
      formData.append("reportType", record.reportType);
      formData.append("reportDate", record.reportDate);
      formData.append("doctor", record.doctor);
      formData.append("notes", record.notes);
      formData.append("file", file);

      const vaultRes = await fetch("/api/reports/vault", {
        method: "POST",
        body: formData,
      });
      const vaultData = await vaultRes.json();
      if (!vaultRes.ok) {
        throw new Error(vaultData.error || "Could not upload report.");
      }

      const savedReport = { ...record, id: generatedId, uploadedAt: new Date().toISOString(), fileName: file.name };
      const reports = JSON.parse(localStorage.getItem("swasth_care_vault_reports") || "[]");
      localStorage.setItem("swasth_care_vault_reports", JSON.stringify([savedReport, ...reports]));

      const targetDownloadUrl = `${publicOrigin}/api/reports/download/${encodeURIComponent(generatedId)}`;
      setSavedId(generatedId);
      setShareUrl(targetDownloadUrl);
      setDownloadUrl(targetDownloadUrl);
      setQrData(await QRCode.toDataURL(targetDownloadUrl));
      setStatus("Report uploaded to Care Vault. Scan the QR from any device to download the report directly.");
    } catch (err) {
      setError(err.message || "Could not upload report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold text-teal-900">Medical Report Upload</h1>
      <p className="mt-2 text-slate-600">Upload medical reports and generate a scannable QR code that downloads the report directly on any device.</p>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <form onSubmit={submit} className="space-y-4 rounded-lg border bg-white p-5">
          <label className="block">Patient name<input required autoComplete="name" className="mt-1 w-full rounded border px-3 py-2" value={record.patientName} onChange={(event) => update("patientName", event.target.value)} /></label>
          <label className="block">Patient / ABHA ID (optional)<input className="mt-1 w-full rounded border px-3 py-2" value={record.patientId} onChange={(event) => update("patientId", event.target.value)} /></label>
          <label className="block">Report type<select className="mt-1 w-full rounded border px-3 py-2" value={record.reportType} onChange={(event) => update("reportType", event.target.value)}><option>Pathology</option><option>Radiology</option><option>Cardiology</option><option>Neurology</option><option>Prescription</option></select></label>
          <label className="block">Report date<input required type="date" className="mt-1 w-full rounded border px-3 py-2" value={record.reportDate} onChange={(event) => update("reportDate", event.target.value)} /></label>
          <label className="block">Doctor name<input className="mt-1 w-full rounded border px-3 py-2" value={record.doctor} onChange={(event) => update("doctor", event.target.value)} /></label>
          <label className="block">Notes<textarea className="mt-1 w-full rounded border px-3 py-2" value={record.notes} onChange={(event) => update("notes", event.target.value)} /></label>
          <label className="block">Report PDF or image<input required ref={fileRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="mt-1 w-full" /></label>
          <label className="block">Share link expiry<select className="mt-1 w-full rounded border px-3 py-2" value={expiry} onChange={(event) => setExpiry(event.target.value)}><option value="24h">24 hours</option><option value="7d">7 days</option><option value="never">Never (revocable)</option></select></label>
          <label className="block">Optional share PIN (4-6 digits)<input type="password" inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} autoComplete="new-password" className="mt-1 w-full rounded border px-3 py-2" value={sharePin} onChange={(event) => setSharePin(event.target.value)} /></label>
          <button disabled={busy} className="rounded bg-teal-800 px-4 py-2 font-semibold text-white disabled:opacity-60">{busy ? "Uploading..." : "Upload & generate QR"}</button>
          {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-900">{error}</p>}
          {status && <p role="status" className="rounded bg-green-50 p-3 text-green-900">{status}</p>}
        </form>
        <div>
          {qrData ? (
            <section className="rounded border bg-white p-5 text-center">
              <h2 className="font-bold">Scannable Report Download QR</h2>
              <img src={qrData} alt="QR code to download the uploaded medical report" className="mx-auto mt-3 h-48 w-48" />
              <a href={shareUrl} download className="mt-3 block break-all text-sm font-medium text-teal-900 underline">{shareUrl}</a>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <a href={downloadUrl || shareUrl} download className="rounded bg-teal-800 px-3 py-2 text-sm font-semibold text-white">Download Report</a>
                <a href={qrData} download={`swasth-qr-${savedId}.png`} className="rounded border px-3 py-2 text-sm">Save QR PNG</a>
              </div>
              <p className="mt-3 text-xs text-slate-600">Scanning this QR with any phone camera opens the public URL and downloads the report.</p>
            </section>
          ) : savedId ? (
            <div className="rounded border bg-white p-5">
              <RecordQr recordId={savedId} />
            </div>
          ) : (
            <div className="rounded border border-dashed p-8 text-center text-slate-600">Upload a report to get a scannable download QR.</div>
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
