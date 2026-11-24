import { requireUser } from "../../../../lib/api-auth";
import { writeAuditLog } from "../../../../lib/audit";
import { publishRealtime } from "../../../../lib/realtime-server";
import { notifySosHospitalPreAlertTelegram } from "../../../../lib/telegram";
import { sendWhatsAppMessage } from "../../../../lib/whatsapp/provider";

export async function PATCH(request, { params }) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const body = await request.json();
  const action = String(body.action || "");

  const sos = await context.prisma.sosEvent.findFirst({
    where: { id: params.id, userId: context.user.id },
  });
  if (!sos) return Response.json({ error: "SOS event not found." }, { status: 404 });

  if (action === "resolve" || action === "cancel") {
    const nextStatus = action === "resolve" ? "resolved" : "cancelled";
    const now = new Date();
    const updated = await context.prisma.sosEvent.update({
      where: { id: sos.id },
      data: {
        status: nextStatus,
        resolvedAt: now,
        trackingRevokedAt: now,
      },
    });
    await writeAuditLog(context.prisma, {
      entityType: "sos_event",
      entityId: sos.id,
      actorId: context.user.id,
      action: `sos_${nextStatus}`,
      details: {},
    });
    await publishRealtime(`sos-event-${sos.id}`, "updated", {
      sosId: sos.id,
      status: nextStatus,
      resolvedAt: now.toISOString(),
    });

    if (action === "resolve") {
      const [contacts, emergencyProfile] = await Promise.all([
        context.prisma.emergencyContact.findMany({
          where: { userId: context.user.id, optInStatus: "opted_in" },
        }),
        context.prisma.emergencyProfile.findUnique({ where: { userId: context.user.id } }),
      ]);
      const name = emergencyProfile?.fullName || context.profile.displayName || "Swasth Saathi User";
      const prefix = sos.isDrill ? "TEST ALERT ALL-CLEAR: " : "ALL-CLEAR: ";
      for (const contact of contacts) {
        await sendWhatsAppMessage({
          to: contact.whatsappPhone,
          body: `${prefix}${name} marked themselves safe. Tracking link is now closed.`,
          messageType: "sos_all_clear",
          prisma: context.prisma,
        });
      }
    }
    return Response.json({ sosEvent: updated });
  }

  if (action === "revoke-tracking") {
    const now = new Date();
    const updated = await context.prisma.sosEvent.update({
      where: { id: sos.id },
      data: { trackingRevokedAt: now },
    });
    await writeAuditLog(context.prisma, {
      entityType: "sos_event",
      entityId: sos.id,
      actorId: context.user.id,
      action: "tracking_revoked",
      details: {},
    });
    return Response.json({ sosEvent: updated });
  }

  if (action === "pre-alert") {
    const hospitalId = String(body.hospitalId || "");
    const hospital = await context.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true, name: true },
    });
    if (!hospital) return Response.json({ error: "Hospital not found." }, { status: 404 });
    const updatedSos = await context.prisma.sosEvent.update({
      where: { id: sos.id },
      data: { hospitalId: hospital.id },
    });
    const notification = await notifySosHospitalPreAlertTelegram({
      sosEvent: updatedSos,
      hospitalName: hospital.name,
      hospitalId: hospital.id,
      bedType: sos.neededBedType,
      prisma: context.prisma,
    });
    await writeAuditLog(context.prisma, {
      entityType: "sos_event",
      entityId: sos.id,
      actorId: context.user.id,
      action: "hospital_prealerted",
      details: { hospitalId: hospital.id, provider: "telegram", sent: notification.ok },
    });
    if (!notification.ok) {
      const status = notification.configured ? 502 : 503;
      return Response.json({
        error: notification.configured
          ? "Telegram pre-alert could not be delivered."
          : "Telegram bot is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.",
        preAlerted: false,
        provider: "telegram",
      }, { status });
    }
    return Response.json({ preAlerted: true, telegramSent: true, hospitalName: hospital.name, provider: "telegram" });
  }

  return Response.json({ error: "Unsupported SOS action." }, { status: 400 });
}
