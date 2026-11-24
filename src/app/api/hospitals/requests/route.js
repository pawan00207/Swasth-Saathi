import { requireUser } from "../../../../lib/api-auth";
import { publishRealtime } from "../../../../lib/realtime-server";
import { isValidWhatsappPhone, normalizeWhatsappPhone, writeAuditLog } from "../../../../lib/audit";
import { sendWhatsAppMessage } from "../../../../lib/whatsapp/provider";

const bedTypes = ["ICU", "Oxygen", "General", "Ventilator", "Pediatric"];
const urgencyMap = {
  routine: "routine",
  normal: "routine",
  urgent: "urgent",
  emergency: "emergency",
  critical: "critical",
};

export async function GET(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  if (context.profile.role === "hospital_admin" && !context.profile.hospitalId) {
    return Response.json({ error: "This hospital administrator account is not assigned to a hospital." }, { status: 403 });
  }
  const where = context.profile.role === "hospital_admin" && context.profile.hospitalId
    ? { hospitalId: context.profile.hospitalId }
    : { userId: context.user.id };
  const requests = await context.prisma.bedRequest.findMany({
    where,
    include: { hospital: { select: { name: true, city: true } } },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ requests });
}

export async function POST(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const body = await request.json();
  const mappedUrgency = urgencyMap[String(body.urgency || "routine").toLowerCase()];
  const rawWhatsapp = body.whatsappPhone || body.patientPhone || "";
  const normalizedWhatsapp = rawWhatsapp ? normalizeWhatsappPhone(rawWhatsapp) : "";
  const patientPhone = String(body.patientPhone || normalizedWhatsapp || "").trim();

  if (
    typeof body.hospitalId !== "string"
    || !bedTypes.includes(body.bedType)
    || !mappedUrgency
    || typeof body.patientName !== "string"
    || !body.patientName.trim()
    || !patientPhone
  ) {
    return Response.json({ error: "A hospital, valid bed type, patient name, phone, and urgency are required." }, { status: 400 });
  }
  if (body.whatsappConsent && !isValidWhatsappPhone(normalizedWhatsapp)) {
    return Response.json({ error: "Enter a valid WhatsApp phone number with country code (e.g. +919876543210)." }, { status: 400 });
  }
  if (body.patientAge != null && body.patientAge !== "") {
    const age = Number(body.patientAge);
    if (!Number.isInteger(age) || age < 0 || age > 130) {
      return Response.json({ error: "Enter a valid patient age between 0 and 130." }, { status: 400 });
    }
  }

  const hospital = await context.prisma.hospital.findUnique({
    where: { id: body.hospitalId },
    select: { id: true, name: true, staffWhatsapp: true },
  });
  if (!hospital) return Response.json({ error: "Hospital not found." }, { status: 404 });

  if (body.attachedReportId) {
    const report = await context.prisma.report.findFirst({
      where: { id: String(body.attachedReportId), ownerId: context.user.id },
      select: { id: true },
    });
    if (!report) {
      return Response.json({ error: "Attached report was not found in your account." }, { status: 404 });
    }
  }

  const bedRequest = await context.prisma.bedRequest.create({
    data: {
      userId: context.user.id,
      hospitalId: hospital.id,
      bedType: body.bedType,
      patientName: body.patientName.trim().slice(0, 120),
      patientPhone: patientPhone.slice(0, 40),
      patientAge: body.patientAge != null && body.patientAge !== "" ? Number(body.patientAge) : null,
      patientGender: typeof body.patientGender === "string" && body.patientGender.trim() ? body.patientGender.trim().slice(0, 30) : null,
      whatsappPhone: normalizedWhatsapp || null,
      reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 500) : null,
      attendantName: typeof body.attendantName === "string" && body.attendantName.trim() ? body.attendantName.trim().slice(0, 120) : null,
      attendantPhone: typeof body.attendantPhone === "string" && body.attendantPhone.trim() ? body.attendantPhone.trim().slice(0, 40) : null,
      attachedReportId: body.attachedReportId ? String(body.attachedReportId) : null,
      whatsappConsent: Boolean(body.whatsappConsent),
      urgency: mappedUrgency,
    },
  });

  await writeAuditLog(context.prisma, {
    entityType: "bed_request",
    entityId: bedRequest.id,
    actorId: context.user.id,
    action: "created",
    details: { hospitalId: hospital.id, bedType: bedRequest.bedType, urgency: bedRequest.urgency },
  });

  const updatedAt = bedRequest.updatedAt.toISOString();
  await Promise.all([
    publishRealtime(`bed-requests-${hospital.id}`, "updated", { requestId: bedRequest.id, status: bedRequest.status, updatedAt }),
    publishRealtime(`bed-request-${bedRequest.id}`, "updated", { requestId: bedRequest.id, status: bedRequest.status, updatedAt }),
  ]);

  if (bedRequest.whatsappConsent && bedRequest.whatsappPhone) {
    const lang = context.profile.preferredLanguage || "en";
    const patientMsg = lang === "hi"
      ? `अनुरोध #${bedRequest.id} प्राप्त हुआ: ${hospital.name} में ${bedRequest.bedType} बेड। स्थिति जानने के लिए STATUS ${bedRequest.id} भेजें।`
      : `Request #${bedRequest.id} received for ${bedRequest.bedType} at ${hospital.name}. Reply STATUS ${bedRequest.id} to check updates.`;
    await sendWhatsAppMessage({
      to: bedRequest.whatsappPhone,
      body: patientMsg,
      messageType: "bed_request",
      prisma: context.prisma,
    });

    if (hospital.staffWhatsapp) {
      await sendWhatsAppMessage({
        to: hospital.staffWhatsapp,
        body: `Swasth Saathi Bed Request #${bedRequest.id} (${bedRequest.bedType}, ${bedRequest.urgency}) at ${hospital.name}. Reply ACCEPT ${bedRequest.id} or REJECT ${bedRequest.id}`,
        messageType: "staff_alert",
        prisma: context.prisma,
      });
    }
  }

  return Response.json({ request: bedRequest }, { status: 201 });
}

