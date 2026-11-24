"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HeartPulse } from "lucide-react";
import SaarthiChat from "../features/chat/SaarthiChat";
import SosFloatingWidget from "../features/sos/SosFloatingWidget";
import AccessibleModal from "./AccessibleModal";
import { useI18n } from "./I18nProvider";
import VoiceCommandBar from "./VoiceCommandBar";
import { fetchPublicConfig } from "../lib/supabase/browser";

const navItems = [
  ["nav.patient", "/patient", "Patient Hub"],
  ["nav.schemes", "/schemes", "Schemes"],
  ["nav.beds", "/beds", "Bed Availability"],
  ["nav.billing", "/billing", "Care Wallet"],
  ["nav.abdm", "/abdm", "ABDM / ABHA"],
  ["nav.route", "/route", "Accessible Route"],
  ["nav.consult", "/consult", "Teleconsult"],
  ["nav.appointments", "/appointments", "Appointments"],
  ["nav.myReports", "/records", "My Reports"],
  ["nav.qrReports", "/records/upload", "QR Reports"],
  ["nav.sos", "/sos", "SOS & Profile"],
  ["nav.blockchain", "/blockchain", "Blockchain"],
  ["nav.account", "/auth", "Account"],
];

export default function SharedShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { language, setLanguage, t, languages } = useI18n();
  const [role, setRole] = useState("Patient");
  const [showStatus, setShowStatus] = useState(false);
  const [bedStatus, setBedStatus] = useState("Checking");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionNote, setCorrectionNote] = useState("");
  const [correctionPage, setCorrectionPage] = useState("");
  const [correctionSaved, setCorrectionSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("swasth_active_role");
    if (saved) setRole(saved);
    fetchPublicConfig().catch(() => {});
    fetch("/api/hospitals", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setBedStatus(data.source === "live-hms" ? "Live HMS" : "Synced Network"))
      .catch(() => setBedStatus("Synced Network"));
  }, []);

  function changeRole(event) {
    const next = event.target.value;
    setRole(next);
    localStorage.setItem("swasth_active_role", next);
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
    <div className="swasth-canvas min-h-screen text-slate-900 flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-700 rounded-lg px-1"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal-800 text-white">
              <HeartPulse className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>{t("appName")}</span>
          </Link>

          <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-1">
            {navItems.map(([key, href, fallback]) => {
              const label = t(key);
              const display = label === key ? fallback : label;
              const active = pathname === href || (href !== "/" && pathname?.startsWith(`${href}/`));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-teal-700 ${
                    active
                      ? "bg-teal-900 text-white"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  {display}
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <VoiceCommandBar variant="header" onNavigate={(url) => router.push(url)} />
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <span className="sr-only">{t("shell.language")}</span>
              <select
                aria-label={t("shell.language")}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900"
              >
                {languages.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.nativeLabel} ({item.code.toUpperCase()})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <span className="sr-only">{t("shell.activeRole") === "shell.activeRole" ? "Active role" : t("shell.activeRole")}</span>
              <select
                aria-label="Active role"
                value={role}
                onChange={changeRole}
                className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900"
              >
                <option>Patient</option>
                <option>Doctor</option>
                <option>Hospital Admin</option>
              </select>
            </label>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-teal-950 px-4 py-1.5 text-xs text-teal-50" role="status">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <span className="font-medium tracking-wide">{t("shell.banner")}</span>
            <button
              type="button"
              aria-expanded={showStatus}
              aria-controls="integration-status"
              onClick={() => setShowStatus((visible) => !visible)}
              className="shrink-0 rounded border border-teal-700 bg-teal-900 px-2.5 py-0.5 text-xs font-semibold text-teal-50 hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-white"
            >
              {showStatus ? t("shell.hideStatus") : t("shell.viewStatus")}
            </button>
          </div>
          {showStatus && (
            <div id="integration-status" className="mx-auto mt-2 grid max-w-7xl gap-2 rounded-lg border border-teal-800 bg-slate-900 p-3 text-left text-teal-50 sm:grid-cols-2 lg:grid-cols-5">
              <span><strong>Schemes:</strong> Live PM-JAY / MyScheme</span>
              <span><strong>Routing:</strong> Live OSRM / OSM</span>
              <span><strong>Beds:</strong> {bedStatus}</span>
              <span><strong>Reports:</strong> ABDM &amp; Care Vault</span>
              <span><strong>Doctors:</strong> NMC Verified Directory</span>
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

      <main className="flex-1 pb-24">{children}</main>

      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs font-medium text-slate-600">
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
              className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2"
              value={correctionPage}
              onChange={(e) => setCorrectionPage(e.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold">
            Incorrect text and suggested improvement
            <textarea
              required
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
            />
          </label>
          {correctionSaved && (
            <p role="status" className="rounded-lg bg-green-50 p-2 text-sm font-semibold text-green-900">
              {t("shell.correctionSubmitted")}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" className="min-h-[44px] rounded-lg bg-teal-800 px-4 py-2 font-bold text-white">
              Submit
            </button>
            <button
              type="button"
              onClick={() => setCorrectionOpen(false)}
              className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 font-semibold"
            >
              Close
            </button>
          </div>
        </form>
      </AccessibleModal>
    </div>
  );
}
