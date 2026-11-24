import { createClient } from "@supabase/supabase-js";

let client;
let runtimeConfigPromise = null;
let cachedPublicConfig = null;

function readEmbeddedConfig() {
  const runtime = typeof window !== "undefined" ? window.__SWASTH_PUBLIC_CONFIG__ : null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || runtime?.supabaseUrl || cachedPublicConfig?.supabaseUrl || "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    runtime?.supabaseAnonKey ||
    cachedPublicConfig?.supabaseAnonKey ||
    "";
  return { url, anonKey };
}

export function getSupabaseBrowser() {
  const { url, anonKey } = readEmbeddedConfig();
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export async function fetchPublicConfig() {
  if (cachedPublicConfig) return cachedPublicConfig;
  if (typeof window === "undefined") return null;
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetch("/api/public-config", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((cfg) => {
        if (cfg) {
          cachedPublicConfig = cfg;
          window.__SWASTH_PUBLIC_CONFIG__ = cfg;
        }
        return cfg;
      })
      .catch(() => null);
  }
  return runtimeConfigPromise;
}

export async function ensureSupabaseBrowser() {
  const existing = getSupabaseBrowser();
  if (existing) return existing;
  await fetchPublicConfig();
  return getSupabaseBrowser();
}
