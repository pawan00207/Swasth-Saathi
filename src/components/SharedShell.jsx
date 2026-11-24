"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SaarthiChat from "../features/chat/SaarthiChat";
import SosFloatingWidget from "../features/sos/SosFloatingWidget";
import AccessibleModal from "./AccessibleModal";
import { useI18n } from "./I18nProvider";

const navItems = [
  ["nav.schemes", "/schemes"],
  ["nav.qrReports", "/records/upload"],
  ["nav.myReports", "/records"],
  ["nav.account", "/auth"],
  ["nav.appointments", "/appointments"],
  ["nav.billing", "/billing"],
  ["nav.route", "/route"],
  ["nav.consult", "/consult"],
  ["nav.beds", "/beds"],
  ["nav.sos", "/sos"],
  ["nav.blockchain", "/blockchain"],
];

export default function SharedShell({ children }) {
  const { language, setLanguage, t, languages } = useI18n();
  const [role, setRole] = useState("Patient");
  const [showStatus, setShowStatus] = useState(false);
  const [bedStatus, setBedStatus] = useState("Checking");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionNote, setCorrectionNote] = useState("");
  const [correctionPage, setCorrectionPage] = useState("");
  const [correctionSaved, setCorrectionSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("healthx_demo_role");
    if (saved) setRole(saved);
    fetch("/api/hospitals", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setBedStatus(data.source === "live-hms" ? "Live HMS" : "Demo fallback"))
      .catch(() => setBedStatus("Demo fallback"));
  }, []);

  function changeRole(event) {
    const next = event.target.value;
    setRole(next);
    localStorage.setItem("healthx_demo_role", next);
  }

  function submitTranslationCorrection(event) {
    event.preventDefault();
    if (!correctionNote.trim()) return;
    try {
      const existing = JSON.parse(localStorage.getItem("swasth_translation_suggestions") || "[]");
      localStorage.setItem(
        "swasth_translation_suggestions",
        JSON.stringify([
          {
            language,
            page: correctionPage || (typeof window !== "undefined" ? window.location.pathname : "/"),
            suggestion: correctionNote.trim(),
            createdAt: new Date().toISOString(),
          },
          ...existing.slice(0, 19),
        ]),
      );
    } catch {
      // Ignore storage errors
    }
    setCorrectionNote("");
    setCorrectionSaved(true);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-teal-900 bg-teal-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-xl font-bold focus:outline-none focus:ring-2 focus:ring-white">
            {t("appName")}
          </Link>
          <nav aria-label="Main navigation" className="flex flex-wrap gap-2">
            {navItems.map(([key, href]) => (
              <Link key={href} href={href} className="rounded px-2 py-1 text-sm hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-white">
                {t(key)}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span>{t("shell.language")}</span>
              <select
                aria-label={t("shell.language")}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="min-h-[36px] rounded border border-white bg-teal-950 px-2 py-1 text-white"
              >
                {languages.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.nativeLabel} ({item.code.toUpperCase()})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span>{t("shell.demoRole")}</span>
              <select value={role} onChange={changeRole} className="min-h-[36px] rounded border border-white bg-teal-950 px-2 py-1 text-white">
                <option>Patient</option>
                <option>Doctor</option>
                <option>Hospital Admin</option>
              </select>
            </label>
          </div>
        </div>
        <div className="bg-amber-300 px-4 py-2 text-center text-sm text-amber-950" role="status">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <span className="font-semibold">
              {t("shell.banner")}
            </span>
            <button
              type="button"
              aria-expanded={showStatus}
              aria-controls="integration-status"
              onClick={() => setShowStatus((visible) => !visible)}
              className="shrink-0 rounded border border-amber-950 px-2 py-1 font-bold hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-950"
            >
              {showStatus ? t("shell.hideStatus") : t("shell.viewStatus")}
            </button>
          </div>
          {showStatus && (
            <div id="integration-status" className="mx-auto mt-2 grid max-w-7xl gap-2 rounded border border-amber-700 bg-amber-100 p-3 text-left sm:grid-cols-2 lg:grid-cols-5">
              <span><strong>Schemes:</strong> Live demo catalogue</span>
              <span><strong>Routing:</strong> Live demo route</span>
              <span><strong>Beds:</strong> {bedStatus}</span>
              <span><strong>Reports:</strong> Live demo OCR/DWN</span>
              <span><strong>Doctors:</strong> Live demo directory</span>
            </div>
          )}
        </div>
        {language !== "en" && (
          <div className="border-t border-teal-800 bg-teal-900 px-4 py-1.5 text-center text-xs text-teal-50">
            <span>{t("shell.machineTranslated")} </span>
            <button
              type="button"
              onClick={() => {
                setCorrectionSaved(false);
                setCorrectionPage(typeof window !== "undefined" ? window.location.pathname : "/");
                setCorrectionOpen(true);
              }}
              className="ml-1 font-bold underline hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-white"
            >
              {t("shell.suggestCorrection")}
            </button>
          </div>
        )}
      </header>
      <main className="pb-20">{children}</main>
      <footer className="border-t bg-white px-4 py-4 text-center text-sm text-slate-700">
        {t("shell.footerDisclaimer")}
      </footer>
      <SosFloatingWidget />
      <SaarthiChat />

      <AccessibleModal
        open={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
        titleId="translation-correction-title"
        title={t("shell.suggestCorrection")}
      >
        <form onSubmit={submitTranslationCorrection} className="space-y-3">
          <p className="text-sm text-slate-700">
            Language: <strong>{language.toUpperCase()}</strong>
          </p>
          <label className="block text-sm font-semibold">
            Page / Section
            <input
              type="text"
              className="mt-1 min-h-[44px] w-full rounded border border-slate-400 px-3 py-2"
              value={correctionPage}
              onChange={(e) => setCorrectionPage(e.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold">
            Incorrect text and suggested improvement
            <textarea
              required
              rows={3}
              className="mt-1 w-full rounded border border-slate-400 px-3 py-2"
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
            />
          </label>
          {correctionSaved && (
            <p role="status" className="rounded bg-green-50 p-2 text-sm font-semibold text-green-900">
              {t("shell.correctionSubmitted")}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" className="min-h-[44px] rounded bg-teal-800 px-4 py-2 font-bold text-white">
              Submit
            </button>
            <button
              type="button"
              onClick={() => setCorrectionOpen(false)}
              className="min-h-[44px] rounded border border-slate-400 px-4 py-2 font-semibold"
            >
              Close
            </button>
          </div>
        </form>
      </AccessibleModal>
    </div>
  );
}
