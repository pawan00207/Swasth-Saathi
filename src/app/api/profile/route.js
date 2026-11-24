import { requireUser } from "../../../lib/api-auth";

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
    },
  });
}

export async function PATCH(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const body = await request.json();
  if (typeof body.emergencyContact !== "string" || body.emergencyContact.length > 80) {
    return Response.json({ error: "Emergency contact must be a text value of 80 characters or fewer." }, { status: 400 });
  }
  const profile = await context.prisma.profile.update({
    where: { userId: context.user.id },
    data: { emergencyContact: body.emergencyContact.trim() || null },
  });
  return Response.json({ emergencyContact: profile.emergencyContact });
}
