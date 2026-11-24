"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";
import { getSupabaseBrowser } from "../../lib/supabase/browser";
import { generatePdf } from "../../lib/generatePdf";
import { useI18n } from "../../components/I18nProvider";

export default function MyReportsPage() {
  const { language, t } = useI18n();
  const [reports, setReports] = useState([]);
  const [shares, setShares] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [selectedReportIds, setSelectedReportIds] = useState([]);
  const [shareQr, setShareQr] = useState(null);
  const [expiry, setExpiry] = useState("7d");
  const [sharePin, setSharePin] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setReports(JSON.parse(localStorage.getItem("healthx_demo_reports") || "[]"));
      setMessage("Demo mode: private reports require Supabase Auth/Storage and Prisma Postgres setup.");
      setLoading(false);
      return;
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      setError(sessionError.message);
      setLoading(false);
      return;
    }
    const currentUser = sessionData.session?.user;
    setUser(currentUser || null);
    if (!currentUser) {
      setLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${sessionData.session.access_token}` };
    const [response, bundleRes] = await Promise.all([
      fetch("/api/reports", { headers, cache: "no-store" }),
      fetch("/api/reports/bundle", { headers, cache: "no-store" }),
    ]);
    const result = await response.json();
    if (!response.ok) setError(result.error || "Could not load reports.");
    else {
      setReports(result.reports || []);
      setShares(result.shares || []);
      setEmergencyContact(result.emergencyContact || "");
    }
    if (bundleRes.ok) {
      const bundleResult = await bundleRes.json();
      setBundles(bundleResult.bundles || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createShare(report) {
    setSharing(true);
    setError("");
    try {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sign in again to create a share link.");
      const response = await fetch("/api/reports/share", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ reportId: report.id, expiry, pin: sharePin }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create secure report link.");
      setShareQr({
        reportId: report.id,
        label: "Secure share QR",
        url: result.url,
        qr: await QRCode.toDataURL(result.url),
        pinProtected: Boolean(sharePin),
      });
      setSharePin("");
      await load();
    } catch (reason) {
      setError(reason.message || "Could not create secure report link.");
    } finally {
      setSharing(false);
    }
  }

  async function createBundleShare() {
    if (selectedReportIds.length === 0) {
      setError("Select at least one report to combine into 1 QR.");
      return;
    }
    setSharing(true);
    setError("");
    try {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sign in again to create a bundle QR.");
      const response = await fetch("/api/reports/bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ reportIds: selectedReportIds, expiry, pin: sharePin }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create multi-report bundle QR.");
      setShareQr({
        reportId: "bundle",
        label: `Multi-Report Bundle QR (${result.reportCount} reports in 1 QR)`,
        url: result.url,
        qr: await QRCode.toDataURL(result.url),
        pinProtected: Boolean(sharePin),
      });
      setSharePin("");
      setSelectedReportIds([]);
      setMessage(`1 combined QR generated for ${result.reportCount} report(s).`);
      await load();
    } catch (reason) {
      setError(reason.message || "Could not create multi-report bundle QR.");
    } finally {
      setSharing(false);
    }
  }

  async function revokeBundle(bundleId) {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    const response = await fetch(`/api/reports/bundle/${encodeURIComponent(bundleId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    if (!response.ok) {
      const result = await response.json();
      setError(result.error || "Could not revoke bundle link.");
      return;
    }
    setMessage("Multi-report bundle link revoked.");
    await load();
  }

  async function revokeShare(shareId) {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    const response = await fetch(`/api/reports/share/${encodeURIComponent(shareId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Could not revoke share link.");
      return;
    }
    setMessage("Share link revoked.");
    await load();
  }

  async function downloadReport(report) {
    const supabase = getSupabaseBrowser();
    const { data, error: downloadError } = await supabase.storage
      .from("medical-reports")
      .createSignedUrl(report.storage_path, 60);
    if (downloadError) {
      setError(`Could not prepare report download: ${downloadError.message}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function downloadSummary(report) {
    try {
      await generatePdf({
        fileName: `${report.patient_name || report.patientName}-report-summary.pdf`,
        title: "Medical report summary",
        locale: language,
        watermark: report.demo || report.mock ? "DEMO SUMMARY - NOT MEDICAL ADVICE" : "Private report summary",
        draw: (document, fontFamily) => {
          document.setFont(fontFamily);
          document.setFontSize(12);
          document.text(`Patient: ${report.patient_name || report.patientName}`, 16, 44);
          document.text(`Report type: ${report.report_type || report.reportType}`, 16, 56);
          document.text(`Report date: ${report.report_date || report.uploadedAt}`, 16, 68);
          document.text(`Doctor: ${report.doctor_name || report.doctor || "Not specified"}`, 16, 80);
          document.text(`Notes: ${report.notes || "No notes provided."}`, 16, 96, { maxWidth: 175 });
          document.setFontSize(9);
          document.text("This summary contains metadata only. Open the secure report link to view the original file.", 16, 130, { maxWidth: 175 });
          document.text("Demo project, not a substitute for medical advice.", 16, 145, { maxWidth: 175 });
        },
      });
    } catch (reason) {
      console.error("Could not generate report summary", reason);
      setError("Could not generate report summary PDF. Please try again.");
    }
  }

  async function saveEmergencyContact() {
    const supabase = getSupabaseBrowser();
    if (!supabase || !user) return;
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
      body: JSON.stringify({ emergencyContact }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Emergency contact saved." : result.error || "Could not save contact.");
  }

  async function walletCard(report) {
    try {
      const qr = shareQr?.reportId === report.id || shareQr?.reportId === "bundle" ? shareQr.qr : null;
      await generatePdf({
        fileName: `${report.patient_name || report.patientName}-emergency-card.pdf`,
        title: "Emergency wallet card",
        locale: language,
        watermark: "Keep this card with you. Demo project, not medical advice.",
        draw: (document, fontFamily) => {
          document.setFont(fontFamily);
          document.setFontSize(15);
          document.text(`Patient: ${report.patient_name || report.patientName}`, 16, 45);
          document.text(`Emergency contact: ${emergencyContact || "Add a contact in My Reports"}`, 16, 58, { maxWidth: 175 });
          if (qr) document.addImage(qr, "PNG", 85, 90, 40, 40);
          document.setFontSize(9);
          document.text(qr ? "QR opens the secure report share link." : "Create a secure share link to include its QR.", 16, 150);
        },
      });
    } catch (reason) {
      console.error("Could not generate emergency wallet card", reason);
      setError("Could not generate the wallet card PDF. Please try again.");
    }
  }

  function toggleReportSelect(id) {
    setSelectedReportIds((curr) => (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]));
  }

  const privateReports = reports.filter((r) => !(r.demo || r.mock));

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-10" role="status">Loading your reports...</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold text-teal-900">My Reports</h1>
      {!user && getSupabaseBrowser() && (
        <p className="mt-3 rounded bg-amber-50 p-3">
          Sign in to see private reports. <a className="font-bold underline" href="/auth">Sign in</a>
        </p>
      )}
      {message && <p role="status" className="mt-3 rounded bg-green-50 p-3 text-green-900">{message}</p>}
      {error && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-red-900">{error}</p>}

      {user && (
        <section className="mt-5 rounded-lg border bg-white p-4">
          <label className="block">
            Emergency contact for wallet card
            <input
              className="mt-1 w-full max-w-md rounded border px-3 py-2"
              value={emergencyContact}
              onChange={(event) => setEmergencyContact(event.target.value)}
            />
          </label>
          <button onClick={saveEmergencyContact} className="mt-3 rounded border border-teal-800 px-3 py-2 text-teal-900">
            Save contact
          </button>
        </section>
      )}

      {user && (
        <div className="mt-5 grid max-w-xl gap-3 sm:grid-cols-2">
          <label>
            New link expiry
            <select className="mt-1 w-full rounded border px-3 py-2" value={expiry} onChange={(event) => setExpiry(event.target.value)}>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
              <option value="never">Never (revocable)</option>
            </select>
          </label>
          <label>
            Optional numeric PIN (4-6 digits)
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              minLength={4}
              maxLength={6}
              autoComplete="new-password"
              className="mt-1 w-full rounded border px-3 py-2"
              value={sharePin}
              onChange={(event) => setSharePin(event.target.value)}
            />
          </label>
        </div>
      )}

      {/* Multi-report 1-QR bundle bar */}
      {user && privateReports.length > 0 && (
        <section className="mt-5 rounded-xl border border-teal-700 bg-teal-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-teal-950">
                <QrCode className="h-4 w-4" aria-hidden="true" />
                <span>{t("reports.multiQrTitle")}</span>
              </h2>
              <p className="text-xs text-slate-700">
                {t("reports.selectReports")} ({selectedReportIds.length} selected)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedReportIds(
                    selectedReportIds.length === privateReports.length ? [] : privateReports.map((r) => r.id),
                  )
                }
                className="min-h-[40px] rounded border border-teal-800 bg-white px-3 py-1.5 text-xs font-bold text-teal-900"
              >
                {selectedReportIds.length === privateReports.length ? "Clear selection" : "Select all"}
              </button>
              <button
                type="button"
                disabled={sharing || selectedReportIds.length === 0}
                onClick={createBundleShare}
                className="min-h-[40px] rounded bg-teal-800 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
              >
                {sharing ? "Generating..." : t("reports.generateBundleQr")}
              </button>
            </div>
          </div>

          {bundles.filter((b) => !b.revokedAt).length > 0 && (
            <div className="mt-3 space-y-2">
              {bundles
                .filter((b) => !b.revokedAt)
                .map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-white p-2.5 text-xs">
                    <span>
                      Bundle of <strong>{b.reportIds.length}</strong> reports ·{" "}
                      {b.expiresAt ? `expires ${new Date(b.expiresAt).toLocaleString()}` : "no expiry"} · {b.viewCount} views
                    </span>
                    <button
                      type="button"
                      onClick={() => revokeBundle(b.id)}
                      className="rounded border border-red-700 px-2.5 py-1 font-bold text-red-900"
                    >
                      Revoke bundle
                    </button>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {shareQr && (
        <section className="mt-5 flex flex-wrap items-center gap-4 rounded-lg border bg-white p-4">
          <img src={shareQr.qr} alt="Secure report QR code" className="h-36 w-36" />
          <div>
            <h2 className="font-bold">{shareQr.label || "Secure share QR"}</h2>
            <p className="mt-2 break-all text-sm">{shareQr.url}</p>
            <p className="mt-2 text-xs text-slate-600">
              QR contains only the random share URL.{shareQr.pinProtected ? " Share the PIN with the recipient separately." : ""}
            </p>
          </div>
        </section>
      )}

      <div className="mt-6 space-y-4">
        {reports.map((report) => {
          const reportId = report.id;
          const reportShares = shares.filter((share) => share.report_id === reportId);
          const demo = report.demo || report.mock;
          const checked = selectedReportIds.includes(reportId);
          return (
            <article key={reportId} className="rounded-lg border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {!demo && user && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${report.patient_name || report.patientName} ${report.report_type || report.reportType} for bundle QR`}
                      checked={checked}
                      onChange={() => toggleReportSelect(reportId)}
                      className="mt-1 h-5 w-5"
                    />
                  )}
                  <div>
                    <h2 className="text-lg font-bold">
                      {report.patient_name || report.patientName} · {report.report_type || report.reportType}
                    </h2>
                    <p className="text-sm text-slate-600">
                      {report.report_date || report.uploadedAt} · {report.doctor_name || report.doctor || "Doctor not specified"}
                    </p>
                  </div>
                </div>
                <span className="rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-950">
                  {demo ? "DEMO" : "PRIVATE"}
                </span>
              </div>
              {report.notes && <p className="mt-2 text-sm">{report.notes}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {!demo && (
                  <button onClick={() => downloadReport(report)} className="rounded border px-3 py-2">
                    Download report
                  </button>
                )}
                <button onClick={() => downloadSummary(report)} className="rounded border px-3 py-2">
                  Download summary PDF
                </button>
                {!demo && (
                  <button disabled={sharing} onClick={() => createShare(report)} className="rounded bg-teal-800 px-3 py-2 text-white disabled:opacity-60">
                    {sharing ? "Creating link..." : "Generate / regenerate QR"}
                  </button>
                )}
                <button onClick={() => walletCard(report)} className="rounded border px-3 py-2">
                  Print wallet card PDF
                </button>
              </div>
              {reportShares
                .filter((share) => !share.revoked_at)
                .map((share) => (
                  <div key={share.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 p-3 text-sm">
                    <span>
                      Share link · {share.expires_at ? `expires ${new Date(share.expires_at).toLocaleString()}` : "no expiry"} · {share.view_count} views
                    </span>
                    <button onClick={() => revokeShare(share.id)} className="rounded border border-red-700 px-3 py-1 text-red-900">
                      Revoke link
                    </button>
                  </div>
                ))}
            </article>
          );
        })}
        {reports.length === 0 && (
          <p className="rounded border border-dashed p-8 text-center text-slate-600">No reports yet. Upload one to get started.</p>
        )}
      </div>
      <p className="mt-6 text-sm text-slate-600">Demo project, not a substitute for medical advice.</p>
    </div>
  );
}
