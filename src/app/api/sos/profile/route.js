import { requireUser } from "../../../../lib/api-auth";
import { isValidWhatsappPhone, maskPhone, normalizeWhatsappPhone, writeAuditLog } from "../../../../lib/audit";
import { normalizeLanguage } from "../../../../lib/i18n";
import { sendWhatsAppMessage } from "../../../../lib/whatsapp/provider";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const [profile, contacts] = await Promise.all([
    context.prisma.emergencyProfile.findUnique({ where: { userId: context.user.id } }),
    context.prisma.emergencyContact.findMany({
      where: { userId: context.user.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return Response.json({
    emergencyProfile: profile || {
      userId: context.user.id,
      fullName: context.profile.displayName || "",
      bloodGroup: "",
      allergies: "",
      conditions: "",
      medicines: "",
      preferredLanguage: context.profile.preferredLanguage || "en",
      cardEnabled: false,
    },
    contacts: contacts.map((c) => ({
      id: c.id,
      name: c.name,
      whatsappPhone: c.whatsappPhone,
      phoneMask: maskPhone(c.whatsappPhone),
      relation: c.relation,
      optInStatus: c.optInStatus,
      optInSentAt: c.optInSentAt?.toISOString() || null,
      optedInAt: c.optedInAt?.toISOString() || null,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const body = await request.json();

  const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 120) : "";
  const bloodGroup = typeof body.bloodGroup === "string" ? body.bloodGroup.trim().slice(0, 16) : "";
  const allergies = typeof body.allergies === "string" ? body.allergies.trim().slice(0, 400) : "";
  const conditions = typeof body.conditions === "string" ? body.conditions.trim().slice(0, 400) : "";
  const medicines = typeof body.medicines === "string" ? body.medicines.trim().slice(0, 400) : "";
  const preferredLanguage = normalizeLanguage(body.preferredLanguage || context.profile.preferredLanguage || "en");
  const cardEnabled = Boolean(body.cardEnabled);

  const contactsInput = Array.isArray(body.contacts) ? body.contacts.slice(0, 3) : null;
  if (contactsInput) {
    for (const contact of contactsInput) {
      if (!contact || typeof contact.name !== "string" || !contact.name.trim() || !isValidWhatsappPhone(contact.whatsappPhone || "")) {
        return Response.json({ error: "Each emergency contact needs a name and a valid WhatsApp number with country code." }, { status: 400 });
      }
    }
  }

  const savedProfile = await context.prisma.emergencyProfile.upsert({
    where: { userId: context.user.id },
    create: {
      userId: context.user.id,
      fullName,
      bloodGroup,
      allergies,
      conditions,
      medicines,
      preferredLanguage,
      cardEnabled,
    },
    update: {
      fullName,
      bloodGroup,
      allergies,
      conditions,
      medicines,
      preferredLanguage,
      cardEnabled,
    },
  });

  if (contactsInput) {
    const existing = await context.prisma.emergencyContact.findMany({ where: { userId: context.user.id } });
    const existingByPhone = new Map(existing.map((c) => [c.whatsappPhone, c]));
    await context.prisma.emergencyContact.deleteMany({ where: { userId: context.user.id } });

    const senderName = fullName || context.profile.displayName || "A Swasth Saathi user";
    for (const item of contactsInput) {
      const normalized = normalizeWhatsappPhone(item.whatsappPhone);
      const prev = existingByPhone.get(normalized);
      const optInStatus = prev?.optInStatus || "pending";
      let optInSentAt = prev?.optInSentAt || null;

      if (optInStatus === "pending" && (!prev || item.sendOptIn)) {
        const optInMsg = preferredLanguage === "hi"
          ? `स्वस्थ साथी: ${senderName} ने आपको आपातकालीन संपर्क के रूप में जोड़ा है। SOS अलर्ट प्राप्त करने के लिए YES (या हाँ) लिखकर उत्तर दें।`
          : `Swasth Saathi: ${senderName} added you as an emergency contact. Reply YES to receive SOS alerts, or STOP to decline.`;
        await sendWhatsAppMessage({
          to: normalized,
          body: optInMsg,
          messageType: "sos_optin",
          prisma: context.prisma,
        });
        optInSentAt = new Date();
      }

      await context.prisma.emergencyContact.create({
        data: {
          userId: context.user.id,
          name: item.name.trim().slice(0, 80),
          whatsappPhone: normalized,
          relation: typeof item.relation === "string" && item.relation.trim() ? item.relation.trim().slice(0, 40) : "Family",
          optInStatus,
          optInSentAt,
          optedInAt: prev?.optedInAt || null,
        },
      });
    }
  }

  await writeAuditLog(context.prisma, {
    entityType: "emergency_profile",
    entityId: context.user.id,
    actorId: context.user.id,
    action: "updated",
    details: { cardEnabled, contactCount: contactsInput?.length ?? undefined },
  });

  const contacts = await context.prisma.emergencyContact.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({
    emergencyProfile: savedProfile,
    contacts: contacts.map((c) => ({
      id: c.id,
      name: c.name,
      whatsappPhone: c.whatsappPhone,
      phoneMask: maskPhone(c.whatsappPhone),
      relation: c.relation,
      optInStatus: c.optInStatus,
      optInSentAt: c.optInSentAt?.toISOString() || null,
      optedInAt: c.optedInAt?.toISOString() || null,
    })),
  });
}
