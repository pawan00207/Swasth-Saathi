import { getPrisma } from "../../../../lib/prisma";
import { writeAuditLog, normalizeWhatsappPhone, maskPhone } from "../../../../lib/audit";
import { publishRealtime } from "../../../../lib/realtime-server";
import {
  recordInboundMessageLog,
  sendWhatsAppMessage,
  verifyMetaSignature,
  verifyTwilioSignature,
} from "../../../../lib/whatsapp/provider";

function twimlReply(message) {
  const escaped = String(message || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function getHelpMessage(lang = "en") {
  if (lang === "hi") {
    return "स्वस्थ साथी WhatsApp सहायता:\n• STATUS <ID> (या स्थिति <ID>) — बेड अनुरोध की स्थिति\n• YES (या हाँ) — SOS संपर्क सहमति दें\n• SEEN / OK (या ठीक) — SOS अलर्ट की पुष्टि करें\n• STOP (या रोको) — संदेश रोकें\n• HELP (या मदद) — यह सूची देखें";
  }
  return "Swasth Saathi WhatsApp Help:\n• STATUS <ID> — Check bed request status\n• YES — Confirm SOS emergency contact opt-in\n• SEEN / OK — Acknowledge an SOS alert\n• STOP — Opt out of alerts\n• HELP — Show commands\nFor emergencies in India, call 108 or 112.";
}

async function processCommand({ prisma, fromPhone, text }) {
  const normalizedPhone = normalizeWhatsappPhone(fromPhone);
  const trimmed = String(text || "").trim();
  const upper = trimmed.toUpperCase();
  const tokens = trimmed.split(/\s+/);
  const cmd = (tokens[0] || "").toUpperCase();
  const arg = tokens[1] || "";

  // 1. Staff ACCEPT / REJECT <ID>
  if ((cmd === "ACCEPT" || cmd === "REJECT") && arg) {
    if (!prisma) return { reply: "Database is not configured.", type: "staff_reply" };
    const status = cmd === "ACCEPT" ? "accepted" : "rejected";
    const staffHospitals = await prisma.hospital.findMany({
      where: { staffWhatsapp: { not: null } },
      select: { id: true, name: true, staffWhatsapp: true },
    });
    const matchedHospital = staffHospitals.find(
      (h) => normalizeWhatsappPhone(h.staffWhatsapp) === normalizedPhone,
    );
    if (!matchedHospital) {
      return { reply: "Unauthorized: only registered hospital staff numbers can accept or reject requests.", type: "unauthorized" };
    }
    const bedRequest = await prisma.bedRequest.findFirst({
      where: { id: arg, hospitalId: matchedHospital.id },
      include: { user: { select: { preferredLanguage: true } } },
    });
    if (!bedRequest) {
      return { reply: `Request #${arg} was not found for ${matchedHospital.name}.`, type: "staff_reply" };
    }
    if (bedRequest.status !== "pending") {
      return { reply: `Request #${arg} is already ${bedRequest.status}.`, type: "staff_reply" };
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.bedRequest.update({
        where: { id: bedRequest.id },
        data: { status },
      });
      if (status === "accepted") {
        const inv = await transaction.bedInventory.findUnique({
          where: { hospitalId_bedType: { hospitalId: matchedHospital.id, bedType: bedRequest.bedType } },
        });
        if (inv && inv.available > 0) {
          await transaction.bedInventory.update({
            where: { id: inv.id },
            data: { available: inv.available - 1 },
          });
          await transaction.bedInventoryAudit.create({
            data: {
              hospitalId: matchedHospital.id,
              actorId: bedRequest.userId,
              changes: [{ bedType: bedRequest.bedType, before: inv.available, after: inv.available - 1, reason: `whatsapp:${bedRequest.id}` }],
            },
          }).catch(() => {});
        }
      }
    });

    await writeAuditLog(prisma, {
      entityType: "bed_request",
      entityId: bedRequest.id,
      action: `whatsapp_${status}`,
      details: { hospitalId: matchedHospital.id, staffMask: maskPhone(normalizedPhone) },
    });

    const updatedAt = new Date().toISOString();
    await Promise.all([
      publishRealtime(`bed-requests-${matchedHospital.id}`, "updated", { requestId: bedRequest.id, status, updatedAt }),
      publishRealtime(`bed-request-${bedRequest.id}`, "updated", { requestId: bedRequest.id, status, updatedAt }),
      publishRealtime("bed-inventory-live", "updated", { hospitalId: matchedHospital.id, updatedAt }),
    ]);

    if (bedRequest.whatsappConsent && bedRequest.whatsappPhone) {
      const lang = bedRequest.user?.preferredLanguage || "en";
      const patientMsg = lang === "hi"
        ? `बेड अनुरोध #${bedRequest.id} (${matchedHospital.name}): स्थिति अब ${status === "accepted" ? "स्वीकृत" : "अस्वीकृत"} है।`
        : `Swasth Saathi: Your bed request #${bedRequest.id} at ${matchedHospital.name} is now ${status.toUpperCase()}.`;
      await sendWhatsAppMessage({
        to: bedRequest.whatsappPhone,
        body: patientMsg,
        messageType: "status_reply",
        prisma,
      });
    }

    return { reply: `Request #${bedRequest.id} marked ${status.toUpperCase()}.`, type: "staff_reply" };
  }

  // 2. STATUS <ID> / स्थिति <ID>
  if ((cmd === "STATUS" || trimmed.startsWith("स्थिति")) && arg) {
    if (!prisma) return { reply: "Status service requires database setup.", type: "status_reply" };
    const reqRow = await prisma.bedRequest.findUnique({
      where: { id: arg },
      include: { hospital: { select: { name: true } }, user: { select: { preferredLanguage: true } } },
    });
    if (!reqRow) {
      return { reply: `No bed request found for ID ${arg}.`, type: "status_reply" };
    }
    const lang = reqRow.user?.preferredLanguage || "en";
    const msg = lang === "hi"
      ? `अनुरोध #${reqRow.id} (${reqRow.hospital?.name || "अस्पताल"} - ${reqRow.bedType}): स्थिति ${reqRow.status}`
      : `Request #${reqRow.id} (${reqRow.hospital?.name || "Hospital"} - ${reqRow.bedType}): Status is ${reqRow.status.toUpperCase()}.`;
    return { reply: msg, type: "status_reply" };
  }

  // 3. YES / हाँ (Emergency contact opt-in)
  if (upper === "YES" || trimmed === "हाँ" || trimmed === "हा") {
    if (!prisma) return { reply: "Opt-in recorded.", type: "sos_optin" };
    const contacts = await prisma.emergencyContact.findMany({
      where: { whatsappPhone: normalizedPhone },
    });
    if (contacts.length > 0) {
      await prisma.emergencyContact.updateMany({
        where: { whatsappPhone: normalizedPhone },
        data: { optInStatus: "opted_in", optedInAt: new Date() },
      });
      return { reply: "Thank you. You are now opted in to receive Swasth Saathi SOS emergency alerts.", type: "sos_optin" };
    }
    return { reply: "No pending emergency contact invitation was found for this number.", type: "sos_optin" };
  }

  // 4. SEEN / OK / ठीक (Acknowledge SOS)
  if (["SEEN", "OK", "ACK"].includes(upper) || trimmed === "ठीक") {
    if (!prisma) return { reply: "SOS acknowledgement received.", type: "sos_ack" };
    const contacts = await prisma.emergencyContact.findMany({
      where: { whatsappPhone: normalizedPhone, optInStatus: "opted_in" },
    });
    if (contacts.length > 0) {
      const userIds = contacts.map((c) => c.userId);
      const latestSos = await prisma.sosEvent.findFirst({
        where: { userId: { in: userIds }, status: { in: ["sent", "delivered"] } },
        orderBy: { createdAt: "desc" },
      });
      if (latestSos) {
        const contact = contacts.find((c) => c.userId === latestSos.userId);
        const now = new Date();
        await prisma.sosEvent.update({
          where: { id: latestSos.id },
          data: {
            status: "acknowledged",
            acknowledgedBy: contact?.name || "Emergency Contact",
            acknowledgedAt: now,
          },
        });
        await writeAuditLog(prisma, {
          entityType: "sos_event",
          entityId: latestSos.id,
          action: "contact_acknowledged",
          details: { contactMask: maskPhone(normalizedPhone) },
        });
        await publishRealtime(`sos-event-${latestSos.id}`, "updated", {
          sosId: latestSos.id,
          status: "acknowledged",
          acknowledgedAt: now.toISOString(),
        });
        return { reply: "Thank you. The patient has been notified that you acknowledged the SOS alert.", type: "sos_ack" };
      }
    }
    return { reply: "No active SOS alert found to acknowledge.", type: "sos_ack" };
  }

  // 5. STOP / रोको
  if (upper === "STOP" || trimmed === "रोको") {
    if (prisma) {
      await prisma.emergencyContact.updateMany({
        where: { whatsappPhone: normalizedPhone },
        data: { optInStatus: "opted_out" },
      }).catch(() => {});
    }
    return { reply: "You have been opted out of Swasth Saathi WhatsApp alerts.", type: "stop" };
  }

  // 6. HELP / मदद / fallback
  const isHindi = /[\u0900-\u097F]/.test(trimmed);
  return { reply: getHelpMessage(isHindi ? "hi" : "en"), type: "help" };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge") || "";
  if (mode === "subscribe" && token && token === process.env.META_WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return Response.json({ error: "Webhook verification failed." }, { status: 403 });
}

export async function POST(request) {
  const prisma = getPrisma();
  const contentType = request.headers.get("content-type") || "";

  // Meta Cloud API JSON payload
  if (contentType.includes("application/json")) {
    const rawBody = await request.text();
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      return Response.json({ error: "Meta webhook secret is not configured." }, { status: 503 });
    }
    const sig = request.headers.get("x-hub-signature-256") || "";
    if (!verifyMetaSignature({ rawBody, signatureHeader: sig, appSecret })) {
      return Response.json({ error: "Invalid Meta webhook signature." }, { status: 401 });
    }
    const payload = JSON.parse(rawBody);
    const messages = payload.entry?.[0]?.changes?.[0]?.value?.messages || [];
    for (const msg of messages) {
      const fromPhone = msg.from || "";
      const text = msg.text?.body || "";
      const outcome = await processCommand({ prisma, fromPhone, text });
      await recordInboundMessageLog(prisma, {
        provider: "meta",
        fromPhone,
        messageType: outcome.type,
        externalId: msg.id || null,
      });
      await sendWhatsAppMessage({
        to: fromPhone,
        body: outcome.reply,
        messageType: outcome.type,
        prisma,
      });
    }
    return Response.json({ received: true });
  }

  // Twilio x-www-form-urlencoded payload
  const rawBody = await request.text();
  const form = new URLSearchParams(rawBody);
  const params = Object.fromEntries(form.entries());
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return Response.json({ error: "Twilio auth token is not configured." }, { status: 503 });
  }
  const signature = request.headers.get("x-twilio-signature") || "";
  const baseUrl = (process.env.APP_BASE_URL || new URL(request.url).origin).replace(/\/$/, "");
  const webhookUrl = `${baseUrl}/api/whatsapp/webhook`;
  if (!verifyTwilioSignature({ url: webhookUrl, params, signature, authToken })) {
    return Response.json({ error: "Invalid Twilio signature." }, { status: 401 });
  }

  const fromPhone = params.From || "";
  const text = params.Body || "";
  const outcome = await processCommand({ prisma, fromPhone, text });
  await recordInboundMessageLog(prisma, {
    provider: "twilio",
    fromPhone,
    messageType: outcome.type,
    externalId: params.MessageSid || null,
  });

  return twimlReply(outcome.reply);
}
