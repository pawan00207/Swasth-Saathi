import { createHash } from "node:crypto";
import { getPrisma } from "../../../../lib/prisma";
import { maskPhone } from "../../../../lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const prisma = getPrisma();
  if (!prisma) {
    return Response.json({ error: "Emergency card service is unavailable." }, { status: 503 });
  }
  const tokenHash = createHash("sha256").update(params.token).digest("hex");
  const token = await prisma.emergencyCardToken.findUnique({
    where: { tokenHash },
  });
  const now = new Date();
  if (!token || token.revokedAt || (token.expiresAt && token.expiresAt <= now)) {
    return Response.json({ error: "Emergency card link is invalid, expired, or revoked." }, { status: 404 });
  }
  const [ep, contacts] = await Promise.all([
    prisma.emergencyProfile.findUnique({ where: { userId: token.userId } }),
    prisma.emergencyContact.findMany({
      where: { userId: token.userId, optInStatus: "opted_in" },
      orderBy: { createdAt: "asc" },
      take: 1,
    }),
  ]);
  if (!ep || !ep.cardEnabled) {
    return Response.json({ error: "Emergency card is disabled by the owner." }, { status: 404 });
  }
  const primaryContact = contacts[0] || null;
  return Response.json({
    bloodGroup: ep.bloodGroup || "Not specified",
    allergies: ep.allergies || "None reported",
    conditions: ep.conditions || "None reported",
    preferredLanguage: ep.preferredLanguage || "en",
    emergencyContact: primaryContact
      ? {
          name: primaryContact.name,
          relation: primaryContact.relation,
          phoneMask: maskPhone(primaryContact.whatsappPhone),
          phone: primaryContact.whatsappPhone,
        }
      : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
