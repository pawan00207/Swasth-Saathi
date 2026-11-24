import { createHash, randomBytes } from "node:crypto";
import { getPrisma } from "../../../lib/prisma";
import { getAuthenticatedUser, getSupabaseAdmin } from "../../../lib/supabase/server";
import { writeAuditLog } from "../../../lib/audit";
import { sendWhatsAppMessage } from "../../../lib/whatsapp/provider";
import hospitalsSeed from "../../../features/beds/data/hospitals.json";

export const dynamic = "force-dynamic";

const sosRateLimits = new Map();

function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = (v) => (v * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function rankNearestHospitals(prisma, lat, lng, neededBedType = "ICU") {
  const bedKey = String(neededBedType || "ICU").toLowerCase();
  let hospitals = hospitalsSeed.map((h) => ({ ...h, source: "demo-seed" }));

  if (prisma) {
    try {
      const rows = await prisma.hospital.findMany({
        include: { bedInventory: true },
      });
      if (rows.length) {
        hospitals = rows.map((row) => {
          const beds = Object.fromEntries((row.bedInventory || []).map((b) => [b.bedType.toLowerCase(), b.available]));
          return {
            id: row.id,
            name: row.name,
            city: row.city,
            address: row.address,
            lat: row.latitude,
            lng: row.longitude,
            icu: beds.icu || 0,
            oxygen: beds.oxygen || 0,
            ventilator: beds.ventilator || 0,
            pediatric: beds.pediatric || 0,
            general: beds.general || 0,
            hasStaffWhatsapp: Boolean(row.staffWhatsapp),
            demo: row.demo,
            source: row.demo ? "prisma-demo" : "prisma-live",
          };
        });
      }
    } catch {
      // Fall back to seeded hospitals
    }
  }

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
    return Response.json({ events: [], mode: "demo" });
  }
  const user = await getAuthenticatedUser(request, supabase);
  if (!user) return Response.json({ error: "Sign in to view SOS events." }, { status: 401 });
  const events = await prisma.sosEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return Response.json({ events });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const lat = body.latitude != null ? Number(body.latitude) : null;
  const lng = body.longitude != null ? Number(body.longitude) : null;
  const addressText = typeof body.addressText === "string" ? body.addressText.trim().slice(0, 300) : "";
  const neededBedType = ["ICU", "Oxygen", "Ventilator", "Pediatric", "General"].includes(body.neededBedType)
    ? body.neededBedType
    : "ICU";
  const isDrill = Boolean(body.isDrill);

  const prisma = getPrisma();
  const supabase = getSupabaseAdmin();
  let user = null;
  if (supabase) {
    user = await getAuthenticatedUser(request, supabase);
  }

  const rateKey = user?.id || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "guest";
  const now = Date.now();
  const bucket = sosRateLimits.get(rateKey);
  if (!isDrill && bucket && bucket.resetAt > now && bucket.count >= 5) {
    return Response.json({ error: "SOS rate limit reached. Call 108 or 112 immediately for emergencies." }, { status: 429 });
  }
  sosRateLimits.set(
    rateKey,
    bucket && bucket.resetAt > now ? { count: bucket.count + 1, resetAt: bucket.resetAt } : { count: 1, resetAt: now + 10 * 60_000 },
  );

  const rankedHospitals = await rankNearestHospitals(prisma, lat, lng, neededBedType);
  const origin = new URL(request.url).origin;

  if (!prisma || !user) {
    return Response.json({
      demo: true,
      sosEvent: {
        id: `SOS-DEMO-${Date.now()}`,
        status: "sent",
        isDrill,
        latitude: lat,
        longitude: lng,
        addressText,
        neededBedType,
        createdAt: new Date().toISOString(),
      },
      contactsNotified: 0,
      trackingUrl: null,
      hospitals: rankedHospitals,
      message: isDrill
        ? "TEST ALERT drill simulated in demo mode. Sign in with database + WhatsApp configured to send live WhatsApp SOS alerts."
        : "Demo SOS triggered locally. Call 108 or 112 immediately for real emergencies.",
    }, { status: 201 });
  }

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
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
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
    details: { neededBedType, optedInContacts: contacts.length },
  });

  const personName = emergencyProfile?.fullName || profile.displayName || "Swasth Saathi User";
  const mapsLink = Number.isFinite(lat) && Number.isFinite(lng)
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : (addressText || "Location unavailable");
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

  return Response.json({
    demo: false,
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
  }, { status: 201 });
}
