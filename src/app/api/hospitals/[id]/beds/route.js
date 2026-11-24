import { requireUser } from "../../../../../lib/api-auth";
import { publishRealtime } from "../../../../../lib/realtime-server";

const bedTypes = {
  icu: "ICU",
  oxygen: "Oxygen",
  general: "General",
  ventilator: "Ventilator",
};

export async function GET(request, { params }) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  if (context.profile.role !== "hospital_admin" || context.profile.hospitalId !== params.id) {
    return Response.json({ error: "You are not the administrator for this hospital." }, { status: 403 });
  }
  const [inventory, audit] = await Promise.all([
    context.prisma.bedInventory.findMany({ where: { hospitalId: params.id }, orderBy: { bedType: "asc" } }),
    context.prisma.bedInventoryAudit.findMany({
      where: { hospitalId: params.id },
      include: { actor: { select: { displayName: true, userId: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return Response.json({ inventory, audit });
}

export async function PUT(request, { params }) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  if (context.profile.role !== "hospital_admin" || context.profile.hospitalId !== params.id) {
    return Response.json({ error: "You are not the administrator for this hospital." }, { status: 403 });
  }
  const body = await request.json();
  const availableCounts = Object.fromEntries(Object.entries(bedTypes).map(([field, type]) => [type, Number(body[field])]));
  if (Object.values(availableCounts).some((count) => !Number.isInteger(count) || count < 0)) {
    return Response.json({ error: "Bed counts must be non-negative whole numbers." }, { status: 400 });
  }
  const accessibility = body.accessibility;
  const accessibilityFields = ["ramp", "elevator", "wheelchairEntrance", "accessibleParking"];
  if (accessibility && accessibilityFields.some((field) => accessibility[field] !== null && typeof accessibility[field] !== "boolean")) {
    return Response.json({ error: "Accessibility fields must be yes, no, or unknown." }, { status: 400 });
  }

  const result = await context.prisma.$transaction(async (transaction) => {
    const changes = [];
    for (const [bedType, available] of Object.entries(availableCounts)) {
      const where = { hospitalId_bedType: { hospitalId: params.id, bedType } };
      const previous = await transaction.bedInventory.findUnique({ where });
      const total = Math.max(previous?.total || 0, available);
      if (!previous || previous.available !== available) {
        changes.push({ bedType, before: previous?.available ?? null, after: available });
      }
      await transaction.bedInventory.upsert({
        where,
        create: { hospitalId: params.id, bedType, total, available },
        update: { total, available },
      });
    }
    await transaction.bedInventoryAudit.create({
      data: { hospitalId: params.id, actorId: context.user.id, changes },
    });
    const hospitalUpdate = { demo: false };
    if (accessibility && accessibilityFields.every((field) => typeof accessibility[field] === "boolean")) {
      Object.assign(hospitalUpdate, {
        ramp: accessibility.ramp,
        elevator: accessibility.elevator,
        wheelchairEntrance: accessibility.wheelchairEntrance,
        accessibleParking: accessibility.accessibleParking,
        accessibilitySource: "staff-verified",
        accessibilityLastVerified: new Date(),
      });
    }
    await transaction.hospital.update({ where: { id: params.id }, data: hospitalUpdate });
    return transaction.bedInventory.findMany({ where: { hospitalId: params.id }, orderBy: { bedType: "asc" } });
  });
  const updatedAt = result.reduce((latest, bed) => bed.updatedAt > latest ? bed.updatedAt : latest, new Date(0)).toISOString();
  await publishRealtime("bed-inventory-live", "updated", { hospitalId: params.id, updatedAt });
  return Response.json({
    hospital: { id: params.id, bedInventory: result },
    source: "prisma-live",
    lastUpdated: updatedAt,
  });
}
