import i18next from "i18next";
import en from "../../locales/en.json";
import hi from "../../locales/hi.json";
import bn from "../../locales/bn.json";
import mr from "../../locales/mr.json";
import ta from "../../locales/ta.json";
import te from "../../locales/te.json";
import gu from "../../locales/gu.json";
import pa from "../../locales/pa.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English", intl: "en-IN" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", intl: "hi-IN" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা", intl: "bn-IN" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी", intl: "mr-IN" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்", intl: "ta-IN" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు", intl: "te-IN" },
  { code: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી", intl: "gu-IN" },
  { code: "pa", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", intl: "pa-IN" },
];

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  bn: { translation: bn },
  mr: { translation: mr },
  ta: { translation: ta },
  te: { translation: te },
  gu: { translation: gu },
  pa: { translation: pa },
};

let initialized = false;

export function ensureI18n() {
  if (!initialized) {
    i18next.init({
      resources,
      lng: "en",
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      initImmediate: false,
    });
    initialized = true;
  }
  return i18next;
}

export function normalizeLanguage(code) {
  const lower = String(code || "en").toLowerCase().slice(0, 2);
  return SUPPORTED_LANGUAGES.some((item) => item.code === lower) ? lower : "en";
}

export function getIntlLocale(lang) {
  const code = normalizeLanguage(lang);
  return SUPPORTED_LANGUAGES.find((item) => item.code === code)?.intl || "en-IN";
}

export function translateKey(lang, key, vars = {}) {
  const instance = ensureI18n();
  const code = normalizeLanguage(lang);
  return instance.t(key, { lng: code, ...vars });
}

export function formatCurrency(amount, lang = "en") {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat(getIntlLocale(lang), {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `₹${Number.isFinite(value) ? value.toFixed(2) : "0.00"}`;
  }
}

export function formatNumber(value, lang = "en") {
  const num = Number(value || 0);
  try {
    return new Intl.NumberFormat(getIntlLocale(lang)).format(Number.isFinite(num) ? num : 0);
  } catch {
    return String(value ?? 0);
  }
}

export function formatDate(dateInput, lang = "en") {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return String(dateInput);
  try {
    return new Intl.DateTimeFormat(getIntlLocale(lang), {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

export function formatDateTime(dateInput, lang = "en") {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return String(dateInput);
  try {
    return new Intl.DateTimeFormat(getIntlLocale(lang), {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}
