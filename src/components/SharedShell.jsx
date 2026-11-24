"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Languages, Menu } from "lucide-react";
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

const primaryPaths = new Set(["/schemes", "/records", "/billing", "/beds"]);

export default function SharedShell({ children, isHome = false }) {
  const { language, setLanguage, t, languages } = useI18n();
  const [sounds, setSounds] = useState(false);
  const [role, setRole] = useState("Patient");
  const [showStatus, setShowStatus] = useState(false);
  const [bedStatus, setBedStatus] = useState("Checking");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionNote, setCorrectionNote] = useState("");
  const [correctionPage, setCorrectionPage] = useState("");
  const [correctionSaved, setCorrectionSaved] = useState(false);

  useEffect(() => {
    setSounds(localStorage.getItem("care-interface-sounds") === "on");
    const saved = localStorage.getItem("healthx_demo_role");
    if (saved) setRole(saved);
  }, []);

  useEffect(() => {
    if (!showStatus) return;
    fetch("/api/hospitals", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setBedStatus(data.source === "live-hms" ? "Live HMS" : "Demo fallback"))
      .catch(() => setBedStatus("Demo fallback"));
  }, [showStatus]);

  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRoot = useRef(null);
  const menuButton = useRef(null);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function closeOnEscape(event) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButton.current?.focus();
    }
    function closeOnOutsideClick(event) {
      if (!menuRoot.current?.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [menuOpen]);

  function playConfirmation() {
    const audio = new Audio("/sounds/soft-success.mp3");
    audio.volume = 0.25;
    audio.play().catch(() => {});
  }

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
      return;
    }
    setCorrectionNote("");
    setCorrectionSaved(true);
    if (sounds) playConfirmation();
  }

  return (
    <div className="site-shell">
      <a href="#main-content" className="site-skip">Skip to content</a>
      <header className="site-header">
        <div className="site-container site-header-row">
          <Link href="/" className="site-brand">
            <img src="/images/swasth-saathi-logo.webp" className="site-brand-logo" width="640" height="171" alt={t("appName")} />
          </Link>
          <nav className="site-primary-nav" aria-label="Primary navigation">
            {navItems.filter(([, href]) => primaryPaths.has(href)).map(([key, href]) => (
              <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{t(key)}</Link>
            ))}
          </nav>
          <div className="site-header-controls">
            <label className="site-language">
              <Languages size={16} strokeWidth={1.5} aria-hidden="true" />
              <select aria-label={t("shell.language")} value={language} onChange={(event) => setLanguage(event.target.value)}>
                {languages.map((item) => <option key={item.code} value={item.code}>{item.nativeLabel}</option>)}
              </select>
            </label>
            <Link href="/auth" className="site-account" aria-current={pathname === "/auth" ? "page" : undefined}>
              {t("nav.account")}
            </Link>
            <div ref={menuRoot}>
              <button ref={menuButton} type="button" className="site-menu-trigger"
                aria-expanded={menuOpen} aria-controls="site-service-menu"
                onClick={() => setMenuOpen((open) => !open)}>
                <Menu size={18} strokeWidth={1.5} aria-hidden="true" />
                <span>Menu</span>
              </button>
              <div className="site-menu-panel" id="site-service-menu" hidden={!menuOpen}>
                <nav aria-label="All services" className="site-menu-links">
                  {navItems.map(([key, href]) => (
                    <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}>
                      {t(key)}
                    </Link>
                  ))}
                  <Link href="/dashboard" aria-current={pathname === "/dashboard" ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}>Record dashboard</Link>
                </nav>
                <label className="site-demo-role">
                  <span>Interface sounds</span>
                  <input type="checkbox" checked={sounds} onChange={(event) => {
                    const enabled = event.target.checked;
                    setSounds(enabled);
                    localStorage.setItem("care-interface-sounds", enabled ? "on" : "off");
                    if (enabled) playConfirmation();
                  }} />
                </label>
                <label className="site-demo-role">
                  <span>{t("shell.demoRole")}</span>
                  <select value={role} onChange={changeRole}>
                    <option>Patient</option>
                    <option>Doctor</option>
                    <option>Hospital Admin</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>
        {language !== "en" && (
          <div className="site-translation">
            <div className="site-container">
              <span>{t("shell.machineTranslated")} </span>
              <button type="button" className="site-text-button" onClick={() => {
                setCorrectionSaved(false);
                setCorrectionPage(window.location.pathname);
                setCorrectionOpen(true);
              }}>{t("shell.suggestCorrection")}</button>
            </div>
          </div>
        )}
      </header>
      <main id="main-content" className="site-main" data-surface={isHome ? "home" : "app"} tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="site-container wrap site-footer-row">
          <div>
            <span className="site-footer-title">{t("appName")}</span>
            <p>{t("shell.footerDisclaimer")}</p>
          </div>
          <button type="button" className="site-text-button" aria-expanded={showStatus}
            aria-controls="integration-status" onClick={() => setShowStatus((visible) => !visible)}>
            {showStatus ? t("shell.hideStatus") : t("shell.viewStatus")}
          </button>
        </div>
        <div id="integration-status" className="site-container site-footer-status" hidden={!showStatus}>
          <dl>
            <div><dt>Schemes</dt><dd>Demo catalogue available</dd></div>
            <div><dt>Routing</dt><dd>Demo routing available</dd></div>
            <div><dt>Beds</dt><dd>{bedStatus}</dd></div>
            <div><dt>Reports</dt><dd>Demo OCR and record sharing</dd></div>
            <div><dt>Doctors</dt><dd>Demo directory available</dd></div>
          </dl>
          <Link className="site-text-button" href="/admin/setup-status">Integration setup status</Link>
        </div>
      </footer>
      <div className="site-utility-dock">
        <SosFloatingWidget />
        <SaarthiChat />
      </div>

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