export async function PATCH(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  if (context.profile.role !== "hospital_admin" || !context.profile.hospitalId) {
    return Response.json({ error: "Hospital administrator access required." }, { status: 403 });
  }
  const { id, status } = await request.json();
  if (typeof id !== "string" || !["accepted", "rejected"].includes(status)) {
    return Response.json({ error: "A request ID and accepted/rejected status are required." }, { status: 400 });
  }

  const outcome = await context.prisma.$transaction(async (transaction) => {
    const updated = await transaction.bedRequest.updateMany({
      where: { id, hospitalId: context.profile.hospitalId, status: "pending" },
      data: { status },
    });
    if (!updated.count) return null;
    const bedRequest = await transaction.bedRequest.findUnique({
      where: { id },
      include: {
        hospital: { select: { name: true } },
        user: { select: { preferredLanguage: true } },
      },
    });
    if (status === "accepted" && bedRequest) {
      const inv = await transaction.bedInventory.findUnique({
        where: { hospitalId_bedType: { hospitalId: bedRequest.hospitalId, bedType: bedRequest.bedType } },
      });
      if (inv && inv.available > 0) {
        await transaction.bedInventory.update({
          where: { id: inv.id },
          data: { available: inv.available - 1 },
        });
        await transaction.bedInventoryAudit.create({
          data: {
            hospitalId: bedRequest.hospitalId,
            actorId: context.user.id,
            changes: [{ bedType: bedRequest.bedType, before: inv.available, after: inv.available - 1, reason: `request:${bedRequest.id}` }],
          },
        });
      }
    }
    return bedRequest;
  });

  if (!outcome) return Response.json({ error: "Pending bed request not found." }, { status: 404 });

  await writeAuditLog(context.prisma, {
    entityType: "bed_request",
    entityId: outcome.id,
    actorId: context.user.id,
    action: `request_${status}`,
    details: { hospitalId: outcome.hospitalId, bedType: outcome.bedType },
  });

  const updatedAt = outcome.updatedAt.toISOString();
  await Promise.all([
    publishRealtime(`bed-requests-${outcome.hospitalId}`, "updated", { requestId: outcome.id, status: outcome.status, updatedAt }),
    publishRealtime(`bed-request-${outcome.id}`, "updated", { requestId: outcome.id, status: outcome.status, updatedAt }),
    publishRealtime("bed-inventory-live", "updated", { hospitalId: outcome.hospitalId, updatedAt }),
  ]);

  if (outcome.whatsappConsent && outcome.whatsappPhone) {
    const lang = outcome.user?.preferredLanguage || "en";
    const msg = lang === "hi"
      ? `बेड अनुरोध #${outcome.id} (${outcome.hospital?.name || "अस्पताल"}): स्थिति अब ${status === "accepted" ? "स्वीकृत" : "अस्वीकृत"} है।`
      : `Bed request #${outcome.id} at ${outcome.hospital?.name || "Hospital"} is now ${status.toUpperCase()}.`;
    await sendWhatsAppMessage({
      to: outcome.whatsappPhone,
      body: msg,
      messageType: "status_reply",
      prisma: context.prisma,
    });
  }

  return Response.json({ request: outcome });
}
