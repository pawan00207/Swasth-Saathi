import { requireUser } from "../../../../../lib/api-auth";

const fields = ["ramp", "elevator", "wheelchairEntrance", "accessibleParking"];

export async function POST(request, { params }) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const body = await request.json();
  if (!fields.includes(body.field) || typeof body.reportedValue !== "boolean") {
    return Response.json({ error: "Select an accessibility field and provide the corrected yes/no value." }, { status: 400 });
  }
  const hospital = await context.prisma.hospital.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!hospital) return Response.json({ error: "Hospital not found." }, { status: 404 });
  const correction = await context.prisma.accessibilityCorrection.create({
    data: {
      hospitalId: hospital.id,
      userId: context.user.id,
      field: body.field,
      reportedValue: body.reportedValue,
      note: typeof body.note === "string" ? body.note.trim().slice(0, 500) : null,
    },
  });
  return Response.json({ correction: { id: correction.id, status: correction.status } }, { status: 201 });
}
