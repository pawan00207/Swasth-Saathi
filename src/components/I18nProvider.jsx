"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  SUPPORTED_LANGUAGES,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  normalizeLanguage,
  translateKey,
} from "../lib/i18n";
import { getSupabaseBrowser } from "../lib/supabase/browser";

const I18nContext = createContext({
  language: "en",
  setLanguage: () => {},
  t: (key, vars) => translateKey("en", key, vars),
  formatCurrency: (amount) => formatCurrency(amount, "en"),
  formatDate: (d) => formatDate(d, "en"),
  formatDateTime: (d) => formatDateTime(d, "en"),
  formatNumber: (n) => formatNumber(n, "en"),
  languages: SUPPORTED_LANGUAGES,
});

export function useI18n() {
  return useContext(I18nContext);
}

export function I18nProvider({ initialLanguage = "en", children }) {
  const [language, setLanguageState] = useState(() => normalizeLanguage(initialLanguage));

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )swasth_lang=([^;]+)/);
    const saved = localStorage.getItem("swasth_lang") || (match ? decodeURIComponent(match[1]) : "");
    if (saved) {
      const normalized = normalizeLanguage(saved);
      setLanguageState(normalized);
      document.documentElement.lang = normalized;
    } else {
      document.documentElement.lang = normalizeLanguage(initialLanguage);
    }

    const supabase = getSupabaseBrowser();
    if (supabase) {
      supabase.auth.getSession().then(async ({ data }) => {
        const token = data.session?.access_token;
        if (!token) return;
        const res = await fetch("/api/profile", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const result = await res.json();
        const pref = result.profile?.preferredLanguage;
        if (pref) {
          const normalized = normalizeLanguage(pref);
          setLanguageState(normalized);
          localStorage.setItem("swasth_lang", normalized);
          document.cookie = `swasth_lang=${normalized}; path=/; max-age=31536000; SameSite=Lax`;
          document.documentElement.lang = normalized;
        }
      }).catch(() => {});
    }
  }, [initialLanguage]);

  const setLanguage = useCallback(async (next) => {
    const normalized = normalizeLanguage(next);
    setLanguageState(normalized);
    localStorage.setItem("swasth_lang", normalized);
    document.cookie = `swasth_lang=${normalized}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = normalized;

    const supabase = getSupabaseBrowser();
    if (supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          await fetch("/api/profile", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.session.access_token}`,
            },
            body: JSON.stringify({ preferredLanguage: normalized }),
          });
        }
      } catch {
        // Keep local preference even if profile sync fails offline
      }
    }
  }, []);

  const t = useCallback((key, vars) => translateKey(language, key, vars), [language]);
  const fmtCurrency = useCallback((amount) => formatCurrency(amount, language), [language]);
  const fmtDate = useCallback((d) => formatDate(d, language), [language]);
  const fmtDateTime = useCallback((d) => formatDateTime(d, language), [language]);
  const fmtNumber = useCallback((n) => formatNumber(n, language), [language]);

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t,
        formatCurrency: fmtCurrency,
        formatDate: fmtDate,
        formatDateTime: fmtDateTime,
        formatNumber: fmtNumber,
        languages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}
