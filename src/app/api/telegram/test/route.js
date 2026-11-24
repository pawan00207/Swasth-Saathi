import { requireUser } from "../../../../lib/api-auth";
import {
  isTelegramConfigured,
  notifyBedRequestTelegram,
  notifySosAlertTelegram,
  sendTelegramMessage,
} from "../../../../lib/telegram";

export const dynamic = "force-dynamic";

const ALLOWED_ADMIN_ROLES = new Set(["hospital_admin", "admin", "super_admin", "emergency_admin"]);
const ALLOWED_TYPES = new Set(["bed_request", "sos", "ping"]);

export async function POST(request) {
  const context = await requireUser(request, { allowSupabaseFallback: true });
  if (context.response) return context.response;

  const role = String(context.profile?.role || "").toLowerCase();
  if (!ALLOWED_ADMIN_ROLES.has(role)) {
    return Response.json(
      { error: "Authorized administrator access required." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const type = String(body.type || "ping").trim().toLowerCase();
  if (!ALLOWED_TYPES.has(type)) {
    return Response.json(
      { error: "Invalid test type. Use 'bed_request', 'sos', or 'ping'." },
      { status: 400 },
    );
  }

  if (!isTelegramConfigured({ emergency: type === "sos" })) {
    return Response.json(
      {
        ok: false,
        configured: false,
        provider: "telegram",
        type,
        error: "Telegram credentials (TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID) are not configured.",
      },
      { status: 503 },
    );
  }

  const nowIso = new Date().toISOString();
  let result;

  if (type === "bed_request") {
    const allowedBedTypes = ["ICU", "Oxygen", "General", "Ventilator", "Pediatric"];
    const bedType = allowedBedTypes.includes(body.bedType) ? body.bedType : "ICU";
    const hospitalName = typeof body.hospitalName === "string" && body.hospitalName.trim()
      ? body.hospitalName.trim().slice(0, 120)
      : "AIIMS New Delhi";

    result = await notifyBedRequestTelegram({
      bedRequest: {
        id: `REQ-TEST-${Date.now()}`,
        bedType,
        status: "pending",
        createdAt: nowIso,
      },
      hospitalName,
      prisma: context.prisma,
      dedupeKey: null,
    });
  } else if (type === "sos") {
    const locationShared = body.shareLocation === true;
    const rawLat = locationShared && body.latitude != null ? Number(body.latitude) : null;
    const rawLng = locationShared && body.longitude != null ? Number(body.longitude) : null;
    const latitude = Number.isFinite(rawLat) && rawLat >= -90 && rawLat <= 90 ? rawLat : null;
    const longitude = Number.isFinite(rawLng) && rawLng >= -180 && rawLng <= 180 ? rawLng : null;
    const addressText = locationShared && typeof body.addressText === "string"
      ? body.addressText.trim().slice(0, 200)
      : "";

    result = await notifySosAlertTelegram({
      sosEvent: {
        id: `SOS-TEST-${Date.now()}`,
        status: "sent",
        isDrill: true,
        latitude,
        longitude,
        addressText,
        createdAt: nowIso,
      },
      locationShared,
      prisma: context.prisma,
      dedupeKey: null,
    });
  } else {
    result = await sendTelegramMessage({
      text: `Swasth Saathi Admin Test: Telegram notification service is connected (${nowIso}).`,
      messageType: "telegram_test",
      prisma: context.prisma,
    });
  }

  return Response.json(
    {
      ok: result.ok,
      configured: result.configured,
      provider: "telegram",
      type,
      status: result.status,
      recipientMask: result.recipientMask,
      messageId: result.messageId ?? null,
    },
    { status: result.ok ? 200 : 502 },
  );
}
