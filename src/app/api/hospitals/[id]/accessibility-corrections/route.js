import { requireUser } from "../../../../../lib/api-auth";
import { writeAuditLog } from "../../../../../lib/audit";
import { publishRealtime } from "../../../../../lib/realtime-server";

const fields = ["ramp", "elevator", "wheelchairEntrance", "accessibleParking"];
const triStates = ["yes", "no", "unknown"];

function parseTriState(val) {
  if (val === true || val === "true" || val === "yes") return "yes";
  if (val === false || val === "false" || val === "no") return "no";
  return "unknown";
}

function triStateToBoolean(val) {
  if (val === "yes") return true;
  if (val === "no") return false;
  return null;
}

export async function GET(request, { params }) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  if (context.profile.role !== "hospital_admin" || context.profile.hospitalId !== params.id) {
    return Response.json({ error: "Hospital administrator access required." }, { status: 403 });
  }
  const corrections = await context.prisma.accessibilityCorrection.findMany({
    where: { hospitalId: params.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return Response.json({ corrections });
}

export async function POST(request, { params }) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const body = await request.json();

  const hospital = await context.prisma.hospital.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!hospital) return Response.json({ error: "Hospital not found." }, { status: 404 });

  const isMultiField = body.ramp !== undefined || body.elevator !== undefined || body.wheelchairEntrance !== undefined || body.accessibleParking !== undefined;
  let field = body.field;
  let reportedValue = body.reportedValue;

  const ramp = parseTriState(body.ramp);
  const elevator = parseTriState(body.elevator);
  const wheelchairEntrance = parseTriState(body.wheelchairEntrance);
  const accessibleParking = parseTriState(body.accessibleParking);

  if (isMultiField) {
    if (![ramp, elevator, wheelchairEntrance, accessibleParking].every((v) => triStates.includes(v))) {
      return Response.json({ error: "Accessibility values must be yes, no, or unknown." }, { status: 400 });
    }
    const firstSpecific = [
      ["ramp", ramp],
      ["elevator", elevator],
      ["wheelchairEntrance", wheelchairEntrance],
      ["accessibleParking", accessibleParking],
    ].find(([, v]) => v !== "unknown");
    field = firstSpecific ? firstSpecific[0] : "ramp";
    reportedValue = firstSpecific ? firstSpecific[1] === "yes" : false;
  } else if (!fields.includes(field) || typeof reportedValue !== "boolean") {
    return Response.json({ error: "Select an accessibility field and provide the corrected yes/no value." }, { status: 400 });
  }

  let photoUrl = null;
  if (typeof body.photoUrl === "string" && body.photoUrl.startsWith("data:image/") && body.photoUrl.length <= 450_000) {
    photoUrl = body.photoUrl;
  }

  const correction = await context.prisma.accessibilityCorrection.create({
    data: {
      hospitalId: hospital.id,
      userId: context.user.id,
      field,
      reportedValue,
      ramp: isMultiField ? ramp : (field === "ramp" ? (reportedValue ? "yes" : "no") : null),
      elevator: isMultiField ? elevator : (field === "elevator" ? (reportedValue ? "yes" : "no") : null),
      wheelchairEntrance: isMultiField ? wheelchairEntrance : (field === "wheelchairEntrance" ? (reportedValue ? "yes" : "no") : null),
      accessibleParking: isMultiField ? accessibleParking : (field === "accessibleParking" ? (reportedValue ? "yes" : "no") : null),
      photoUrl,
      note: typeof body.note === "string" ? body.note.trim().slice(0, 500) : null,
    },
  });

  await writeAuditLog(context.prisma, {
    entityType: "accessibility_correction",
    entityId: correction.id,
    actorId: context.user.id,
    action: "submitted",
    details: { hospitalId: hospital.id, field },
  });

  return Response.json({ correction: { id: correction.id, status: correction.status } }, { status: 201 });
}

export async function PATCH(request, { params }) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  if (context.profile.role !== "hospital_admin" || context.profile.hospitalId !== params.id) {
    return Response.json({ error: "Hospital administrator access required." }, { status: 403 });
  }
  const { correctionId, status } = await request.json();
  if (typeof correctionId !== "string" || !["approved", "rejected"].includes(status)) {
    return Response.json({ error: "Correction ID and approved/rejected status are required." }, { status: 400 });
  }
  const existing = await context.prisma.accessibilityCorrection.findFirst({
    where: { id: correctionId, hospitalId: params.id, status: "pending" },
  });
  if (!existing) {
    return Response.json({ error: "Pending accessibility correction not found." }, { status: 404 });
  }

  const now = new Date();
  await context.prisma.$transaction(async (transaction) => {
    await transaction.accessibilityCorrection.update({
      where: { id: existing.id },
      data: {
        status,
        reviewedBy: context.user.id,
        reviewedAt: now,
      },
    });
    if (status === "approved") {
      const updateData = {
        accessibilitySource: "staff-verified",
        accessibilityLastVerified: now,
        demo: false,
      };
      if (existing.ramp !== null) updateData.ramp = triStateToBoolean(existing.ramp);
      if (existing.elevator !== null) updateData.elevator = triStateToBoolean(existing.elevator);
      if (existing.wheelchairEntrance !== null) updateData.wheelchairEntrance = triStateToBoolean(existing.wheelchairEntrance);
      if (existing.accessibleParking !== null) updateData.accessibleParking = triStateToBoolean(existing.accessibleParking);
      if (existing.ramp === null && existing.elevator === null && existing.wheelchairEntrance === null && existing.accessibleParking === null) {
        updateData[existing.field] = existing.reportedValue;
      }
      await transaction.hospital.update({
        where: { id: params.id },
        data: updateData,
      });
    }
  });

  await writeAuditLog(context.prisma, {
    entityType: "accessibility_correction",
    entityId: existing.id,
    actorId: context.user.id,
    action: `correction_${status}`,
    details: { hospitalId: params.id },
  });

  await publishRealtime("bed-inventory-live", "updated", { hospitalId: params.id, updatedAt: now.toISOString() });
  return Response.json({ correction: { id: existing.id, status } });
}
