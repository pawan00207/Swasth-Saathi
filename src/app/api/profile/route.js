import { requireUser } from "../../../lib/api-auth";
import { normalizeLanguage } from "../../../lib/i18n";

export async function GET(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const { profile } = context;
  return Response.json({
    profile: {
      userId: profile.userId,
      displayName: profile.displayName,
      role: profile.role,
      hospitalId: profile.hospitalId,
      emergencyContact: profile.emergencyContact,
      preferredLanguage: profile.preferredLanguage || "en",
    },
  });
}

export async function PATCH(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const body = await request.json();
  const data = {};
  if (body.emergencyContact !== undefined) {
    if (typeof body.emergencyContact !== "string" || body.emergencyContact.length > 80) {
      return Response.json({ error: "Emergency contact must be a text value of 80 characters or fewer." }, { status: 400 });
    }
    data.emergencyContact = body.emergencyContact.trim() || null;
  }
  if (body.preferredLanguage !== undefined) {
    if (typeof body.preferredLanguage !== "string") {
      return Response.json({ error: "Preferred language must be a valid language code." }, { status: 400 });
    }
    data.preferredLanguage = normalizeLanguage(body.preferredLanguage);
  }
  if (Object.keys(data).length === 0) {
    return Response.json({ error: "No valid profile fields provided." }, { status: 400 });
  }
  const profile = await context.prisma.profile.update({
    where: { userId: context.user.id },
    data,
  });
  return Response.json({
    emergencyContact: profile.emergencyContact,
    preferredLanguage: profile.preferredLanguage,
  });
}
