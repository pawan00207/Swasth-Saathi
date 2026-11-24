import { requireUser } from "../../../../lib/api-auth";
import { publishRealtime } from "../../../../lib/realtime-server";

const bedTypes = ["ICU", "Oxygen", "General", "Ventilator"];

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
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ requests });
}

export async function POST(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const body = await request.json();
  if (
    typeof body.hospitalId !== "string"
    || !bedTypes.includes(body.bedType)
    || !["routine", "urgent", "emergency"].includes(body.urgency)
    || typeof body.patientName !== "string"
    || typeof body.patientPhone !== "string"
    || !body.patientName.trim()
    || !body.patientPhone.trim()
  ) {
    return Response.json({ error: "A hospital, valid bed type, patient name, phone, and urgency are required." }, { status: 400 });
  }
  const hospital = await context.prisma.hospital.findUnique({ where: { id: body.hospitalId }, select: { id: true } });
  if (!hospital) return Response.json({ error: "Hospital not found." }, { status: 404 });
  const bedRequest = await context.prisma.bedRequest.create({
    data: {
      userId: context.user.id,
      hospitalId: hospital.id,
      bedType: body.bedType,
      patientName: body.patientName.trim().slice(0, 120),
      patientPhone: body.patientPhone.trim().slice(0, 40),
      urgency: body.urgency,
    },
  });
  const updatedAt = bedRequest.updatedAt.toISOString();
  await Promise.all([
    publishRealtime(`bed-requests-${hospital.id}`, "updated", { requestId: bedRequest.id, status: bedRequest.status, updatedAt }),
    publishRealtime(`bed-request-${bedRequest.id}`, "updated", { requestId: bedRequest.id, status: bedRequest.status, updatedAt }),
  ]);
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
  const updated = await context.prisma.bedRequest.updateMany({
    where: { id, hospitalId: context.profile.hospitalId, status: "pending" },
    data: { status },
  });
  if (!updated.count) return Response.json({ error: "Pending bed request not found." }, { status: 404 });
  const bedRequest = await context.prisma.bedRequest.findUnique({ where: { id } });
  const updatedAt = bedRequest.updatedAt.toISOString();
  await Promise.all([
    publishRealtime(`bed-requests-${bedRequest.hospitalId}`, "updated", { requestId: bedRequest.id, status: bedRequest.status, updatedAt }),
    publishRealtime(`bed-request-${bedRequest.id}`, "updated", { requestId: bedRequest.id, status: bedRequest.status, updatedAt }),
  ]);
  return Response.json({ request: bedRequest });
}
