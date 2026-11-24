import { requireUser } from "../../../../lib/api-auth";

export async function GET(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const rows = await context.prisma.savedScheme.findMany({
    where: { userId: context.user.id },
    select: { schemeId: true },
  });
  return Response.json({ saved: rows.map((row) => row.schemeId) });
}

export async function POST(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const { schemeId } = await request.json();
  if (typeof schemeId !== "string" || !schemeId) return Response.json({ error: "Scheme ID is required." }, { status: 400 });
  const scheme = await context.prisma.scheme.findUnique({ where: { id: schemeId }, select: { id: true } });
  if (!scheme) return Response.json({ error: "Scheme not found." }, { status: 404 });
  await context.prisma.savedScheme.upsert({
    where: { userId_schemeId: { userId: context.user.id, schemeId } },
    create: { userId: context.user.id, schemeId },
    update: {},
  });
  return Response.json({ saved: true });
}

export async function DELETE(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const { schemeId } = await request.json();
  if (typeof schemeId !== "string" || !schemeId) return Response.json({ error: "Scheme ID is required." }, { status: 400 });
  await context.prisma.savedScheme.deleteMany({ where: { userId: context.user.id, schemeId } });
  return Response.json({ saved: false });
}
