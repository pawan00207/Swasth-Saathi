import { createHash, randomBytes } from "node:crypto";
import { getPrisma } from "../../../lib/prisma";
import { getAuthenticatedUser, getSupabaseAdmin } from "../../../lib/supabase/server";
import { writeAuditLog } from "../../../lib/audit";
import { sendWhatsAppMessage } from "../../../lib/whatsapp/provider";
import { getPublicBaseUrl } from "../../../lib/url";
import { getLiveHospitals } from "../../../lib/hospital-inventory";
import { notifySosAlertTelegram } from "../../../lib/telegram";

export const dynamic = "force-dynamic";

const sosRateLimits = new Map();

function getSosDedupeStore() {
  if (!globalThis.__swasthSosDedupe) {
    globalThis.__swasthSosDedupe = new Map();
  }
  return globalThis.__swasthSosDedupe;
}

function pruneSosDedupe(store, now = Date.now()) {
  for (const [key, entry] of store.entries()) {
    if (!entry || entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = (v) => (v * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function rankNearestHospitals(lat, lng, neededBedType = "ICU") {
  const bedKey = String(neededBedType || "ICU").toLowerCase();
  const live = await getLiveHospitals();
  const hospitals = (live.hospitals || []).map((h) => ({ ...h, source: live.source }));

  return hospitals
    .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng))
    .map((h) => {
      const dist = Number.isFinite(lat) && Number.isFinite(lng)
        ? Number(distanceKm(lat, lng, h.lat, h.lng).toFixed(1))
        : (h.distance || 0);
      const bedCount = Number(h[bedKey] ?? h.icu ?? 0);
      return {
        ...h,
        distanceKm: dist,
        neededBedAvailable: bedCount,
      };
    })
    .sort((a, b) => {
      const aHas = a.neededBedAvailable > 0 ? 0 : 1;
      const bHas = b.neededBedAvailable > 0 ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return a.distanceKm - b.distanceKm;
    })
    .slice(0, 5);
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();
  const prisma = getPrisma();
  if (!supabase || !prisma) {
    return Response.json({ events: [], mode: "live-snapshot" });
  }
  const user = await getAuthenticatedUser(request, supabase);
  if (!user) return Response.json({ error: "Sign in to view SOS events." }, { status: 401 });
  try {
    const events = await prisma.sosEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return Response.json({ events });
  } catch {
    return Response.json({ events: [], mode: "live-snapshot" });
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const locationShared = body.shareLocation === true;
  const rawLat = locationShared && body.latitude != null ? Number(body.latitude) : null;
  const rawLng = locationShared && body.longitude != null ? Number(body.longitude) : null;
  const lat = Number.isFinite(rawLat) && rawLat >= -90 && rawLat <= 90 ? rawLat : null;
  const lng = Number.isFinite(rawLng) && rawLng >= -180 && rawLng <= 180 ? rawLng : null;
  const addressText = locationShared && typeof body.addressText === "string"
    ? body.addressText.trim().slice(0, 300)
    : "";
  const neededBedType = ["ICU", "Oxygen", "Ventilator", "Pediatric", "General"].includes(body.neededBedType)
    ? body.neededBedType
    : "ICU";
  const isDrill = Boolean(body.isDrill);

  const rawIdempotency = String(
    body.idempotencyKey || body.clientRequestId || request.headers.get("x-idempotency-key") || "",
  ).trim();
  const idempotencyKey = /^[a-zA-Z0-9._-]{4,80}$/.test(rawIdempotency) ? rawIdempotency : "";

  const prisma = getPrisma();
  const supabase = getSupabaseAdmin();
  let user = null;
  if (supabase) {
    user = await getAuthenticatedUser(request, supabase);
  }

  const rateKey = user?.id || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "guest";
  const now = Date.now();

  // Duplicate SOS prevention for rapid double clicks / retries
  const dedupeStore = getSosDedupeStore();
  pruneSosDedupe(dedupeStore, now);
  const requestDedupeKey = idempotencyKey
    ? `req:${rateKey}:${idempotencyKey}`
    : `burst:${rateKey}:${neededBedType}:${isDrill}:${locationShared ? `${lat},${lng},${addressText}` : "noloc"}`;
  const existing = dedupeStore.get(requestDedupeKey);
  if (existing && existing.expiresAt > now) {
    return Response.json({ ...existing.payload, deduplicated: true }, { status: 200 });
  }

  const bucket = sosRateLimits.get(rateKey);
  if (!isDrill && bucket && bucket.resetAt > now && bucket.count >= 5) {
    return Response.json({ error: "SOS rate limit reached. Call 108 or 112 immediately for emergencies." }, { status: 429 });
  }
  sosRateLimits.set(
    rateKey,
    bucket && bucket.resetAt > now ? { count: bucket.count + 1, resetAt: bucket.resetAt } : { count: 1, resetAt: now + 10 * 60_000 },
  );

  const rankedHospitals = await rankNearestHospitals(lat, lng, neededBedType);
  const origin = getPublicBaseUrl(request);

  if (prisma && user) {
    try {
      const [profile, emergencyProfile, contacts] = await Promise.all([
        prisma.profile.upsert({
          where: { userId: user.id },
          create: { userId: user.id, displayName: user.user_metadata?.display_name || "" },
          update: {},
        }),
        prisma.emergencyProfile.findUnique({ where: { userId: user.id } }),
        prisma.emergencyContact.findMany({ where: { userId: user.id, optInStatus: "opted_in" } }),
      ]);

      const trackingToken = randomBytes(24).toString("base64url");
      const trackingTokenHash = createHash("sha256").update(trackingToken).digest("hex");
      const trackingExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const trackingUrl = `${origin}/track/${trackingToken}`;

      const sosEvent = await prisma.sosEvent.create({
        data: {
          userId: user.id,
          status: "sent",
          isDrill,
          latitude: lat,
          longitude: lng,
          addressText: addressText || null,
          neededBedType,
          trackingTokenHash,
          trackingExpiresAt,
        },
      });

      await writeAuditLog(prisma, {
        entityType: "sos_event",
        entityId: sosEvent.id,
        actorId: user.id,
        action: isDrill ? "sos_drill_triggered" : "sos_triggered",
        details: { neededBedType, optedInContacts: contacts.length, locationShared },
      });

      const personName = emergencyProfile?.fullName || profile.displayName || "Swasth Saathi User";
      const mapsLink = lat != null && lng != null
        ? `https://www.google.com/maps?q=${lat},${lng}`
        : (addressText || "Location not shared");
      const prefix = isDrill ? "TEST ALERT (DRILL): " : "EMERGENCY SOS ALERT: ";
      const alertText = `${prefix}${personName} needs urgent help (${neededBedType} bed). Location: ${mapsLink}. Live tracking (expires in 2h): ${trackingUrl}. Reply SEEN or OK to acknowledge.`;

      let notified = 0;
      for (const contact of contacts) {
        const res = await sendWhatsAppMessage({
          to: contact.whatsappPhone,
          body: alertText,
          messageType: "sos_alert",
          prisma,
        });
        if (res.ok) notified += 1;
      }

      if (notified > 0) {
        await prisma.sosEvent.update({ where: { id: sosEvent.id }, data: { status: "delivered" } });
        sosEvent.status = "delivered";
      }

      let telegramNotification;
      try {
        telegramNotification = await notifySosAlertTelegram({
          sosEvent,
          locationShared,
          prisma,
          dedupeKey: `sos:${sosEvent.id}`,
        });
      } catch (telegramError) {
        console.warn("Telegram SOS alert skipped:", telegramError?.name || "error");
        telegramNotification = { ok: false, status: "failed" };
      }

      const payload = {
        sosEvent: {
          id: sosEvent.id,
          status: sosEvent.status,
          isDrill: sosEvent.isDrill,
          latitude: sosEvent.latitude,
          longitude: sosEvent.longitude,
          addressText: sosEvent.addressText,
          neededBedType: sosEvent.neededBedType,
          trackingExpiresAt: trackingExpiresAt.toISOString(),
          createdAt: sosEvent.createdAt.toISOString(),
        },
        contactsNotified: notified,
        optedInCount: contacts.length,
        trackingUrl,
        hospitals: rankedHospitals,
        telegram: {
          sent: Boolean(telegramNotification?.ok),
          status: telegramNotification?.status || "failed",
        },
      };
      dedupeStore.set(requestDedupeKey, {
        payload,
        expiresAt: now + (idempotencyKey ? 45_000 : 10_000),
      });
      return Response.json(payload, { status: 201 });
    } catch (dbErr) {
      console.warn("Prisma SOS persistence unavailable, falling back:", dbErr?.name || "db error");
    }
  }

  // Fallback for unauthenticated emergency triggers or Supabase REST when direct Postgres is unavailable
  const fallbackSosEvent = {
    id: `SOS-LIVE-${Date.now()}`,
    status: "sent",
    isDrill,
    latitude: lat,
    longitude: lng,
    addressText,
    neededBedType,
    createdAt: new Date().toISOString(),
  };

  if (supabase && user) {
    try {
      const { data: inserted, error: insertError } = await supabase
        .from("sos_events")
        .insert({
          user_id: user.id,
          status: "sent",
          is_drill: isDrill,
          latitude: lat,
          longitude: lng,
          address_text: addressText || null,
          needed_bed_type: neededBedType,
        })
        .select("id, created_at, status")
        .maybeSingle();
      if (!insertError && inserted?.id) {
        fallbackSosEvent.id = inserted.id;
        if (inserted.created_at) fallbackSosEvent.createdAt = inserted.created_at;
        if (inserted.status) fallbackSosEvent.status = inserted.status;
      } else if (insertError) {
        console.warn("Could not persist fallback SOS event:", insertError.code || "database error");
      }
    } catch (error) {
      console.warn("Could not persist fallback SOS event:", error?.name || "database error");
    }
  }

  let telegramNotification;
  try {
    telegramNotification = await notifySosAlertTelegram({
      sosEvent: fallbackSosEvent,
      locationShared,
      prisma: null,
      dedupeKey: `sos:${fallbackSosEvent.id}`,
    });
  } catch (telegramError) {
    console.warn("Telegram SOS alert skipped:", telegramError?.name || "error");
    telegramNotification = { ok: false, status: "failed" };
  }

  const fallbackPayload = {
    sosEvent: fallbackSosEvent,
    contactsNotified: 0,
    trackingUrl: null,
    hospitals: rankedHospitals,
    telegram: {
      sent: Boolean(telegramNotification?.ok),
      status: telegramNotification?.status || "failed",
    },
    message: isDrill
      ? "TEST ALERT drill triggered with nearest hospital bed ranking."
      : "SOS alert triggered with nearest hospital bed ranking. Call 108 or 112 immediately for emergencies.",
  };

  dedupeStore.set(requestDedupeKey, {
    payload: fallbackPayload,
    expiresAt: now + (idempotencyKey ? 45_000 : 10_000),
  });

  return Response.json(fallbackPayload, { status: 201 });
}
