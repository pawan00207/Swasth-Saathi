import { requireUser } from "../../../../lib/api-auth";
import { getLiveHospitals } from "../../../../lib/hospital-inventory";
import { writeAuditLog } from "../../../../lib/audit";
import { notifySosHospitalPreAlertTelegram } from "../../../../lib/telegram";

const allowedBedTypes = new Set(["ICU", "Oxygen", "General", "Ventilator", "Pediatric"]);

export async function POST(request) {
  const context = await requireUser(request, { allowSupabaseFallback: true });
  if (context.response) return context.response;

  const body = await request.json().catch(() => ({}));
  const sosId = typeof body.sosId === "string" ? body.sosId.trim() : "";
  const hospitalId = typeof body.hospitalId === "string" ? body.hospitalId.trim() : "";
  const bedType = typeof body.bedType === "string" ? body.bedType : "";
  if (!/^SOS-LIVE-\d{10,}$/.test(sosId) || !hospitalId || !allowedBedTypes.has(bedType)) {
    return Response.json({ error: "A live SOS ID, hospital, and valid bed type are required." }, { status: 400 });
  }

  let hospital = null;
  if (context.prisma) {
    try {
      hospital = await context.prisma.hospital.findUnique({
        where: { id: hospitalId },
        select: { id: true, name: true },
      });
    } catch (error) {
      console.warn("Could not look up SOS pre-alert hospital in Prisma:", error?.name || "database error");
    }
  }
  if (!hospital) {
    const live = await getLiveHospitals();
    hospital = live.hospitals.find((item) => item.id === hospitalId) || null;
  }
  if (!hospital) return Response.json({ error: "Hospital not found." }, { status: 404 });

  const notification = await notifySosHospitalPreAlertTelegram({
    sosEvent: {
      id: sosId,
      isDrill: body.isDrill === true,
      createdAt: new Date(),
    },
    hospitalName: hospital.name,
    hospitalId: hospital.id,
    bedType,
    prisma: context.prisma,
  });
  if (!notification.ok) {
    return Response.json({
      error: notification.configured
        ? "Telegram pre-alert could not be delivered."
        : "Telegram bot is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.",
      provider: "telegram",
    }, { status: notification.configured ? 502 : 503 });
  }

  if (context.prisma) {
    await writeAuditLog(context.prisma, {
      entityType: "sos_event",
      entityId: sosId,
      actorId: context.user.id,
      action: "hospital_prealerted",
      details: { hospitalId: hospital.id, provider: "telegram", sent: true },
    });
  }

  return Response.json({
    preAlerted: true,
    telegramSent: true,
    provider: "telegram",
    hospitalName: hospital.name,
  });
}
