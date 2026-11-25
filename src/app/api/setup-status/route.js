import { getPrisma } from "../../../lib/prisma";
import { getActiveWhatsAppProviderName, isWhatsAppConfigured } from "../../../lib/whatsapp/provider";
import { isAbdmConfigured, testAbdmConnection } from "../../../lib/abdm/client";
import { getTelegramConfig, isTelegramConfigured } from "../../../lib/telegram";

export const dynamic = "force-dynamic";

const requestLimits = new Map();

function getSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "",
  };
}

const checks = [
  {
    name: "Supabase Auth / Storage",
    configured: () => {
      const { url, anonKey, serviceKey } = getSupabaseEnv();
      return Boolean(url && anonKey && serviceKey);
    },
    test: async () => {
      const { url, anonKey, serviceKey } = getSupabaseEnv();
      const authResponse = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
        headers: { apikey: anonKey },
        cache: "no-store",
      });
      if (!authResponse.ok) return false;
      const storageResponse = await fetch(`${url.replace(/\/$/, "")}/storage/v1/bucket/medical-reports`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: "no-store",
      });
      return storageResponse.ok;
    },
  },
  {
    name: "ABDM Gateway (V3)",
    configured: () => isAbdmConfigured(),
    test: async () => testAbdmConnection(),
  },
  {
    name: "Saarthi Gemini AI",
    configured: () => Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY),
    test: async () => Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY),
  },
  {
    name: "Prisma Postgres",
    configured: () => Boolean(process.env.DATABASE_URL),
    test: async () => {
      const prisma = getPrisma();
      if (!prisma) return false;
      const tables = await prisma.$queryRaw`SELECT to_regclass('"Profile"')::text AS profile_table`;
      return Boolean(tables[0]?.profile_table);
    },
  },
  {
    name: "Mapbox",
    configured: () => Boolean(process.env.MAPBOX_ACCESS_TOKEN),
    test: async () => {
      const response = await fetch(
        `https://api.mapbox.com/styles/v1/mapbox/streets-v11?access_token=${encodeURIComponent(process.env.MAPBOX_ACCESS_TOKEN)}`,
        { cache: "no-store" },
      );
      return response.ok;
    },
  },
  {
    name: "OpenRouteService",
    configured: () => Boolean(process.env.OPENROUTESERVICE_API_KEY),
    test: async () => {
      const response = await fetch("https://api.openrouteservice.org/v2/directions/foot-walking", {
        method: "POST",
        headers: {
          Authorization: process.env.OPENROUTESERVICE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ coordinates: [[8.681495, 49.41461], [8.687872, 49.420318]] }),
        cache: "no-store",
      });
      return response.ok;
    },
  },
  {
    name: "data.gov.in",
    configured: () => Boolean(process.env.DATA_GOV_IN_API_KEY && process.env.DATA_GOV_IN_RESOURCE_ID),
    test: async () => {
      const url = new URL(`https://api.data.gov.in/resource/${encodeURIComponent(process.env.DATA_GOV_IN_RESOURCE_ID)}`);
      url.searchParams.set("api-key", process.env.DATA_GOV_IN_API_KEY);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");
      const response = await fetch(url, { cache: "no-store" });
      return response.ok;
    },
  },
  {
    name: "JaaS",
    configured: () => Boolean(process.env.JAAS_APP_ID && process.env.JAAS_API_KEY_ID && process.env.JAAS_PRIVATE_KEY),
    test: async () => {
      const response = await fetch(`https://8x8.vc/${encodeURIComponent(process.env.JAAS_APP_ID)}/config.js`, {
        cache: "no-store",
      });
      return response.ok;
    },
  },
  {
    name: "Razorpay TEST",
    configured: () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    test: async () => {
      const credentials = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
      const response = await fetch("https://api.razorpay.com/v1/payments?count=1", {
        headers: { Authorization: `Basic ${credentials}` },
        cache: "no-store",
      });
      return response.ok;
    },
  },
  {
    name: "Razorpay Webhook",
    configured: () => Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
    test: async () => Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
  },
  {
    name: "WhatsApp Bot",
    configured: () => isWhatsAppConfigured(getActiveWhatsAppProviderName()),
    test: async () => {
      const provider = getActiveWhatsAppProviderName();
      if (provider === "twilio") {
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        const auth = Buffer.from(`${sid}:${token}`).toString("base64");
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`, {
          headers: { Authorization: `Basic ${auth}` },
          cache: "no-store",
        });
        return response.ok;
      }
      const response = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(process.env.META_WHATSAPP_PHONE_NUMBER_ID)}`, {
        headers: { Authorization: `Bearer ${process.env.META_WHATSAPP_TOKEN}` },
        cache: "no-store",
      });
      return response.ok;
    },
  },
  {
    name: "Telegram Bot",
    configured: () => isTelegramConfigured(),
    test: async () => {
      const { botToken } = getTelegramConfig();
      const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/getMe`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      return Boolean(response.ok && data?.ok);
    },
  },
  {
    name: "SOS Emergency",
    configured: () => Boolean(process.env.DATABASE_URL),
    test: async () => {
      const prisma = getPrisma();
      if (!prisma) return false;
      const tables = await prisma.$queryRaw`SELECT to_regclass('sos_events')::text AS sos_table`;
      return Boolean(tables[0]?.sos_table);
    },
  },
  {
    name: "Overpass",
    configured: () => true,
    test: async () => {
      const response = await fetch(process.env.OVERPASS_API_URL || "https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=%5Bout%3Ajson%5D%5Btimeout%3A5%5D%3Bnode%28around%3A100%2C28.6139%2C77.2090%29%5Bamenity%3Dhospital%5D%3Bout%201%3B",
        cache: "no-store",
      });
      return response.ok;
    },
  },
];

export async function GET(request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  for (const [address, entry] of requestLimits) {
    if (entry.resetAt <= now) requestLimits.delete(address);
  }
  const limit = requestLimits.get(ip);
  if (limit && limit.resetAt > now && limit.count >= 5) {
    return Response.json({ error: "Setup checks are temporarily rate limited." }, { status: 429 });
  }
  requestLimits.set(ip, limit && limit.resetAt > now
    ? { count: limit.count + 1, resetAt: limit.resetAt }
    : { count: 1, resetAt: now + 60_000 });

  const results = await Promise.all(checks.map(async (check) => {
    const configured = check.configured();
    if (!configured) return { name: check.name, configured, ok: false, state: "cached" };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const ok = await Promise.race([
        check.test(),
        new Promise((resolve) => controller.signal.addEventListener("abort", () => resolve(false), { once: true })),
      ]);
      return { name: check.name, configured, ok, state: ok ? "live" : "unavailable" };
    } catch (error) {
      console.error(`Setup health check failed for ${check.name}: ${error.name || "provider error"}`);
      return { name: check.name, configured, ok: false, state: "unavailable" };
    } finally {
      clearTimeout(timeout);
    }
  }));
  return Response.json({ integrations: results, checkedAt: new Date().toISOString() }, {
    headers: { "Cache-Control": "no-store" },
  });
}
